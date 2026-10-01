import { Call } from '../models/Call.js';

// POST /api/calls/log
export const logCall = async (req, res, next) => {
  try {
    const { recipientId, type, status, duration, startedAt, endedAt } = req.body;
    const userId = req.user._id;

    if (!recipientId || !type) {
      return res.status(400).json({
        success: false,
        message: 'Recipient and call type are required.',
      });
    }

    const call = await Call.create({
      caller: userId,
      recipient: recipientId,
      type,
      status: status || 'completed',
      duration: duration || 0,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      endedAt: endedAt ? new Date(endedAt) : new Date(),
    });

    res.status(201).json({
      success: true,
      call,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/calls/recent
export const getRecentCalls = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const calls = await Call.find({
      $or: [{ caller: userId }, { recipient: userId }],
    })
      .populate('caller', '_id name mobile avatar')
      .populate('recipient', '_id name mobile avatar')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.status(200).json({
      success: true,
      calls,
    });
  } catch (error) {
    next(error);
  }
};
