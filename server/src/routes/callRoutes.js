import express from 'express';
import { logCall, getRecentCalls } from '../controllers/callController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.post('/log', logCall);
router.get('/recent', getRecentCalls);

export default router;
