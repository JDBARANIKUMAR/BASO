import { verifyAccessToken } from '../utils/tokenService.js';
import { prisma } from '../config/db.js';

// Global tracking maps
// userId -> Set<socketId>
const userSockets = new Map();
// socketId -> userId
const socketUserMap = new Map();
// activeCalls: callId -> { callerId, recipientId, type, status, timer, startedAt }
const activeCalls = new Map();
// userActiveCall: userId -> callId
const userActiveCall = new Map();

export const initSocket = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const decoded = verifyAccessToken(token);
      socket.userId = decoded.id.toString();
      next();
    } catch (err) {
      next(new Error('Authentication failed: ' + err.message));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    socketUserMap.set(socket.id, userId);

    // Track user socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Join personal room for targeted events
    socket.join(`user:${userId}`);

    // If this is the user's first active socket, broadcast online status
    if (userSockets.get(userId).size === 1) {
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: true },
      }).catch(() => {});
      io.emit('user:status', { userId, isOnline: true, lastSeen: new Date() });
    }

    // Send currently online users to the connected client
    const onlineUserIds = Array.from(userSockets.keys());
    socket.emit('users:online_list', onlineUserIds);

    console.log(`[Socket] User connected: ${userId} (${socket.id})`);

    // ==========================================
    // CHAT & MESSAGING EVENTS
    // ==========================================

    socket.on('message:send', async (data, ack) => {
      try {
        const { recipientId, content, tempId } = data;
        if (!recipientId || !content || !content.trim()) return;

        const isRecipientOnline = userSockets.has(recipientId.toString());
        const initialStatus = isRecipientOnline ? 'delivered' : 'sent';
        const now = new Date();

        const message = await prisma.message.create({
          data: {
            senderId: userId,
            recipientId: recipientId,
            content: content.trim(),
            tempId: tempId || null,
            status: initialStatus,
            deliveredAt: isRecipientOnline ? now : null,
          }
        });

        // Update friendships
        await prisma.friendship.upsert({
          where: { userId_friendId: { userId: userId, friendId: recipientId } },
          update: { lastMessageId: message.id, lastInteractionAt: now },
          create: { userId: userId, friendId: recipientId, lastMessageId: message.id, lastInteractionAt: now }
        });
        await prisma.friendship.upsert({
          where: { userId_friendId: { userId: recipientId, friendId: userId } },
          update: { lastMessageId: message.id, lastInteractionAt: now },
          create: { userId: recipientId, friendId: userId, lastMessageId: message.id, lastInteractionAt: now }
        });

        // Map id to _id for the client
        const publicMessage = { _id: message.id, ...message };

        // Send to recipient's room
        io.to(`user:${recipientId}`).emit('message:receive', publicMessage);

        // Ack back to sender with confirmed message
        if (typeof ack === 'function') {
          ack({ success: true, message: publicMessage });
        }
      } catch (err) {
        console.error('[Socket] Error saving/sending message:', err);
        if (typeof ack === 'function') {
          ack({ success: false, error: err.message });
        }
      }
    });

    socket.on('message:read', async ({ senderId }) => {
      try {
        if (!senderId) return;
        const now = new Date();
        await prisma.message.updateMany({
          where: {
            senderId: senderId,
            recipientId: userId,
            status: { not: 'read' }
          },
          data: {
            status: 'read',
            readAt: now,
          }
        });

        // Notify the original sender that their messages were read
        io.to(`user:${senderId}`).emit('message:read_ack', {
          readBy: userId,
          readAt: now,
        });
      } catch (err) {
        console.error('[Socket] Error marking read:', err);
      }
    });

    // ==========================================
    // WEBRTC CALL SIGNALING EVENTS
    // ==========================================

    // Caller initiates a call
    socket.on('call:initiate', async ({ recipientId, type }) => {
      try {
        const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Check if recipient is already in a call
        if (userActiveCall.has(recipientId)) {
          socket.emit('call:busy', { recipientId, callId, reason: 'User is busy on another call.' });
          await prisma.call.create({
            data: {
              callerId: userId,
              recipientId: recipientId,
              type,
              status: 'busy',
            }
          });
          return;
        }

        // Check if caller is already in a call
        if (userActiveCall.has(userId)) {
          socket.emit('call:error', { message: 'You are already on an active call.' });
          return;
        }

        // Check if recipient is online
        const isRecipientOnline = userSockets.has(recipientId);
        if (!isRecipientOnline) {
          socket.emit('call:unavailable', {
            recipientId,
            reason: 'User is currently offline.',
          });
          await prisma.call.create({
            data: {
              callerId: userId,
              recipientId: recipientId,
              type,
              status: 'missed',
            }
          });
          return;
        }

        // Get caller details
        const callerUser = await prisma.user.findUnique({ where: { id: userId } });
        const callerInfo = callerUser
          ? { _id: callerUser.id, name: callerUser.name, avatar: callerUser.avatar, mobile: callerUser.mobile }
          : null;

        // Setup 30-second no-answer timeout
        const timeoutTimer = setTimeout(async () => {
          if (activeCalls.has(callId)) {
            const call = activeCalls.get(callId);
            if (call.status === 'ringing') {
              activeCalls.delete(callId);
              userActiveCall.delete(userId);
              userActiveCall.delete(recipientId);

              // Notify both sides
              io.to(`user:${userId}`).emit('call:timeout', { callId });
              io.to(`user:${recipientId}`).emit('call:timeout', { callId });

              await prisma.call.create({
                data: {
                  callerId: userId,
                  recipientId: recipientId,
                  type,
                  status: 'no_answer',
                }
              });
            }
          }
        }, 30000);

        // Store active call state
        activeCalls.set(callId, {
          callId,
          callerId: userId,
          recipientId,
          type,
          status: 'ringing',
          timer: timeoutTimer,
          startedAt: null,
        });

        userActiveCall.set(userId, callId);
        userActiveCall.set(recipientId, callId);

        // Notify caller that call was initiated
        socket.emit('call:initiated', { callId, recipientId, type });

        // Ring recipient
        io.to(`user:${recipientId}`).emit('call:incoming', {
          callId,
          caller: callerInfo,
          type,
        });
      } catch (err) {
        console.error('[Socket] Error initiating call:', err);
        socket.emit('call:error', { message: err.message });
      }
    });

    // Recipient accepts the call
    socket.on('call:accept', async ({ callId }) => {
      const call = activeCalls.get(callId);
      if (!call) {
        socket.emit('call:error', { message: 'Call no longer exists.' });
        return;
      }

      clearTimeout(call.timer);
      call.status = 'ongoing';
      call.startedAt = new Date();

      // Notify caller that recipient accepted
      io.to(`user:${call.callerId}`).emit('call:accepted', {
        callId,
        recipientId: userId,
      });

      // Confirm to recipient
      socket.emit('call:connected', { callId });
    });

    // Recipient declines the call
    socket.on('call:decline', async ({ callId, reason }) => {
      const call = activeCalls.get(callId);
      if (call) {
        clearTimeout(call.timer);
        activeCalls.delete(callId);
        userActiveCall.delete(call.callerId);
        userActiveCall.delete(call.recipientId);

        io.to(`user:${call.callerId}`).emit('call:declined', {
          callId,
          reason: reason || 'Call declined',
        });

        await prisma.call.create({
          data: {
            callerId: call.callerId,
            recipientId: call.recipientId,
            type: call.type,
            status: 'declined',
          }
        });
      }
    });

    // WebRTC Offer
    socket.on('call:offer', ({ to, sdp, callId }) => {
      io.to(`user:${to}`).emit('call:offer', {
        from: userId,
        sdp,
        callId,
      });
    });

    // WebRTC Answer
    socket.on('call:answer', ({ to, sdp, callId }) => {
      io.to(`user:${to}`).emit('call:answer', {
        from: userId,
        sdp,
        callId,
      });
    });

    // WebRTC ICE Candidate
    socket.on('call:ice-candidate', ({ to, candidate, callId }) => {
      io.to(`user:${to}`).emit('call:ice-candidate', {
        from: userId,
        candidate,
        callId,
      });
    });

    // Either party ends the call
    socket.on('call:end', async ({ callId, duration = 0 }) => {
      const call = activeCalls.get(callId);
      if (call) {
        clearTimeout(call.timer);
        const otherUserId = call.callerId === userId ? call.recipientId : call.callerId;

        activeCalls.delete(callId);
        userActiveCall.delete(call.callerId);
        userActiveCall.delete(call.recipientId);

        // Notify other user
        io.to(`user:${otherUserId}`).emit('call:ended', {
          callId,
          duration,
          endedBy: userId,
        });

        // Log call record
        await prisma.call.create({
          data: {
            callerId: call.callerId,
            recipientId: call.recipientId,
            type: call.type,
            status: call.startedAt ? 'completed' : 'missed',
            duration: Math.round(duration),
            startedAt: call.startedAt,
            endedAt: new Date(),
          }
        }).catch((e) => console.error('[Socket] Error saving call log:', e));
      }
    });

    // ==========================================
    // DISCONNECT & CLEANUP
    // ==========================================
    socket.on('disconnect', async () => {
      console.log(`[Socket] User disconnected: ${userId} (${socket.id})`);

      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          const now = new Date();
          await prisma.user.update({
            where: { id: userId },
            data: {
              isOnline: false,
              lastSeen: now,
            }
          }).catch(() => {});

          io.emit('user:status', { userId, isOnline: false, lastSeen: now });
        }
      }
      socketUserMap.delete(socket.id);

      // Check if user was in an ongoing call
      const currentCallId = userActiveCall.get(userId);
      if (currentCallId) {
        const call = activeCalls.get(currentCallId);
        if (call) {
          clearTimeout(call.timer);
          const peerId = call.callerId === userId ? call.recipientId : call.callerId;
          io.to(`user:${peerId}`).emit('call:ended', {
            callId: currentCallId,
            reason: 'User disconnected or lost connection.',
          });
          activeCalls.delete(currentCallId);
          userActiveCall.delete(call.callerId);
          userActiveCall.delete(call.recipientId);
        }
      }
    });
  });
};
