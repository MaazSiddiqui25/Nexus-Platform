import express from 'express';
import {
  getCalendarEvents,
  getAvailableSlots,
  bulkMeetingOperations
} from '../controllers/calendarController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// ✅ GET /api/calendar/events - Get calendar events
router.get('/events', getCalendarEvents);

// ✅ GET /api/calendar/available-slots - Get available time slots
router.get('/available-slots', getAvailableSlots);

// ✅ POST /api/calendar/bulk-operations - Bulk accept/decline meetings
router.post('/bulk-operations', bulkMeetingOperations);

export default router;