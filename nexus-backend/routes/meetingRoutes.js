// routes/meetingRoutes.js
import express from 'express';
import {
  createMeeting,
  getUserMeetings,
  getMeetingById,
  updateMeeting,
  cancelMeeting,
  respondToMeeting,
  checkAvailability
} from '../controllers/meetingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// ✅ POST /api/meetings - Create new meeting
router.post('/', createMeeting);

// ✅ GET /api/meetings - Get user's meetings with filters
router.get('/', getUserMeetings);

// ✅ POST /api/meetings/check-availability - Check availability for users
router.post('/check-availability', checkAvailability);

// ✅ GET /api/meetings/:meetingId - Get specific meeting
router.get('/:meetingId', getMeetingById);

// ✅ PUT /api/meetings/:meetingId - Update meeting (organizer only)
router.put('/:meetingId', updateMeeting);

// ✅ DELETE /api/meetings/:meetingId - Cancel meeting (organizer only)
router.delete('/:meetingId', cancelMeeting);

// ✅ POST /api/meetings/:meetingId/respond - Accept/decline meeting invitation
router.post('/:meetingId/respond', respondToMeeting);

export default router;