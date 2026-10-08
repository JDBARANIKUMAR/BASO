import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { connectDB, isDbReady } from './config/db.js';
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

// Build allowed origins list from CLIENT_URL + always allow localhost for dev.
// CLIENT_URL may contain multiple origins separated by commas (e.g. preview + prod).
const allowedOrigins = [
  ...new Set([
    ...(process.env.CLIENT_URL || '').split(',').map((o) => o.trim()).filter(Boolean),
    'https://client-teal-seven-12.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
  ]),
];

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
      const err = new Error(`CORS blocked: origin ${origin} is not allowed. Add it to CLIENT_URL on the server.`);
      err.status = 403; // so the error handler returns 403, not 500
      return callback(err);
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

// ========== REQUEST LOGGING (method, path, status, duration) ==========
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (req.path === '/api/health' && res.statusCode < 400) return; // keep pinger logs quiet
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Body parsing with limits (MUST be enabled for POST JSON bodies)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// Global API rate limit
app.use('/api', apiLimiter);

// ========== HEALTH CHECK (for uptime pingers & debugging "Failed to fetch") ==========
app.get('/api/health', async (req, res) => {
  const dbUp = await isDbReady();
  res.status(200).json({ status: 'ok', db: dbUp ? 'up' : 'down', uptime: Math.round(process.uptime()) });
});

// Legacy health path
app.get('/health', async (req, res) => {
  const dbUp = await isDbReady();
  res.status(200).json({ status: 'ok', db: dbUp ? 'up' : 'down' });
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

// ========== GLOBAL PROCESS HANDLERS (never crash silently) ==========
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
});

// Connect DB and Start Server.
// We listen on 0.0.0.0 so the hosting platform's proxy (Render/Railway) can reach us.
connectDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[BASO Server] Listening on 0.0.0.0:${PORT}`);
    console.log(`[BASO Server] Health check: /api/health`);
    console.log(`[BASO Server] Allowed origins: ${allowedOrigins.join(', ')}`);
  });
});
