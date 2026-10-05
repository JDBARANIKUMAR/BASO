import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { connectDB } from './config/db.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initSocket } from './sockets/socketHandler.js';

import authRoutes from './routes/authRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import callRoutes from './routes/callRoutes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Build allowed origins list from CLIENT_URL + always allow localhost for dev
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

// Trust proxy for rate limiting behind reverse proxies (Render, Railway, etc.)
app.set('trust proxy', 1);

// ========== CORS MUST COME BEFORE ALL OTHER MIDDLEWARE ==========
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: Origin ${origin} is not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Security Headers with Helmet (placed after CORS so preflight works)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Body parsing with limits (MUST be enabled for POST JSON bodies)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// Global API rate limit
app.use('/api', apiLimiter);

// ========== HEALTH CHECK (for debugging "Failed to fetch") ==========
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Legacy health path
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ========== API Routes ==========
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls', callRoutes);

// ========== Socket.io Server Setup ==========
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
});

initSocket(io);

// 404 & Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Connect DB and Start Server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`[BASO Server] Listening on http://localhost:${PORT}`);
    console.log(`[BASO Server] Allowed origins: ${allowedOrigins.join(', ')}`);
  });
});
