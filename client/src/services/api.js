const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const config = {
      ...options,
      headers,
      credentials: 'include', // CRITICAL: sends httpOnly refresh-token cookie
      signal: controller.signal,
    };

    try {
      let res;
      try {
        res = await fetch(url, config);
        clearTimeout(timeoutId);
      } catch (networkError) {
        clearTimeout(timeoutId);
        // This is the "Failed to fetch" scenario — network/CORS/server-down
        console.error(`[API] Network error for ${endpoint}:`, networkError);
        
        let message = 'Cannot connect to server. Please check your internet connection and try again.';
        if (networkError.name === 'AbortError') {
          message = 'Request timed out. Server might be down or unreachable.';
        }

        const err = new Error(message);
        err.status = 0;
        err.isNetworkError = true;
        throw err;
      }

      // Handle 401 Token Expired -> Attempt Silent Refresh
      if (
        res.status === 401 &&
        !endpoint.includes('/auth/refresh') &&
        !endpoint.includes('/auth/logout')
      ) {
        const refreshSuccess = await this.silentRefresh();
        if (refreshSuccess) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          try {
            res = await fetch(url, { ...config, headers, signal: undefined }); // omit signal on retry
          } catch (networkError) {
            console.error(`[API] Network error on retry for ${endpoint}:`, networkError);
            const err = new Error('Cannot connect to server. Please try again.');
            err.status = 0;
            err.isNetworkError = true;
            throw err;
          }
        }
      }

      const data = await res.json();
      if (!res.ok) {
        const error = new Error(data.message || 'Something went wrong. Please try again.');
        error.status = res.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      // Re-throw with a user-friendly message if it's a raw TypeError
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        const friendlyErr = new Error(
          'Cannot connect to server. Please check your connection and try again.'
        );
        friendlyErr.status = 0;
        friendlyErr.isNetworkError = true;
        throw friendlyErr;
      }
      throw err;
    }
  }

  async silentRefresh() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Send httpOnly cookie
        });

        if (!res.ok) {
          this.setAccessToken(null);
          return false;
        }

        const data = await res.json();
        if (data.accessToken) {
          this.setAccessToken(data.accessToken);
          return true;
        }
        return false;
      } catch (err) {
        console.warn('[API] Silent refresh failed:', err.message);
        this.setAccessToken(null);
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // Convenience methods
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
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
