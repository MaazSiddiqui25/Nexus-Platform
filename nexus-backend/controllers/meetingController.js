// controllers/meetingController.js
import Meeting from '../models/Meeting.js';
import User from '../models/User.js';
import { sendMeetingNotification } from '../utils/notifications.js';

// ✅ Create a new meeting
export const createMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      attendeeIds,
      startTime,
      endTime,
      timezone,
      meetingType,
      location,
      agenda,
      reminder
    } = req.body;

    // Validate required fields
    if (!title || !startTime || !endTime || !attendeeIds || attendeeIds.length === 0) {
      return res.status(400).json({ 
        message: 'Title, start time, end time, and at least one attendee are required' 
      });
    }

    // Validate time logic
    if (new Date(startTime) >= new Date(endTime)) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    // Check if all attendees exist
    const attendees = await User.find({ _id: { $in: attendeeIds } });
    if (attendees.length !== attendeeIds.length) {
      return res.status(400).json({ message: 'One or more attendees not found' });
    }

    // Create meeting object
    const meeting = new Meeting({
      title,
      description,
      organizer: req.user._id,
      attendees: attendeeIds.map(id => ({ user: id })),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timezone: timezone || 'UTC',
      meetingType: meetingType || 'video',
      location,
      agenda: agenda || [],
      reminder: reminder || { enabled: true, minutes: 15 },
      createdBy: req.user._id
    });

    // Check for conflicts for organizer
    const organizerConflict = await meeting.hasConflict(req.user._id);
    if (organizerConflict) {
      return res.status(409).json({ 
        message: 'You have a conflicting meeting at this time',
        conflictingMeeting: {
          id: organizerConflict._id,
          title: organizerConflict.title,
          startTime: organizerConflict.startTime,
          endTime: organizerConflict.endTime
        }
      });
    }

    // Check for conflicts for each attendee
    const conflicts = [];
    for (let attendeeId of attendeeIds) {
      const conflict = await meeting.hasConflict(attendeeId);
      if (conflict) {
        const attendee = attendees.find(a => a._id.toString() === attendeeId);
        conflicts.push({
          attendee: attendee.name,
          conflictingMeeting: {
            title: conflict.title,
            startTime: conflict.startTime,
            endTime: conflict.endTime
          }
        });
      }
    }

    if (conflicts.length > 0) {
      return res.status(409).json({ 
        message: 'Some attendees have conflicting meetings',
        conflicts
      });
    }

    // Generate meeting URL for video calls
    if (meetingType === 'video') {
      meeting.meetingUrl = `${process.env.FRONTEND_URL}/video-call/${meeting._id}`;
    }

    await meeting.save();

    // Populate attendees and organizer for response
    await meeting.populate([
      { path: 'organizer', select: 'name email avatar' },
      { path: 'attendees.user', select: 'name email avatar' }
    ]);

    // Send notifications to attendees (implement this utility function)
    try {
      await sendMeetingNotification(meeting, 'created');
    } catch (notificationError) {
      console.error('Failed to send meeting notifications:', notificationError);
    }

    res.status(201).json({
      message: 'Meeting created successfully',
      meeting
    });

  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get user's meetings
export const getUserMeetings = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      status, 
      page = 1, 
      limit = 20,
      includeDeclined = false 
    } = req.query;

    const userId = req.user._id;
    const skip = (page - 1) * limit;

    // Build query
    const query = {
      $and: [
        {
          $or: [
            { organizer: userId },
            { 'attendees.user': userId }
          ]
        }
      ]
    };

    // Filter by date range
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      query.$and.push({ startTime: dateFilter });
    }

    // Filter by status
    if (status) {
      query.$and.push({ status });
    }

    // Exclude declined meetings unless requested
    if (!includeDeclined) {
      query.$and.push({
        $or: [
          { organizer: userId },
          { 
            'attendees': {
              $elemMatch: {
                user: userId,
                status: { $ne: 'declined' }
              }
            }
          }
        ]
      });
    }

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name email avatar')
      .populate('attendees.user', 'name email avatar')
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalMeetings = await Meeting.countDocuments(query);

    res.json({
      meetings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalMeetings / limit),
        totalMeetings,
        hasMore: skip + meetings.length < totalMeetings
      }
    });

  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Respond to meeting invitation (accept/decline)
export const respondToMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { response } = req.body; // 'accepted' or 'declined'
    const userId = req.user._id;

    if (!['accepted', 'declined'].includes(response)) {
      return res.status(400).json({ message: 'Response must be "accepted" or "declined"' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Find attendee in the meeting
    const attendeeIndex = meeting.attendees.findIndex(
      attendee => attendee.user.toString() === userId.toString()
    );

    if (attendeeIndex === -1) {
      return res.status(403).json({ message: 'You are not invited to this meeting' });
    }

    // Check for conflicts if accepting
    if (response === 'accepted') {
      const conflict = await meeting.hasConflict(userId);
      if (conflict) {
        return res.status(409).json({ 
          message: 'You have a conflicting meeting at this time',
          conflictingMeeting: {
            id: conflict._id,
            title: conflict.title,
            startTime: conflict.startTime,
            endTime: conflict.endTime
          }
        });
      }
    }

    // Update attendee response
    meeting.attendees[attendeeIndex].status = response;
    meeting.attendees[attendeeIndex].responseDate = new Date();

    await meeting.save();
    
    await meeting.populate([
      { path: 'organizer', select: 'name email avatar' },
      { path: 'attendees.user', select: 'name email avatar' }
    ]);

    // Notify organizer of response
    try {
      await sendMeetingNotification(meeting, `response_${response}`, req.user);
    } catch (notificationError) {
      console.error('Failed to send response notification:', notificationError);
    }

    res.json({
      message: `Meeting invitation ${response}`,
      meeting
    });

  } catch (error) {
    console.error('Respond to meeting error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update meeting (only organizer)
export const updateMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const updates = req.body;
    const userId = req.user._id;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Only organizer can update
    if (meeting.organizer.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the organizer can update this meeting' });
    }

    // Validate time changes
    if (updates.startTime || updates.endTime) {
      const startTime = updates.startTime ? new Date(updates.startTime) : meeting.startTime;
      const endTime = updates.endTime ? new Date(updates.endTime) : meeting.endTime;
      
      if (startTime >= endTime) {
        return res.status(400).json({ message: 'End time must be after start time' });
      }

      // Check for conflicts if time is changing
      const tempMeeting = { ...meeting.toObject(), startTime, endTime };
      tempMeeting._id = meeting._id;
      
      const allParticipants = meeting.getAllParticipants();
      for (let participantId of allParticipants) {
        const conflict = await Meeting.findOne({
          $and: [
            { _id: { $ne: meeting._id } },
            {
              $or: [
                { organizer: participantId },
                { 'attendees.user': participantId }
              ]
            },
            { status: { $in: ['scheduled', 'ongoing'] } },
            {
              $or: [
                { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
                { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
                { startTime: { $gte: startTime }, endTime: { $lte: endTime } }
              ]
            }
          ]
        });

        if (conflict) {
          const participant = await User.findById(participantId);
          return res.status(409).json({ 
            message: `${participant.name} has a conflicting meeting at the new time`,
            conflictingMeeting: {
              title: conflict.title,
              startTime: conflict.startTime,
              endTime: conflict.endTime
            }
          });
        }
      }
    }

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
        meeting[key] = updates[key];
      }
    });

    // Reset attendee responses if significant changes
    if (updates.startTime || updates.endTime || updates.location) {
      meeting.attendees.forEach(attendee => {
        if (attendee.status === 'accepted') {
          attendee.status = 'pending';
          attendee.responseDate = undefined;
        }
      });
    }

    await meeting.save();
    
    await meeting.populate([
      { path: 'organizer', select: 'name email avatar' },
      { path: 'attendees.user', select: 'name email avatar' }
    ]);

    // Notify attendees of changes
    try {
      await sendMeetingNotification(meeting, 'updated');
    } catch (notificationError) {
      console.error('Failed to send update notifications:', notificationError);
    }

    res.json({
      message: 'Meeting updated successfully',
      meeting
    });

  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Cancel meeting
export const cancelMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Only organizer can cancel
    if (meeting.organizer.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the organizer can cancel this meeting' });
    }

    meeting.status = 'cancelled';
    if (reason) {
      meeting.notes = `Cancelled: ${reason}`;
    }

    await meeting.save();
    
    await meeting.populate([
      { path: 'organizer', select: 'name email avatar' },
      { path: 'attendees.user', select: 'name email avatar' }
    ]);

    // Notify attendees of cancellation
    try {
      await sendMeetingNotification(meeting, 'cancelled', null, reason);
    } catch (notificationError) {
      console.error('Failed to send cancellation notifications:', notificationError);
    }

    res.json({
      message: 'Meeting cancelled successfully',
      meeting
    });

  } catch (error) {
    console.error('Cancel meeting error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get meeting details
export const getMeetingById = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    const meeting = await Meeting.findById(meetingId)
      .populate('organizer', 'name email avatar')
      .populate('attendees.user', 'name email avatar')
      .populate('documents.uploadedBy', 'name');

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Check if user is participant
    const isParticipant = meeting.organizer._id.toString() === userId.toString() ||
      meeting.attendees.some(attendee => attendee.user._id.toString() === userId.toString());

    if (!isParticipant) {
      return res.status(403).json({ message: 'You do not have access to this meeting' });
    }

    res.json({ meeting });

  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Check availability
export const checkAvailability = async (req, res) => {
  try {
    const { userIds, startTime, endTime, excludeMeetingId } = req.body;

    if (!userIds || !startTime || !endTime) {
      return res.status(400).json({ 
        message: 'User IDs, start time, and end time are required' 
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    const availability = {};

    for (let userId of userIds) {
      const query = {
        $and: [
          {
            $or: [
              { organizer: userId },
              { 'attendees.user': userId, 'attendees.status': { $ne: 'declined' } }
            ]
          },
          { status: { $in: ['scheduled', 'ongoing'] } },
          {
            $or: [
              { startTime: { $lte: start }, endTime: { $gt: start } },
              { startTime: { $lt: end }, endTime: { $gte: end } },
              { startTime: { $gte: start }, endTime: { $lte: end } }
            ]
          }
        ]
      };

      if (excludeMeetingId) {
        query.$and.push({ _id: { $ne: excludeMeetingId } });
      }

      const conflicts = await Meeting.find(query)
        .populate('organizer', 'name')
        .select('title startTime endTime organizer');

      availability[userId] = {
        available: conflicts.length === 0,
        conflicts: conflicts.map(meeting => ({
          id: meeting._id,
          title: meeting.title,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          organizer: meeting.organizer.name
        }))
      };
    }

    res.json({ availability });

  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ message: error.message });
  }
};