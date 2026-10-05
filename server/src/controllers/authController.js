import { prisma } from '../config/db.js';
import { sendOtpCode, verifyOtpCode, sanitizeAndValidateMobile } from '../utils/otpService.js';
import {
  generateTokens,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from '../utils/tokenService.js';

// POST /api/auth/send-otp
export const sendOtp = async (req, res, next) => {
  try {
    const { mobile } = req.body;
    if (!mobile || typeof mobile !== 'string' || mobile.trim().length < 4) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid mobile number with country code.',
      });
    }

    const result = await sendOtpCode(mobile);
    res.status(200).json({
      success: true,
      message: 'Verification code sent successfully.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/verify-otp
export const verifyOtp = async (req, res, next) => {
  try {
    const { mobile, code } = req.body;
    if (!mobile || !code) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and verification code are required.',
      });
    }

    const sanitized = sanitizeAndValidateMobile(mobile);
    await verifyOtpCode(sanitized, code);

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { mobile: sanitized } });
    let isNewUser = false;

    if (!user) {
      user = await prisma.user.create({
        data: {
          mobile: sanitized,
          name: '',
          isRegistered: false,
          isOnline: true,
        },
      });
      isNewUser = true;
    } else if (!user.isRegistered) {
      isNewUser = true;
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    // Save refresh token to user
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastSeen: new Date(),
        isOnline: true,
      },
    });

    setRefreshTokenCookie(res, refreshToken);

    const publicUser = {
      id: user.id,
      mobile: user.mobile,
      name: user.name,
      avatar: user.avatar,
      isRegistered: user.isRegistered,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt,
    };

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
      accessToken,
      isNewUser,
      user: publicUser,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/complete-profile
export const completeProfile = async (req, res, next) => {
  try {
    const { name, avatar } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your name.',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name.trim(),
        avatar: avatar || null,
        isRegistered: true,
      },
    });

    const publicUser = {
      id: updatedUser.id,
      mobile: updatedUser.mobile,
      name: updatedUser.name,
      avatar: updatedUser.avatar,
      isRegistered: updatedUser.isRegistered,
      isOnline: updatedUser.isOnline,
      lastSeen: updatedUser.lastSeen,
      createdAt: updatedUser.createdAt,
    };

    res.status(200).json({
      success: true,
      message: 'Profile completed.',
      user: publicUser,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/refresh
export const refreshToken = async (req, res, next) => {
  try {
    const cookieToken = req.cookies.refreshToken;
    if (!cookieToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found in cookie.',
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(cookieToken);
    } catch (err) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token. Please login again.',
      });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.refreshToken !== cookieToken) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Revoked refresh token.',
      });
    }

    // Token rotation: generate new access & refresh tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    setRefreshTokenCookie(res, newRefreshToken);

    const publicUser = {
      id: user.id,
      mobile: user.mobile,
      name: user.name,
      avatar: user.avatar,
      isRegistered: user.isRegistered,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt,
    };

    res.status(200).json({
      success: true,
      accessToken,
      user: publicUser,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  const publicUser = {
    id: req.user.id,
    mobile: req.user.mobile,
    name: req.user.name,
    avatar: req.user.avatar,
    isRegistered: req.user.isRegistered,
    isOnline: req.user.isOnline,
    lastSeen: req.user.lastSeen,
    createdAt: req.user.createdAt,
  };
  res.status(200).json({
    success: true,
    user: publicUser,
  });
};

// POST /api/auth/logout
export const logout = async (req, res, next) => {
  try {
    const cookieToken = req.cookies.refreshToken;
    if (cookieToken) {
      try {
        const decoded = verifyRefreshToken(cookieToken);
        await prisma.user.update({
          where: { id: decoded.id },
          data: {
            refreshToken: null,
            isOnline: false,
            lastSeen: new Date(),
          },
        });
      } catch (e) {
        // Ignore token error on logout
      }
    }

    clearRefreshTokenCookie(res);
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};
