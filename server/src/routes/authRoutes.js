import express from 'express';
import {
  sendOtp,
  verifyOtp,
  completeProfile,
  refreshToken,
  getMe,
  logout,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { otpLimiter, otpVerifyLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/send-otp', otpLimiter, sendOtp);
router.post('/verify-otp', otpVerifyLimiter, verifyOtp);
router.post('/refresh', refreshToken);
router.get('/me', requireAuth, getMe);
router.post('/complete-profile', requireAuth, completeProfile);
router.post('/logout', logout);

export default router;
