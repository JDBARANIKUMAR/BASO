import { io } from 'socket.io-client';
import { api } from './api';

// Backend origin for sockets. VITE_SOCKET_URL wins; otherwise derive it from
// VITE_API_URL (strip the trailing /api) so only ONE env var is needed.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || API_URL.replace(/\/api\/?$/, '');

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    const token = api.getAccessToken();
    if (!token) return null;

    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true,
      // polling first: survives proxies/CDNs on Render/Vercel; upgrades to
      // websocket automatically when available.
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity, // keep retrying forever (sleeping server)
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected as', this.socket.id);
    });

    this.socket.on('connect_error', async (err) => {
      console.warn('[Socket] Connection error:', err.message);
      if (err.message.includes('Authentication') || err.message.includes('jwt')) {
        const refreshed = await api.silentRefresh();
        if (refreshed && this.socket) {
          this.socket.auth.token = api.getAccessToken();
          this.socket.connect();
        }
      }
    });

    return this.socket;
  }

  getSocket() {
    if (!this.socket || !this.socket.connected) {
      return this.connect();
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
