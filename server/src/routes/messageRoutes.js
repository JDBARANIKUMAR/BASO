import express from 'express';
import {
  getMessages,
  sendMessage,
  markMessagesRead,
} from '../controllers/messageController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.get('/:friendId', getMessages);
router.post('/send', sendMessage);
router.put('/read', markMessagesRead);

export default router;
