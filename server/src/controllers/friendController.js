import { prisma } from '../config/db.js';
import { sanitizeAndValidateMobile } from '../utils/otpService.js';

// GET /api/friends/search?mobile=+1234567890
export const searchUserByMobile = async (req, res, next) => {
  try {
    const { mobile } = req.query;
    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a mobile number to search.',
      });
    }

    const sanitized = sanitizeAndValidateMobile(mobile);

    // Prevent searching oneself
    if (sanitized === req.user.mobile) {
      return res.status(400).json({
        success: false,
        message: 'You cannot add yourself as a friend.',
      });
    }

    const foundUser = await prisma.user.findFirst({
      where: { mobile: sanitized, isRegistered: true },
      select: {
        id: true,
        name: true,
        mobile: true,
        avatar: true,
        isOnline: true,
        lastSeen: true,
      },
    });

    if (!foundUser) {
      return res.status(404).json({
        success: false,
        message: 'No registered user found with this mobile number.',
      });
    }

    // Check if already friends
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        userId: req.user.id,
        friendId: foundUser.id,
      },
    });

    res.status(200).json({
      success: true,
      user: {
        _id: foundUser.id,
        ...foundUser
      },
      alreadyFriend: Boolean(existingFriendship),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/friends/add
export const addFriend = async (req, res, next) => {
  try {
    const { friendId } = req.body;
    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: 'Friend ID is required.',
      });
    }

    if (friendId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot add yourself.',
      });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: friendId } });
    if (!targetUser || !targetUser.isRegistered) {
      return res.status(404).json({
        success: false,
        message: 'User not found or registration incomplete.',
      });
    }

    const now = new Date();

    // Create bidirectional friendship records
    const friendshipA = await prisma.friendship.upsert({
      where: {
        userId_friendId: {
          userId: req.user.id,
          friendId: targetUser.id,
        },
      },
      update: { lastInteractionAt: now },
      create: {
        userId: req.user.id,
        friendId: targetUser.id,
        lastInteractionAt: now,
      },
      include: {
        friend: true,
      },
    });

    await prisma.friendship.upsert({
      where: {
        userId_friendId: {
          userId: targetUser.id,
          friendId: req.user.id,
        },
      },
      update: { lastInteractionAt: now },
      create: {
        userId: targetUser.id,
        friendId: req.user.id,
        lastInteractionAt: now,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Friend added successfully.',
      friendship: {
        _id: friendshipA.id,
        user: friendshipA.userId,
        friend: {
          _id: friendshipA.friend.id,
          ...friendshipA.friend
        },
        lastInteractionAt: friendshipA.lastInteractionAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/friends
export const getFriends = async (req, res, next) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: { userId: req.user.id },
      orderBy: { lastInteractionAt: 'desc' },
      include: {
        friend: true,
        lastMessage: true,
      },
    });

    res.status(200).json({
      success: true,
      friends: friendships.map((f) => ({
        friendshipId: f.id,
        user: { _id: f.friend.id, ...f.friend },
        lastMessage: f.lastMessage ? { _id: f.lastMessage.id, ...f.lastMessage } : null,
        lastInteractionAt: f.lastInteractionAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};
