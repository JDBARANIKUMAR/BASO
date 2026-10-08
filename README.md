# BASO — Premium Minimal Real-Time Chat & WebRTC Web App

A minimalist, high-performance real-time chat and voice/video calling web application built on **React (Vite) + Express/Node.js + PostgreSQL (Neon) via Prisma**, with **Socket.io** and **WebRTC**.

Designed strictly in **black and white with neutral greys** and zero colors or gradients, following an ultra-clean aesthetic with **Inter** typography, generous spacing, and 60fps micro-animations.

---

## ✦ Table of Contents
1. [Key Features](#key-features)
2. [Tech Stack](#tech-stack)
3. [Monochrome Design System & Intro Splash](#monochrome-design-system--intro-splash)
4. [Database Schema (Prisma)](#database-schema-prisma)
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
| **Database** | PostgreSQL (Neon) with Prisma ORM |
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

## ✦ Database Schema (Prisma)

The single source of truth is [`server/prisma/schema.prisma`](server/prisma/schema.prisma) (models: `User`, `Otp`, `Message`, `Call`, `Friendship`).

```bash
cd server
npx prisma db push      # apply the schema to your database
npx prisma studio       # optional: browse data visually
```

> OTP rows are deleted as soon as they are verified or expired (app-level cleanup instead of MongoDB TTL indexes).

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
- A PostgreSQL database — [Neon](https://neon.tech) free tier, or a local PostgreSQL instance.

### 2. Backend Setup
```bash
cd server
npm install
cp .env.example .env    # then fill in DATABASE_URL + JWT secrets
npx prisma db push      # create the tables
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

**Order: Database → Backend → Frontend → update the final URLs.**

### 1. Database: Neon (PostgreSQL)
1. Create a free project on [Neon](https://neon.tech).
2. Copy the **pooled** connection string (it ends with `?sslmode=require`).
3. Keep the branch **active** — Neon auto-pauses idle branches, which makes the API fail with connection errors.
4. Push the schema once from your machine: `cd server && DATABASE_URL=<your-url> npx prisma db push`.

### 2. Backend: Render or Railway
1. Push your repository to GitHub.
2. Create a **Web Service** with root directory `server/` (see `server/render.yaml`).
3. Build Command: `npm install && npx prisma generate && npx prisma db push`
4. Start Command: `npm start`
5. Health Check Path: `/api/health`
6. Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: assigned by the platform (do not hardcode)
   - `CLIENT_URL`: `https://your-frontend.vercel.app` (comma-separate multiple origins)
   - `DATABASE_URL`: `<your Neon pooled connection string>`
   - `DIRECT_URL`: `<your Neon direct connection string>`
   - `ACCESS_TOKEN_SECRET`: `<generate: openssl rand -hex 48>`
   - `REFRESH_TOKEN_SECRET`: `<generate: openssl rand -hex 48>`
   - Optional Twilio SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
7. Verify: open `https://your-backend.onrender.com/api/health` → `{"status":"ok",...}`.

### 3. Frontend: Vercel or Netlify
1. Import your Git repository and set **Root Directory** to `client`.
2. Framework Preset: `Vite`. Build Command: `npm run build`. Output Directory: `dist`.
3. Environment Variables (read at **build** time — always `https`):
   - `VITE_API_URL`: `https://your-backend.onrender.com/api`
   - `VITE_SOCKET_URL`: `https://your-backend.onrender.com`
   - Optional: `VITE_REQUEST_TIMEOUT_MS` (default `45000`)
4. SPA routing (page refresh must not 404):
   - Vercel: handled by `client/vercel.json` rewrites.
   - Netlify: handled by `client/public/_redirects` (`/*  /index.html  200`).
5. Click **Deploy**.

### 4. Update the final URLs (after both are live)
- Backend `CLIENT_URL` = your final frontend URL → redeploy backend.
- Frontend `VITE_API_URL` / `VITE_SOCKET_URL` = your final backend URL → redeploy frontend.

### 5. Free-tier sleep behaviour
- Render/Railway free instances sleep after ~15 min idle; the first request then takes **30–60 s**.
- The app already waits up to **45 s**, shows “Waking up the server, please wait…”, and **retries once** automatically on login.
- Keep it awake with a free pinger hitting `GET /api/health` every 10 minutes: [UptimeRobot](https://uptimerobot.com), [cron-job.org](https://cron-job.org), or Better Stack.

---

## ✦ Final Deployment Test Checklist

1. `https://your-backend.onrender.com/api/health` opens in the browser → `{"status":"ok","db":"up"}`.
2. Open the deployed frontend → send OTP → code arrives (Twilio) or shows as Dev Code (no Twilio).
3. Verify OTP → lands on onboarding/chat.
4. Refresh the page → still logged in (silent refresh + cookie).
5. Send a message → ticks go ✓ / ✓✓, second browser/session receives it in real time.
6. Search a friend by full `+<country-code>` number and add them.
7. Test on a real phone using the deployed link (HTTPS required for mic/camera).
8. Hard-refresh a deep link (e.g. `/chat`) → no 404.
