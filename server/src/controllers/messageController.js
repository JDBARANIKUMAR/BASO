import { Message } from '../models/Message.js';
import { Friendship } from '../models/Friendship.js';

// GET /api/messages/:friendId?before=2026-10-01T...&limit=30
export const getMessages = async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const { before, limit = 40 } = req.query;
    const userId = req.user._id;

    const query = {
      $or: [
        { sender: userId, recipient: friendId },
        { sender: friendId, recipient: userId },
      ],
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 40, 100))
      .lean();

    // Mark unread messages sent by friend to current user as 'read'
    const unreadMessageIds = messages
      .filter((m) => m.sender.toString() === friendId.toString() && m.status !== 'read')
      .map((m) => m._id);

    if (unreadMessageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        { status: 'read', readAt: new Date() }
      );
    }

    // Return in chronological order (oldest to newest)
    res.status(200).json({
      success: true,
      messages: messages.reverse(),
      hasMore: messages.length === parseInt(limit, 10),
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

    await Message.updateMany(
      { sender: senderId, recipient: userId, status: { $ne: 'read' } },
      { status: 'read', readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'Messages marked as read.',
    });
  } catch (error) {
    next(error);
  }
};
