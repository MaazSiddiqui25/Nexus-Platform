// In your server.js, make sure the uploads route is BEFORE any auth middleware
// and is publicly accessible

import express from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./db.js";
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from "./routes/authRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import videoCallRoutes from "./routes/videoCallRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import userLookupRoutes from './routes/userLookupRoutes.js';

// Import video call manager
import VideoCallManager from "./utils/videoCallManager.js";

dotenv.config();
connectDB();

const app = express();
const server = createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

VideoCallManager.initializeSocket(server);

// CORS setup
const allowedOrigins = [process.env.FRONTEND_URL];
app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){
      const msg = `CORS error: Origin ${origin} not allowed`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.set('trust proxy', 1);

// ✅ IMPORTANT: Serve uploads statically BEFORE any auth routes
// This makes files publicly accessible without authentication
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Nexus API Server is running!",
    version: "2.0.0",
    features: {
      meetings: "✅ Meeting scheduling with conflict detection",
      calendar: "✅ Calendar sync and bulk operations",
      videoCalls: "✅ WebRTC video calling with Socket.IO",
      documents: "✅ Document upload, sharing & e-signatures"
    },
    availableRoutes: {
      auth: "/api/auth",
      meetings: "/api/meetings",
      calendar: "/api/calendar", 
      videoCalls: "/api/video-calls",
      documents: "/api/documents"
    },
    socketEndpoint: "/socket.io"
  });
});

// API Routes (these can be protected by auth middleware)
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/video-calls", videoCallRoutes);
app.use("/api/documents", documentRoutes);
app.use('/api', userLookupRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeRooms: VideoCallManager.rooms.size,
    activeParticipants: VideoCallManager.participants.size
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum size is 50MB.' });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ message: 'Too many files. Maximum is 10 files at once.' });
  }
  
  res.status(err.status || 500).json({ 
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: {
      auth: "/api/auth",
      meetings: "/api/meetings",
      calendar: "/api/calendar",
      videoCalls: "/api/video-calls", 
      documents: "/api/documents"
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Available routes:`);
  console.log(`   Auth: http://localhost:${PORT}/api/auth`);
  console.log(`   Meetings: http://localhost:${PORT}/api/meetings`);
  console.log(`   Calendar: http://localhost:${PORT}/api/calendar`);
  console.log(`   Video Calls: http://localhost:${PORT}/api/video-calls`);
  console.log(`   Documents: http://localhost:${PORT}/api/documents`);
  console.log(`🔌 Socket.IO endpoint: ws://localhost:${PORT}`);
  console.log(`📁 Static files: http://localhost:${PORT}/uploads`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;