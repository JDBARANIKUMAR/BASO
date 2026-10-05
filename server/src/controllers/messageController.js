import { prisma } from '../config/db.js';

// GET /api/messages/:friendId?before=2026-10-01T...&limit=30
export const getMessages = async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const { before, limit = 40 } = req.query;
    const userId = req.user.id;

    const parsedLimit = Math.min(parseInt(limit, 10) || 40, 100);

    const whereClause = {
      OR: [
        { senderId: userId, recipientId: friendId },
        { senderId: friendId, recipientId: userId },
      ],
    };

    if (before) {
      whereClause.createdAt = {
        lt: new Date(before),
      };
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parsedLimit,
    });

    // Mark unread messages sent by friend to current user as 'read'
    const unreadMessages = messages.filter(
      (m) => m.senderId === friendId && m.status !== 'read'
    );

    if (unreadMessages.length > 0) {
      await prisma.message.updateMany({
        where: {
          senderId: friendId,
          recipientId: userId,
          status: { not: 'read' },
        },
        data: {
          status: 'read',
          readAt: new Date(),
        },
      });
    }

    // Map _id to id to keep frontend happy
    const formattedMessages = messages.map(m => ({ _id: m.id, ...m }));

    // Return in chronological order (oldest to newest)
    res.status(200).json({
      success: true,
      messages: formattedMessages.reverse(),
      hasMore: messages.length === parsedLimit,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/messages/send
export const sendMessage = async (req, res, next) => {
  try {
    const { recipientId, content, tempId } = req.body;
    const userId = req.user.id;

    if (!recipientId || !content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Recipient and message content are required.',
      });
    }

    const message = await prisma.message.create({
      data: {
        senderId: userId,
        recipientId: recipientId,
        content: content.trim(),
        tempId: tempId || null,
        status: 'sent',
      },
    });

    // Update last interaction for both friendship records
    await prisma.friendship.upsert({
      where: {
        userId_friendId: { userId: userId, friendId: recipientId },
      },
      update: { lastMessageId: message.id, lastInteractionAt: message.createdAt },
      create: {
        userId: userId,
        friendId: recipientId,
        lastMessageId: message.id,
        lastInteractionAt: message.createdAt,
      },
    });

    await prisma.friendship.upsert({
      where: {
        userId_friendId: { userId: recipientId, friendId: userId },
      },
      update: { lastMessageId: message.id, lastInteractionAt: message.createdAt },
      create: {
        userId: recipientId,
        friendId: userId,
        lastMessageId: message.id,
        lastInteractionAt: message.createdAt,
      },
    });

    res.status(201).json({
      success: true,
      message: { _id: message.id, ...message },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/messages/read
export const markMessagesRead = async (req, res, next) => {
  try {
    const { senderId } = req.body;
    const userId = req.user.id;

    if (!senderId) {
      return res.status(400).json({
        success: false,
        message: 'Sender ID is required.',
      });
    }

    await prisma.message.updateMany({
      where: {
        senderId: senderId,
        recipientId: userId,
        status: { not: 'read' },
      },
      data: {
        status: 'read',
        readAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Messages marked as read.',
    });
  } catch (error) {
    next(error);
  }
};
