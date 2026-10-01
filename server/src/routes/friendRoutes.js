import express from 'express';
import {
  searchUserByMobile,
  addFriend,
  getFriends,
} from '../controllers/friendController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getFriends);
router.get('/search', searchUserByMobile);
router.post('/add', addFriend);

export default router;
