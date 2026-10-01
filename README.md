# BASO — Premium Minimal Real-Time Chat & WebRTC Web App

A minimalist, high-performance real-time chat and voice/video calling web application built on the **MERN** stack (MongoDB, Express, React, Node.js) with **Socket.io** and **WebRTC**.

Designed strictly in **black and white with neutral greys** and zero colors or gradients, following an ultra-clean aesthetic with **Inter** typography, generous spacing, and 60fps micro-animations.

---

## ✦ Table of Contents
1. [Key Features](#key-features)
2. [Tech Stack](#tech-stack)
3. [Monochrome Design System & Intro Splash](#monochrome-design-system--intro-splash)
4. [Mongoose Schemas](#mongoose-schemas)
5. [API Routes](#api-routes)
6. [Socket.io Events](#socketio-events)
7. [WebRTC Architecture & Edge Cases](#webrtc-architecture--edge-cases)
8. [Local Development Setup](#local-development-setup)
9. [Production Deployment Guide](#production-deployment-guide)

---

## ✦ Key Features

- **Strictly Mobile Number + OTP Auth**:
  - No email, passwords, or social clutter.
  - Verification codes with 30s resend timer countdown, 5-minute expiry, and rate limiting.
  - Automatic new user onboarding (Name + Photo) vs direct login for existing users.
- **Persistent Login & Silent Refresh**:
  - Short-lived JWT Access Token (15m) in memory/header.
  - Long-lived Refresh Token (30d) stored securely in `httpOnly`, `SameSite` cookies with silent background rotation.
- **Home & Friends**:
  - Real-time online/offline presence indicators.
  - Search registered users by mobile number and add with one tap.
  - Last message preview, timestamps, and conversation ordering.
- **Real-Time Chat**:
  - Sent bubbles (pure black with white text), received bubbles (pure white with black border and black text).
  - Sent (`✓`), delivered (`✓✓`), and read (`✓✓`) status ticks.
  - Infinite upward pagination on scroll.
  - Offline message caching via local storage for instant loading.
- **Voice & Video Calls (WebRTC)**:
  - Full-screen monochrome call interface with peer name, photo, duration timer (`00:00`), mute mic, camera on/off, speaker toggle, and end call.
  - Incoming call notification banner with Accept & Decline buttons and synthesized Web Audio chime ringtone (no missing audio assets).
  - Handles 30s timeout, user busy, permissions denied, reconnection, and strict media track cleanup.
- **PWA Ready**:
  - Standalone web app manifest, mobile-first responsive layout, installable on iOS and Android browsers.

---

## ✦ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 (Vite), Tailwind CSS, Framer Motion, Lucide Icons |
| **Backend** | Node.js, Express.js (REST API), Socket.io |
| **Database** | MongoDB with Mongoose ODM |
| **Real-time** | Socket.io (chat, presence, call signaling) |
| **Calling** | WebRTC (STUN + TURN peer-to-peer audio/video) |
| **Authentication** | JWT (Access Tokens + httpOnly Cookie Refresh Tokens) |
| **Security** | Helmet, CORS with credentials, express-rate-limit |

---

## ✦ Monochrome Design System & Intro Splash

### Animated Intro Logo (`SplashScreen.jsx` & `Logo.jsx`)
1. **SVG Stroke-Draw**: The custom chat-bubble `B` draws its outer outline using `pathLength: 0 -> 1`.
2. **Soft Fill & Bounce**: The silhouette fills smoothly into solid white with a spring scale-up.
3. **Staggered Letter Reveal**: Each letter of **BASO** slides up with a staggered delay.
4. **Typing Dots**: Three monochrome dots pulse once underneath as a subtle loader.
5. **Smart Session Cache**: Stored in `sessionStorage('baso_splash_shown')` so it runs once per session, transitioning directly to Home if authenticated or Login if not.
6. **Accessibility**: Checks `(prefers-reduced-motion: reduce)` to display a simple fade-in.

---

## ✦ Mongoose Schemas

### 1. `User` (`server/src/models/User.js`)
```javascript
{
  mobile: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: '', trim: true },
  avatar: { type: String, default: '' },
  isRegistered: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  refreshToken: { type: String, default: null },
  timestamps: true
}
```

### 2. `Friendship` (`server/src/models/Friendship.js`)
```javascript
{
  user: { type: ObjectId, ref: 'User', required: true, index: true },
  friend: { type: ObjectId, ref: 'User', required: true, index: true },
  lastMessage: { type: ObjectId, ref: 'Message', default: null },
  lastInteractionAt: { type: Date, default: Date.now, index: true },
  timestamps: true
}
// Compound unique index: { user: 1, friend: 1 }
```

### 3. `Message` (`server/src/models/Message.js`)
```javascript
{
  sender: { type: ObjectId, ref: 'User', required: true, index: true },
  recipient: { type: ObjectId, ref: 'User', required: true, index: true },
  content: { type: String, required: true, trim: true },
  tempId: { type: String, default: null },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  deliveredAt: { type: Date, default: null },
  readAt: { type: Date, default: null },
  timestamps: true
}
```

### 4. `Call` (`server/src/models/Call.js`)
```javascript
{
  caller: { type: ObjectId, ref: 'User', required: true, index: true },
  recipient: { type: ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['voice', 'video'], required: true },
  status: { type: String, enum: ['missed', 'declined', 'completed', 'busy', 'no_answer', 'ongoing'] },
  duration: { type: Number, default: 0 },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  timestamps: true
}
```

### 5. `Otp` (`server/src/models/Otp.js`)
```javascript
{
  mobile: { type: String, required: true, index: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // MongoDB TTL auto-cleanup
  resendAvailableAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  timestamps: true
}
```

---

## ✦ API Routes

### Authentication (`/api/auth`)
- `POST /send-otp` — Request 6-digit OTP (rate limited to 10 req/15min).
- `POST /verify-otp` — Verify code, generate access token & set refresh cookie. Returns `isNewUser: true/false`.
- `POST /complete-profile` — Set `name` and optional `avatar` for new accounts.
- `POST /refresh` — Silent token refresh with token rotation.
- `GET  /me` — Return current authenticated user profile.
- `POST /logout` — Revoke refresh token and clear cookies.

### Friends (`/api/friends`)
- `GET  /` — List user's friends with last message preview and online status.
- `GET  /search?mobile=+...` — Look up registered user by mobile.
- `POST /add` — Add user as friend.

### Messages (`/api/messages`)
- `GET  /:friendId?before=ISO_DATE&limit=40` — Fetch conversation history with pagination.
- `POST /send` — Send message (also supported via real-time WebSocket).
- `PUT  /read` — Mark incoming conversation messages as read.

### Calls (`/api/calls`)
- `POST /log` — Record call completion metadata and duration.
- `GET  /recent` — Fetch recent call logs.

---

## ✦ Socket.io Events

### Presence & Client Initialization
- **Client to Server**: Authenticates during handshake via `auth.token`.
- **Server to Client**:
  - `users:online_list` — Initial array of online user IDs.
  - `user:status` — Real-time `{ userId, isOnline, lastSeen }` broadcast.

### Chat Events
- `message:send` (`client -> server`) — Relays message to recipient, updates DB.
- `message:receive` (`server -> client`) — Delivers message to active recipient.
- `message:read` (`client -> server`) — Recipient viewing messages.
- `message:read_ack` (`server -> client`) — Informs sender their message was read.

### WebRTC Call Signaling
| Event | Origin | Purpose |
|---|---|---|
| `call:initiate` | Caller -> Server | Request call with `{ recipientId, type }` |
| `call:incoming` | Server -> Recipient | Triggers incoming call modal + chime |
| `call:accept` | Recipient -> Server | Confirms answer, starts WebRTC handshake |
| `call:decline` | Recipient -> Server | Rejects call with reason |
| `call:busy` | Server -> Caller | Recipient is engaged on another call |
| `call:timeout` | Server -> Both | 30-second no-answer auto termination |
| `call:offer` | Peer -> Peer | Relays SDP offer |
| `call:answer` | Peer -> Peer | Relays SDP answer |
| `call:ice-candidate` | Peer -> Peer | Relays ICE candidates |
| `call:end` | Peer -> Server | Hangs up and stops audio/video tracks |

---

## ✦ Local Development Setup

### 1. Prerequisites
- Node.js (v18+)
- MongoDB running locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas URI.

### 2. Backend Setup
```bash
cd server
npm install
# Ensure .env exists (default values work out of the box with local MongoDB):
npm run dev
```
Server will start on `http://localhost:5000`.

### 3. Frontend Setup
In a second terminal:
```bash
cd client
npm install
npm run dev
```
Client will start on `http://localhost:5173`.

> **Note on OTP Testing in Development**: When running locally without Twilio credentials, the backend generates a valid 6-digit code, prints it in the server terminal, and returns it in `devCode` for rapid one-click testing.

---

## ✦ Production Deployment Guide

### Database: MongoDB Atlas
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a database user and whitelist all IPs (`0.0.0.0/0`).
3. Copy the connection string:
   `mongodb+srv://<user>:<password>@cluster0.mongodb.net/baso_chat?retryWrites=true&w=majority`

### Backend: Render or Railway
1. Push your repository to GitHub.
2. In [Render](https://render.com) or [Railway](https://railway.app), create a new **Web Service** pointing to the `server/` directory.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Configure Environment Variables:
   - `PORT`: `5000` (or leave default assigned by platform)
   - `NODE_ENV`: `production`
   - `CLIENT_URL`: `https://your-baso-frontend.vercel.app`
   - `MONGODB_URI`: `<Your MongoDB Atlas URI>`
   - `ACCESS_TOKEN_SECRET`: `<Generate strong 64-char random string>`
   - `REFRESH_TOKEN_SECRET`: `<Generate strong 64-char random string>`
   - Optional Twilio SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

### Frontend: Vercel or Netlify
1. In [Vercel](https://vercel.com), import your Git repository.
2. Set Root Directory to `client`.
3. Framework Preset: `Vite`.
4. Environment Variables:
   - `VITE_API_URL`: `https://your-baso-backend.onrender.com/api`
   - `VITE_SOCKET_URL`: `https://your-baso-backend.onrender.com`
5. Click **Deploy**.
