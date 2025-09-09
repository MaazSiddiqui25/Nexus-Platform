import express from 'express';
import {
  getVideoCallToken,
  getActiveCallStats,
  endVideoCall
} from '../controllers/videoCallController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// ✅ GET /api/video-calls/:meetingId/token - Get video call token
router.get('/:meetingId/token', getVideoCallToken);

// ✅ GET /api/video-calls/stats - Get active call stats (admin only)
router.get('/stats', getActiveCallStats);

// ✅ POST /api/video-calls/:meetingId/end - End video call (organizer only)
router.post('/:meetingId/end', endVideoCall);

export default router;