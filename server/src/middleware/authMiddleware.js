import { verifyAccessToken } from '../utils/tokenService.js';
import { query } from '../config/db.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
        code: 'TOKEN_MISSING',
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Token invalid or expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    const result = await query('SELECT * FROM users WHERE id = $1;', [decoded.id]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists',
        code: 'USER_NOT_FOUND',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
