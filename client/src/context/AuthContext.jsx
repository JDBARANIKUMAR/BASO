import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state via silent refresh on app load
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        // Attempt silent refresh using httpOnly refreshToken cookie
        const refreshed = await api.silentRefresh();
        if (refreshed && isMounted) {
          const res = await api.get('/auth/me');
          if (res.success && res.user && isMounted) {
            setUser(res.user);
          }
        }
      } catch (err) {
        console.log('[Auth] No active session:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = (token, userData) => {
    api.setAccessToken(token);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (e) {
      console.warn('[Auth] Logout error:', e);
    }
    api.setAccessToken(null);
    setUser(null);
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => (prev ? { ...prev, ...updatedFields } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user && user.isRegistered),
        isPendingRegistration: Boolean(user && !user.isRegistered),
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
