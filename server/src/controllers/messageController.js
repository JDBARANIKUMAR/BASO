import { Message } from '../models/Message.js';
import { Friendship } from '../models/Friendship.js';

// GET /api/messages/:friendId?before=2026-10-01T...&limit=30
export const getMessages = async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const { before, limit = 40 } = req.query;
    const userId = req.user._id;

    const parsedLimit = Math.min(parseInt(limit, 10) || 40, 100);

    const messages = await Message.findConversation({
      userId,
      friendId,
      before: before || null,
      limit: parsedLimit,
    });

    // Mark unread messages sent by friend to current user as 'read'
    const unreadMessages = messages.filter(
      (m) => m.sender?.toString() === friendId.toString() && m.status !== 'read'
    );

    if (unreadMessages.length > 0) {
      await Message.updateManyStatus({
        sender: friendId,
        recipient: userId,
        excludeStatus: 'read',
        newStatus: 'read',
        updateFields: { readAt: new Date() },
      });
    }

    // Return in chronological order (oldest to newest)
    res.status(200).json({
      success: true,
      messages: messages.reverse(),
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
    const userId = req.user._id;

    if (!recipientId || !content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Recipient and message content are required.',
      });
    }

    const message = await Message.create({
      sender: userId,
      recipient: recipientId,
      content: content.trim(),
      tempId: tempId || null,
      status: 'sent',
    });

    // Update last interaction for both friendship records
    await Friendship.findOneAndUpdate(
      { user: userId, friend: recipientId },
      { lastMessage: message._id, lastInteractionAt: message.createdAt },
      { upsert: true }
    );
    await Friendship.findOneAndUpdate(
      { user: recipientId, friend: userId },
      { lastMessage: message._id, lastInteractionAt: message.createdAt },
      { upsert: true }
    );

    res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/messages/read
export const markMessagesRead = async (req, res, next) => {
  try {
    const { senderId } = req.body;
    const userId = req.user._id;

    if (!senderId) {
      return res.status(400).json({
        success: false,
        message: 'Sender ID is required.',
      });
    }

    await Message.updateManyStatus({
      sender: senderId,
      recipient: userId,
      excludeStatus: 'read',
      newStatus: 'read',
      updateFields: { readAt: new Date() },
    });

    res.status(200).json({
      success: true,
      message: 'Messages marked as read.',
    });
  } catch (error) {
    next(error);
  }
};
