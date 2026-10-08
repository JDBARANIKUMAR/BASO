// ─── Central API file: the ONLY place that knows the backend URL ────────────
// VITE_API_URL is read at build time (set it in Vercel → Settings → Env Vars).
const getApiBaseUrl = () => {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (envUrl && !envUrl.includes('your-service') && !envUrl.includes('your-backend')) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'https://baso-chatbox.onrender.com/api';
};

const API_BASE_URL = getApiBaseUrl();

// Free-tier hosts (Render/Railway) sleep after inactivity. Waking can take
// 30-60s, so requests get a long timeout instead of the old 10s.
export const REQUEST_TIMEOUT_MS =
  Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS) || 45000;

// Endpoints that get ONE automatic retry after a network failure (cold start).
const RETRYABLE_ENDPOINTS = ['/auth/send-otp', '/auth/verify-otp', '/auth/refresh'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class ApiService {
  constructor() {
    this.accessToken = localStorage.getItem('baso_access_token') || null;
    this.refreshPromise = null;
  }

  setAccessToken(token) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('baso_access_token', token);
    } else {
      localStorage.removeItem('baso_access_token');
    }
  }

  getAccessToken() {
    return this.accessToken;
  }

  // Convert a raw fetch failure into a typed, user-friendly error.
  // err.kind: 'timeout' | 'network' | 'http'   err.status: HTTP status or 0
  toFriendlyError(rawErr, { timedOut } = {}) {
    if (rawErr.kind) return rawErr; // already converted

    const err = new Error(
      timedOut
        ? 'The server is taking too long to respond. It may be waking up from sleep - please try again.'
        : 'Cannot reach the server. It may be asleep or unreachable - please try again.'
    );
    err.kind = timedOut ? 'timeout' : 'network';
    err.status = 0;
    err.isNetworkError = true; // kept for backward compatibility
    err.cause = rawErr;
    return err;
  }

  async fetchWithTimeout(url, config) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...config, signal: controller.signal });
    } catch (rawErr) {
      // AbortError here means OUR timeout fired, not the user cancelling.
      throw this.toFriendlyError(rawErr, { timedOut: rawErr.name === 'AbortError' });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const allowRetry = options.retry ?? RETRYABLE_ENDPOINTS.includes(endpoint);

    const buildConfig = () => {
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }
      return {
        ...options,
        headers,
        credentials: 'include', // CRITICAL: sends httpOnly refresh-token cookie
      };
    };

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt += 1;
      try {
        let res = await this.fetchWithTimeout(url, buildConfig());

        // Handle 401 Token Expired -> Attempt Silent Refresh (once)
        if (
          res.status === 401 &&
          !endpoint.includes('/auth/refresh') &&
          !endpoint.includes('/auth/logout')
        ) {
          const refreshSuccess = await this.silentRefresh();
          if (refreshSuccess) {
            res = await this.fetchWithTimeout(url, buildConfig());
          }
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const error = new Error(
            data.message || 'Something went wrong. Please try again.'
          );
          error.kind = 'http';
          error.status = res.status;
          error.data = data;
          throw error;
        }
        return data;
      } catch (err) {
        const friendly = err.kind ? err : this.toFriendlyError(err);
        const isNetworkIssue = friendly.kind === 'network' || friendly.kind === 'timeout';

        // One automatic retry for login/refresh on network failure (cold start)
        if (isNetworkIssue && allowRetry && attempt === 1) {
          console.warn(`[API] ${endpoint} unreachable (attempt 1) - retrying once...`);
          await sleep(2000);
          continue;
        }

        if (isNetworkIssue) {
          console.error(`[API] Network error for ${endpoint}:`, friendly.message);
        }
        throw friendly;
      }
    }
  }

  async silentRefresh() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const tryOnce = async () => {
        const res = await this.fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Send httpOnly cookie
        });
        if (!res.ok) return false;
        const data = await res.json().catch(() => ({}));
        if (data.accessToken) {
          this.setAccessToken(data.accessToken);
          return true;
        }
        return false;
      };

      let ok = false;
      try {
        ok = await tryOnce();
      } catch (err) {
        console.warn('[API] Silent refresh failed (network):', err.message);
        await sleep(2000);
        try {
          ok = await tryOnce(); // one automatic retry (server waking up)
        } catch (err2) {
          console.warn('[API] Silent refresh retry failed:', err2.message);
        }
      }
      if (!ok) this.setAccessToken(null);
      return ok;
    })().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  // Convenience methods
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    });
  }

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiService();

// ─── Maps an error to one of four distinct, user-facing messages ────────────
// kind: 'invalid-number' | 'otp' | generic context for server/network errors
export const friendlyErrorMessage = (err, context = 'request') => {
  if (!err) return 'Something went wrong. Please try again.';

  if (err.kind === 'network' || err.kind === 'timeout') {
    return 'Server not reachable. If the app was idle, the server may be waking up - please wait a moment and try again.';
  }
  if (err.kind === 'http') {
    if (err.status === 400 && context === 'otp-send') {
      return `Invalid mobile number. ${err.message || ''}`.trim();
    }
    if (context === 'otp-send') {
      return err.status >= 500
        ? `Server error while sending the code. ${err.message || 'Please try again later.'}`
        : err.message || 'Could not send the OTP. Please try again.';
    }
    if (context === 'otp-verify') {
      if (err.status >= 500) {
        return `Server error while verifying the code. ${err.message || 'Please try again later.'}`;
      }
      return err.message || 'OTP failed. Invalid or expired verification code.';
    }
    if (err.status >= 500) {
      return `Server error. ${err.message || 'Please try again later.'}`;
    }
    return err.message || 'Something went wrong. Please try again.';
  }
  return err.message || 'Something went wrong. Please try again.';
};
