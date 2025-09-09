// ===============================================
// 2. Video Call Routes Controller
// ===============================================

// controllers/videoCallController.js
import VideoCallManager from '../utils/videoCallManager.js';
import Meeting from '../models/Meeting.js';

// ✅ Get video call token/URL for a meeting
export const getVideoCallToken = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    const meeting = await Meeting.findById(meetingId)
      .populate('organizer', 'name email')
      .populate('attendees.user', 'name email');

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const isOrganizer = meeting.organizer._id.toString() === userId.toString();
    const isAttendee = meeting.attendees.some(a => a.user._id.toString() === userId.toString());

    if (!isOrganizer && !isAttendee) {
      return res.status(403).json({ message: 'You are not authorized to join this meeting' });
    }

    const callToken = {
      meetingId: meeting._id,
      roomId: `meeting_${meetingId}`,
      userId: userId.toString(),
      userName: req.user.name,
      isOrganizer,
      meetingTitle: meeting.title,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    res.json({
      message: 'Video call token generated',
      callToken,
      socketUrl: process.env.SOCKET_URL || `http://localhost:${process.env.PORT || 5000}`
    });

  } catch (error) {
    console.error('Get video call token error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get active video call stats (admin only)
export const getActiveCallStats = async (req, res) => {
  try {
    // Check if user is admin (you can modify this based on your role system)
  if (!['entrepreneur', 'investor'].includes(req.user.role)) {
  return res.status(403).json({ message: 'Access denied' });
}


    const stats = VideoCallManager.getRoomStats();
    res.json(stats);

  } catch (error) {
    console.error('Get call stats error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ End video call (organizer only)
export const endVideoCall = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    if (meeting.organizer.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the organizer can end the call' });
    }

    const roomId = `meeting_${meetingId}`;
    const room = VideoCallManager.rooms.get(roomId);

    if (room) {
      // Notify all participants that the call is ending
      VideoCallManager.io.to(roomId).emit('call-ended', {
        message: 'The call has been ended by the organizer',
        endedBy: req.user.name
      });

      // Force disconnect all participants
      const participants = Array.from(room.participants.keys());
      participants.forEach(socketId => {
        const socket = VideoCallManager.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(roomId);
          socket.disconnect();
        }
      });

      // Clean up room
      VideoCallManager.rooms.delete(roomId);
    }

    // Update meeting status
    meeting.status = 'completed';
    meeting.notes = (meeting.notes || '') + `\nCall ended by organizer at ${new Date().toISOString()}`;
    await meeting.save();

    res.json({
      message: 'Video call ended successfully',
      meeting
    });

  } catch (error) {
    console.error('End video call error:', error);
    res.status(500).json({ message: error.message });
  }
};