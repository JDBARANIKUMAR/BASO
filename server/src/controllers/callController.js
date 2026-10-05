import { prisma } from '../config/db.js';

// POST /api/calls/log
export const logCall = async (req, res, next) => {
  try {
    const { recipientId, type, status, duration, startedAt, endedAt } = req.body;
    const userId = req.user.id;

    if (!recipientId || !type) {
      return res.status(400).json({
        success: false,
        message: 'Recipient and call type are required.',
      });
    }

    const call = await prisma.call.create({
      data: {
        callerId: userId,
        recipientId: recipientId,
        type,
        status: status || 'completed',
        duration: duration || 0,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        endedAt: endedAt ? new Date(endedAt) : new Date(),
      },
    });

    res.status(201).json({
      success: true,
      call: { _id: call.id, ...call },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/calls/recent
export const getRecentCalls = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const calls = await prisma.call.findMany({
      where: {
        OR: [{ callerId: userId }, { recipientId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        caller: true,
        recipient: true,
      },
    });

    res.status(200).json({
      success: true,
      calls: calls.map(c => ({
        _id: c.id,
        caller: { _id: c.caller.id, ...c.caller },
        recipient: { _id: c.recipient.id, ...c.recipient },
        type: c.type,
        status: c.status,
        duration: c.duration,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};
