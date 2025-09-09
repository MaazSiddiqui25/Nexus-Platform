import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import Meeting from '../models/Meeting.js';
import User from '../models/User.js';

class VideoCallManager {
  constructor() {
    this.rooms = new Map(); // roomId -> { participants, meetingId, startTime }
    this.participants = new Map(); // socketId -> { userId, roomId, audio, video }
  }

  initializeSocket(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.io.on('connection', (socket) => {
      console.log('🔌 User connected:', socket.id);

      // Join video call room
      socket.on('join-room', async (data) => {
        try {
          await this.handleJoinRoom(socket, data);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Handle WebRTC signaling
      socket.on('offer', (data) => this.handleOffer(socket, data));
      socket.on('answer', (data) => this.handleAnswer(socket, data));
      socket.on('ice-candidate', (data) => this.handleIceCandidate(socket, data));

      // Handle media controls
      socket.on('toggle-audio', (data) => this.handleToggleAudio(socket, data));
      socket.on('toggle-video', (data) => this.handleToggleVideo(socket, data));

      // Handle screen sharing
      socket.on('start-screen-share', () => this.handleStartScreenShare(socket));
      socket.on('stop-screen-share', () => this.handleStopScreenShare(socket));

      // Handle chat messages
      socket.on('chat-message', (data) => this.handleChatMessage(socket, data));

      // Handle disconnection
      socket.on('disconnect', () => this.handleDisconnect(socket));
      socket.on('leave-room', () => this.handleLeaveRoom(socket));
    });

    return this.io;
  }

  async handleJoinRoom(socket, { meetingId, userId, userName }) {
    try {
      // Verify meeting exists and user has access
      const meeting = await Meeting.findById(meetingId)
        .populate('organizer', 'name email')
        .populate('attendees.user', 'name email');

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      const isOrganizer = meeting.organizer._id.toString() === userId;
      const isAttendee = meeting.attendees.some(a => a.user._id.toString() === userId);

      if (!isOrganizer && !isAttendee) {
        throw new Error('You are not authorized to join this meeting');
      }

      const roomId = `meeting_${meetingId}`;

      // Initialize room if it doesn't exist
      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, {
          participants: new Map(),
          meetingId,
          meetingTitle: meeting.title,
          startTime: new Date(),
          isRecording: false,
          chatMessages: []
        });

        // Update meeting status to ongoing
        await Meeting.findByIdAndUpdate(meetingId, { status: 'ongoing' });
      }

      const room = this.rooms.get(roomId);

      // Add participant to room
      const participant = {
        socketId: socket.id,
        userId,
        userName,
        isOrganizer,
        joinedAt: new Date(),
        audio: true,
        video: true,
        isScreenSharing: false
      };

      room.participants.set(socket.id, participant);
      this.participants.set(socket.id, { ...participant, roomId });

      // Join socket room
      socket.join(roomId);

      // Notify existing participants about new user
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userId,
        userName,
        isOrganizer
      });

      // Send current room state to new participant
      const participantList = Array.from(room.participants.values()).map(p => ({
        socketId: p.socketId,
        userId: p.userId,
        userName: p.userName,
        isOrganizer: p.isOrganizer,
        audio: p.audio,
        video: p.video,
        isScreenSharing: p.isScreenSharing
      }));

      socket.emit('room-joined', {
        roomId,
        meetingTitle: room.meetingTitle,
        participants: participantList,
        chatMessages: room.chatMessages.slice(-50) // Last 50 messages
      });

      console.log(`👤 ${userName} joined room ${roomId}`);

    } catch (error) {
      console.error('Join room error:', error);
      throw error;
    }
  }

  handleOffer(socket, { targetSocketId, offer }) {
    console.log('📞 Sending offer from', socket.id, 'to', targetSocketId);
    socket.to(targetSocketId).emit('offer', {
      fromSocketId: socket.id,
      offer
    });
  }

  handleAnswer(socket, { targetSocketId, answer }) {
    console.log('📞 Sending answer from', socket.id, 'to', targetSocketId);
    socket.to(targetSocketId).emit('answer', {
      fromSocketId: socket.id,
      answer
    });
  }

  handleIceCandidate(socket, { targetSocketId, candidate }) {
    socket.to(targetSocketId).emit('ice-candidate', {
      fromSocketId: socket.id,
      candidate
    });
  }

  handleToggleAudio(socket, { audio }) {
    const participant = this.participants.get(socket.id);
    if (participant) {
      const room = this.rooms.get(participant.roomId);
      if (room && room.participants.has(socket.id)) {
        room.participants.get(socket.id).audio = audio;
        participant.audio = audio;

        // Notify other participants
        socket.to(participant.roomId).emit('participant-audio-toggle', {
          socketId: socket.id,
          audio
        });

        console.log(`🔊 ${participant.userName} ${audio ? 'unmuted' : 'muted'}`);
      }
    }
  }

  handleToggleVideo(socket, { video }) {
    const participant = this.participants.get(socket.id);
    if (participant) {
      const room = this.rooms.get(participant.roomId);
      if (room && room.participants.has(socket.id)) {
        room.participants.get(socket.id).video = video;
        participant.video = video;

        // Notify other participants
        socket.to(participant.roomId).emit('participant-video-toggle', {
          socketId: socket.id,
          video
        });

        console.log(`📹 ${participant.userName} ${video ? 'turned on' : 'turned off'} video`);
      }
    }
  }

  handleStartScreenShare(socket) {
    const participant = this.participants.get(socket.id);
    if (participant) {
      const room = this.rooms.get(participant.roomId);
      if (room && room.participants.has(socket.id)) {
        room.participants.get(socket.id).isScreenSharing = true;
        participant.isScreenSharing = true;

        // Notify other participants
        socket.to(participant.roomId).emit('screen-share-started', {
          socketId: socket.id,
          userName: participant.userName
        });

        console.log(`🖥️ ${participant.userName} started screen sharing`);
      }
    }
  }

  handleStopScreenShare(socket) {
    const participant = this.participants.get(socket.id);
    if (participant) {
      const room = this.rooms.get(participant.roomId);
      if (room && room.participants.has(socket.id)) {
        room.participants.get(socket.id).isScreenSharing = false;
        participant.isScreenSharing = false;

        // Notify other participants
        socket.to(participant.roomId).emit('screen-share-stopped', {
          socketId: socket.id
        });

        console.log(`🖥️ ${participant.userName} stopped screen sharing`);
      }
    }
  }

  handleChatMessage(socket, { message }) {
    const participant = this.participants.get(socket.id);
    if (participant && message.trim()) {
      const room = this.rooms.get(participant.roomId);
      if (room) {
        const chatMessage = {
          id: uuidv4(),
          userId: participant.userId,
          userName: participant.userName,
          message: message.trim(),
          timestamp: new Date(),
          isOrganizer: participant.isOrganizer
        };

        room.chatMessages.push(chatMessage);

        // Keep only last 100 messages
        if (room.chatMessages.length > 100) {
          room.chatMessages = room.chatMessages.slice(-100);
        }

        // Broadcast message to all participants in the room
        this.io.to(participant.roomId).emit('chat-message', chatMessage);

        console.log(`💬 ${participant.userName}: ${message}`);
      }
    }
  }

  async handleLeaveRoom(socket) {
    await this.removeParticipant(socket);
  }

  async handleDisconnect(socket) {
    console.log('🔌 User disconnected:', socket.id);
    await this.removeParticipant(socket);
  }

  async removeParticipant(socket) {
    const participant = this.participants.get(socket.id);
    if (participant) {
      const room = this.rooms.get(participant.roomId);
      if (room) {
        room.participants.delete(socket.id);

        // Notify other participants
        socket.to(participant.roomId).emit('user-left', {
          socketId: socket.id,
          userName: participant.userName
        });

        console.log(`👤 ${participant.userName} left room ${participant.roomId}`);

        // If room is empty, clean it up and update meeting status
        if (room.participants.size === 0) {
          try {
            await Meeting.findByIdAndUpdate(room.meetingId, { 
              status: 'completed',
              notes: room.chatMessages.length > 0 
                ? `Meeting completed with ${room.chatMessages.length} chat messages` 
                : 'Meeting completed'
            });

            console.log(`🏁 Meeting ${room.meetingId} completed and room cleaned up`);
          } catch (error) {
            console.error('Error updating meeting status:', error);
          }

          this.rooms.delete(participant.roomId);
        }
      }

      this.participants.delete(socket.id);
    }
  }

  // Admin functions
  getRoomStats() {
    const stats = Array.from(this.rooms.entries()).map(([roomId, room]) => ({
      roomId,
      meetingId: room.meetingId,
      meetingTitle: room.meetingTitle,
      participantCount: room.participants.size,
      startTime: room.startTime,
      duration: Date.now() - room.startTime.getTime(),
      isRecording: room.isRecording,
      participants: Array.from(room.participants.values()).map(p => ({
        userName: p.userName,
        joinedAt: p.joinedAt,
        audio: p.audio,
        video: p.video,
        isScreenSharing: p.isScreenSharing
      }))
    }));

    return {
      totalRooms: this.rooms.size,
      totalParticipants: this.participants.size,
      rooms: stats
    };
  }
}

export default new VideoCallManager();

