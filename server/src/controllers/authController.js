import { User } from '../models/User.js';
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

    // sanitizeAndValidateMobile throws if invalid
    const sanitized = sanitizeAndValidateMobile(mobile);
    await verifyOtpCode(sanitized, code);

    // Check if user exists
    let user = await User.findOne({ mobile: sanitized });
    let isNewUser = false;

    if (!user) {
      user = await User.create({
        mobile: sanitized,
        isRegistered: false,
      });
      isNewUser = true;
    } else if (!user.isRegistered) {
      isNewUser = true;
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    // Save refresh token to user
    user.refreshToken = refreshToken;
    user.lastSeen = new Date();
    await User.save(user);

    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
      accessToken,
      isNewUser,
      user: user.toPublicJSON(),
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

    const user = req.user;
    user.name = name.trim();
    if (avatar && typeof avatar === 'string') {
      user.avatar = avatar;
    }
    user.isRegistered = true;
    await User.save(user);

    res.status(200).json({
      success: true,
      message: 'Profile completed.',
      user: user.toPublicJSON(),
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

    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== cookieToken) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Revoked refresh token.',
      });
    }

    // Token rotation: generate new access & refresh tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    user.refreshToken = newRefreshToken;
    await User.save(user);

    setRefreshTokenCookie(res, newRefreshToken);

    res.status(200).json({
      success: true,
      accessToken,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user.toPublicJSON(),
  });
};

// POST /api/auth/logout
export const logout = async (req, res, next) => {
  try {
    const cookieToken = req.cookies.refreshToken;
    if (cookieToken) {
      try {
        const decoded = verifyRefreshToken(cookieToken);
        await User.findByIdAndUpdate(decoded.id, {
          refreshToken: null,
          isOnline: false,
          lastSeen: new Date(),
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
