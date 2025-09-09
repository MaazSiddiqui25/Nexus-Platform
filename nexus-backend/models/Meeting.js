// models/Meeting.js
import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    },
    responseDate: Date
  }],
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  meetingType: {
    type: String,
    enum: ['video', 'in-person', 'phone'],
    default: 'video'
  },
  location: {
    type: String, // Physical address for in-person, phone number for phone calls
    trim: true
  },
  meetingUrl: {
    type: String, // Video call URL
    trim: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  agenda: [{
    item: String,
    duration: Number // minutes
  }],
  documents: [{
    name: String,
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String,
    trim: true
  },
  recordingUrl: {
    type: String,
    trim: true
  },
  reminder: {
    enabled: {
      type: Boolean,
      default: true
    },
    minutes: {
      type: Number,
      default: 15 // 15 minutes before
    }
  },
  recurring: {
    enabled: {
      type: Boolean,
      default: false
    },
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
    },
    endDate: Date,
    exceptions: [Date] // Dates to skip
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
meetingSchema.index({ organizer: 1, startTime: 1 });
meetingSchema.index({ 'attendees.user': 1, startTime: 1 });
meetingSchema.index({ startTime: 1, endTime: 1 });

// Virtual for duration
meetingSchema.virtual('duration').get(function() {
  return Math.abs(this.endTime - this.startTime) / (1000 * 60); // Duration in minutes
});

// Method to check for conflicts
meetingSchema.methods.hasConflict = async function(userId) {
  const conflictingMeeting = await this.constructor.findOne({
    $and: [
      { _id: { $ne: this._id } }, // Exclude current meeting
      {
        $or: [
          { organizer: userId },
          { 'attendees.user': userId }
        ]
      },
      { status: { $in: ['scheduled', 'ongoing'] } },
      {
        $or: [
          // New meeting starts during existing meeting
          {
            startTime: { $lte: this.startTime },
            endTime: { $gt: this.startTime }
          },
          // New meeting ends during existing meeting
          {
            startTime: { $lt: this.endTime },
            endTime: { $gte: this.endTime }
          },
          // New meeting encompasses existing meeting
          {
            startTime: { $gte: this.startTime },
            endTime: { $lte: this.endTime }
          }
        ]
      }
    ]
  });
  
  return conflictingMeeting;
};

// Method to get all participants
meetingSchema.methods.getAllParticipants = function() {
  const participants = [this.organizer];
  this.attendees.forEach(attendee => participants.push(attendee.user));
  return [...new Set(participants)]; // Remove duplicates
};

export default mongoose.model('Meeting', meetingSchema);