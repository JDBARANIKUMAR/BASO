import { query } from '../config/db.js';
import { sendOtpCode, verifyOtpCode } from '../utils/otpService.js';
import {
  generateTokens,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from '../utils/tokenService.js';

// POST /api/auth/send-otp
export const sendOtp = async (req, res, next) => {
  try {
    const { countryCode, mobile } = req.body;

    if (!mobile || typeof mobile !== 'string' || mobile.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required.',
      });
    }

    const result = await sendOtpCode({
      countryCode: countryCode || '+91',
      mobile: mobile.trim(),
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/verify-otp
export const verifyOtp = async (req, res, next) => {
  try {
    const { countryCode, mobile, otp, code } = req.body;
    const otpValue = otp || code;

    if (!mobile || typeof mobile !== 'string' || mobile.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required.',
      });
    }

    if (!otpValue || typeof otpValue !== 'string' || otpValue.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is required.',
      });
    }

    const { user, isNewUser, countryCode: verifiedCode, mobile: verifiedMobile, e164 } = await verifyOtpCode({
      countryCode: countryCode || '+91',
      mobile: mobile.trim(),
      otp: otpValue.trim(),
    });

    // Generate long-lived JWT token (30 days) and refresh token
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Save refresh token & online status in database
    await query(
      'UPDATE users SET refresh_token = $1, is_online = true, last_seen = NOW() WHERE id = $2;',
      [refreshToken, user.id]
    );

    setRefreshTokenCookie(res, refreshToken);

    const publicUser = {
      id: user.id,
      countryCode: user.country_code || verifiedCode,
      mobile: user.mobile || verifiedMobile,
      e164,
      name: user.name || '',
      avatar: user.avatar || '',
      isRegistered: Boolean(user.is_registered ?? user.isRegistered),
      isOnline: true,
      lastSeen: user.last_seen || user.lastSeen,
      createdAt: user.created_at || user.createdAt,
    };

    return res.status(200).json({
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

    const updateResult = await query(
      `UPDATE users
       SET name = $1, avatar = $2, is_registered = true, updated_at = NOW()
       WHERE id = $3
       RETURNING *;`,
      [name.trim(), avatar || null, req.user.id]
    );

    const updatedUser = updateResult.rows[0];

    const publicUser = {
      id: updatedUser.id,
      countryCode: updatedUser.country_code || '+91',
      mobile: updatedUser.mobile,
      name: updatedUser.name,
      avatar: updatedUser.avatar || '',
      isRegistered: true,
      isOnline: Boolean(updatedUser.is_online ?? updatedUser.isOnline),
      lastSeen: updatedUser.last_seen || updatedUser.lastSeen,
      createdAt: updatedUser.created_at || updatedUser.createdAt,
    };

    return res.status(200).json({
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

    const userResult = await query('SELECT * FROM users WHERE id = $1;', [decoded.id]);
    const user = userResult.rows[0];

    if (!user || user.refresh_token !== cookieToken) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Revoked refresh token.',
      });
    }

    // Token rotation
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);

    await query('UPDATE users SET refresh_token = $1 WHERE id = $2;', [newRefreshToken, user.id]);

    setRefreshTokenCookie(res, newRefreshToken);

    const publicUser = {
      id: user.id,
      countryCode: user.country_code || '+91',
      mobile: user.mobile,
      name: user.name || '',
      avatar: user.avatar || '',
      isRegistered: Boolean(user.is_registered ?? user.isRegistered),
      isOnline: Boolean(user.is_online ?? user.isOnline),
      lastSeen: user.last_seen || user.lastSeen,
      createdAt: user.created_at || user.createdAt,
    };

    return res.status(200).json({
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
  const user = req.user;
  const publicUser = {
    id: user.id,
    countryCode: user.country_code || '+91',
    mobile: user.mobile,
    name: user.name || '',
    avatar: user.avatar || '',
    isRegistered: Boolean(user.is_registered ?? user.isRegistered),
    isOnline: Boolean(user.is_online ?? user.isOnline),
    lastSeen: user.last_seen || user.lastSeen,
    createdAt: user.created_at || user.createdAt,
  };

  return res.status(200).json({
    success: true,
    user: publicUser,
  });
};

// POST /api/auth/logout
export const logout = async (req, res, next) => {
  try {
    const cookieToken = req.cookies?.refreshToken;
    if (cookieToken) {
      try {
        const decoded = verifyRefreshToken(cookieToken);
        await query(
          'UPDATE users SET refresh_token = NULL, is_online = false, last_seen = NOW() WHERE id = $1;',
          [decoded.id]
        );
      } catch (e) {
        // Ignore token decode error on logout
      }
    }

    clearRefreshTokenCookie(res);
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};
