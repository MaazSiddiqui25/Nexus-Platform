// controllers/calendarController.js
import Meeting from '../models/Meeting.js';
import User from '../models/User.js';

// ✅ Get calendar events for a specific date range
// ✅ Get calendar events for a specific date range - FIXED VERSION
export const getCalendarEvents = async (req, res) => {
  try {
    const { startDate, endDate, view = 'month' } = req.query;
    const userId = req.user._id;

    console.log('Backend: Received request with:', {
      startDate, 
      endDate, 
      view,
      userId: userId.toString()
    });

    // Use the exact dates from the query without modification
    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log('Backend: Using exact date range:', {
      start: start.toISOString(),
      end: end.toISOString()
    });

    // Get meetings for the user in the specified range
    const meetings = await Meeting.find({
      $and: [
        {
          $or: [
            { organizer: userId },
            { 'attendees.user': userId }
          ]
        },
        { status: { $in: ['scheduled', 'ongoing', 'completed', 'cancelled'] } },
        {
          $or: [
            { startTime: { $gte: start, $lte: end } },
            { endTime: { $gte: start, $lte: end } },
            { startTime: { $lte: start }, endTime: { $gte: end } }
          ]
        }
      ]
    })
    .populate('organizer', 'name email avatar')
    .populate('attendees.user', 'name email avatar')
    .sort({ startTime: 1 });

    console.log('Backend: Found meetings:', meetings.length);
    meetings.forEach(meeting => {
      console.log('Meeting:', {
        id: meeting._id.toString(),
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        organizer: meeting.organizer._id.toString(),
        status: meeting.status
      });
    });

    // Transform meetings to calendar events format
    const events = meetings.map(meeting => {
      const userAttendee = meeting.attendees.find(a => a.user._id.toString() === userId.toString());
      const isOrganizer = meeting.organizer._id.toString() === userId.toString();
      
      return {
        id: meeting._id,
        title: meeting.title,
        description: meeting.description,
        start: meeting.startTime,
        end: meeting.endTime,
        location: meeting.location,
        meetingType: meeting.meetingType,
        meetingUrl: meeting.meetingUrl,
        status: meeting.status,
        isOrganizer,
        attendeeStatus: isOrganizer ? 'organizer' : userAttendee?.status || 'pending',
        attendeeCount: meeting.attendees.length,
        organizer: meeting.organizer,
        color: getEventColor(meeting.meetingType, isOrganizer ? 'organizer' : userAttendee?.status)
      };
    });

    res.json({
      events,
      dateRange: { start, end },
      view,
      totalEvents: events.length,
      debug: {
        query: { startDate, endDate, view },
        calculatedRange: { start, end }, // Now this matches the query
        userId: userId.toString(),
        meetingCount: meetings.length,
        rawMeetings: meetings.map(m => ({
          id: m._id.toString(),
          title: m.title,
          startTime: m.startTime,
          endTime: m.endTime,
          status: m.status,
          organizer: m.organizer._id.toString(),
          attendees: m.attendees.map(a => ({
            user: a.user._id.toString(),
            status: a.status
          }))
        }))
      }
    });

  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ message: error.message });
  }
};



// ✅ Get available time slots for scheduling
export const getAvailableSlots = async (req, res) => {
  try {
    const { date, duration = 60, userIds = [], workingHours = { start: 9, end: 17 } } = req.query;
    
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(workingHours.start, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(workingHours.end, 0, 0, 0);

    const allUsers = userIds.length > 0 ? JSON.parse(userIds) : [req.user._id];

    // Get all meetings for the specified users on the target date
    const existingMeetings = await Meeting.find({
      $and: [
        {
          $or: [
            { organizer: { $in: allUsers } },
            { 'attendees.user': { $in: allUsers } }
          ]
        },
        { status: { $in: ['scheduled', 'ongoing'] } },
        {
          $or: [
            { startTime: { $gte: startOfDay, $lte: endOfDay } },
            { endTime: { $gte: startOfDay, $lte: endOfDay } },
            { startTime: { $lte: startOfDay }, endTime: { $gte: endOfDay } }
          ]
        }
      ]
    }).sort({ startTime: 1 });

    // Generate available slots
    const availableSlots = [];
    const slotDuration = parseInt(duration);
    
    let currentSlot = new Date(startOfDay);
    
    while (currentSlot < endOfDay) {
      const slotEnd = new Date(currentSlot.getTime() + slotDuration * 60000);
      
      if (slotEnd <= endOfDay) {
        // Check if this slot conflicts with any existing meeting
        const hasConflict = existingMeetings.some(meeting => {
          return (
            (currentSlot >= meeting.startTime && currentSlot < meeting.endTime) ||
            (slotEnd > meeting.startTime && slotEnd <= meeting.endTime) ||
            (currentSlot <= meeting.startTime && slotEnd >= meeting.endTime)
          );
        });

        if (!hasConflict) {
          availableSlots.push({
            start: new Date(currentSlot),
            end: new Date(slotEnd),
            duration: slotDuration,
            available: true
          });
        }
      }
      
      // Move to next 30-minute slot
      currentSlot.setMinutes(currentSlot.getMinutes() + 30);
    }

    res.json({
      date: targetDate,
      availableSlots,
      workingHours,
      totalSlots: availableSlots.length,
      existingMeetings: existingMeetings.length
    });

  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Bulk operations for calendar sync
export const bulkMeetingOperations = async (req, res) => {
  try {
    const { operations } = req.body; // Array of operations
    const userId = req.user._id;
    const results = [];

    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'accept':
            const acceptResult = await acceptMeetingBulk(operation.meetingId, userId);
            results.push({ ...operation, success: true, result: acceptResult });
            break;
          
          case 'decline':
            const declineResult = await declineMeetingBulk(operation.meetingId, userId);
            results.push({ ...operation, success: true, result: declineResult });
            break;
          
          case 'reschedule':
            const rescheduleResult = await rescheduleMeetingBulk(
              operation.meetingId, 
              userId, 
              operation.newStartTime, 
              operation.newEndTime
            );
            results.push({ ...operation, success: true, result: rescheduleResult });
            break;
          
          default:
            results.push({ ...operation, success: false, error: 'Unknown operation type' });
        }
      } catch (operationError) {
        results.push({ ...operation, success: false, error: operationError.message });
      }
    }

    res.json({
      message: 'Bulk operations completed',
      results,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

  } catch (error) {
    console.error('Bulk operations error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Helper functions
function getWeekStart(date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day;
  return new Date(start.setDate(diff));
}

function getEventColor(meetingType, status) {
  const colors = {
    video: { organizer: '#3498db', accepted: '#2ecc71', pending: '#f39c12', declined: '#e74c3c' },
    'in-person': { organizer: '#9b59b6', accepted: '#8e44ad', pending: '#f39c12', declined: '#e74c3c' },
    phone: { organizer: '#1abc9c', accepted: '#16a085', pending: '#f39c12', declined: '#e74c3c' }
  };
  
  return colors[meetingType]?.[status] || '#95a5a6';
}

async function acceptMeetingBulk(meetingId, userId) {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new Error('Meeting not found');

  const attendeeIndex = meeting.attendees.findIndex(
    attendee => attendee.user.toString() === userId.toString()
  );

  if (attendeeIndex === -1) throw new Error('Not invited to this meeting');

  meeting.attendees[attendeeIndex].status = 'accepted';
  meeting.attendees[attendeeIndex].responseDate = new Date();

  await meeting.save();
  return meeting;
}

async function declineMeetingBulk(meetingId, userId) {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new Error('Meeting not found');

  const attendeeIndex = meeting.attendees.findIndex(
    attendee => attendee.user.toString() === userId.toString()
  );

  if (attendeeIndex === -1) throw new Error('Not invited to this meeting');

  meeting.attendees[attendeeIndex].status = 'declined';
  meeting.attendees[attendeeIndex].responseDate = new Date();

  await meeting.save();
  return meeting;
}

async function rescheduleMeetingBulk(meetingId, userId, newStartTime, newEndTime) {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new Error('Meeting not found');

  if (meeting.organizer.toString() !== userId.toString()) {
    throw new Error('Only organizer can reschedule');
  }

  meeting.startTime = new Date(newStartTime);
  meeting.endTime = new Date(newEndTime);

  // Reset attendee responses
  meeting.attendees.forEach(attendee => {
    if (attendee.status === 'accepted') {
      attendee.status = 'pending';
      attendee.responseDate = undefined;
    }
  });

  await meeting.save();
  return meeting;
}