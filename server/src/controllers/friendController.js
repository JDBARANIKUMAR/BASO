import { User } from '../models/User.js';
import { Friendship } from '../models/Friendship.js';
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

    const foundUser = await User.findOne({ mobile: sanitized, isRegistered: true }).select(
      '_id name mobile avatar isOnline lastSeen'
    );

    if (!foundUser) {
      return res.status(404).json({
        success: false,
        message: 'No registered user found with this mobile number.',
      });
    }

    // Check if already friends
    const existingFriendship = await Friendship.findOne({
      user: req.user._id,
      friend: foundUser._id,
    });

    res.status(200).json({
      success: true,
      user: foundUser,
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

    if (friendId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot add yourself.',
      });
    }

    const targetUser = await User.findById(friendId);
    if (!targetUser || !targetUser.isRegistered) {
      return res.status(404).json({
        success: false,
        message: 'User not found or registration incomplete.',
      });
    }

    // Create bidirectional friendship records
    const friendshipA = await Friendship.findOneAndUpdate(
      { user: req.user._id, friend: targetUser._id },
      { lastInteractionAt: new Date() },
      { upsert: true, new: true }
    ).populate('friend', '_id name mobile avatar isOnline lastSeen');

    await Friendship.findOneAndUpdate(
      { user: targetUser._id, friend: req.user._id },
      { lastInteractionAt: new Date() },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Friend added successfully.',
      friendship: friendshipA,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/friends
export const getFriends = async (req, res, next) => {
  try {
    const friendships = await Friendship.find({ user: req.user._id })
      .populate('friend', '_id name mobile avatar isOnline lastSeen')
      .populate('lastMessage')
      .sort({ lastInteractionAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      friends: friendships.map((f) => ({
        friendshipId: f._id,
        user: f.friend,
        lastMessage: f.lastMessage,
        lastInteractionAt: f.lastInteractionAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};
