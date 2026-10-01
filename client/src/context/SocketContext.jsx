import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { socketService } from '../services/socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  useEffect(() => {
    if (!isAuthenticated || !user) {
      socketService.disconnect();
      setSocket(null);
      setOnlineUserIds(new Set());
      return;
    }

    const s = socketService.connect();
    setSocket(s);

    if (s) {
      // Receive list of users currently online
      s.on('users:online_list', (ids) => {
        setOnlineUserIds(new Set(ids));
      });

      // User presence status updates
      s.on('user:status', ({ userId, isOnline }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          if (isOnline) {
            next.add(userId.toString());
          } else {
            next.delete(userId.toString());
          }
          return next;
        });
      });
    }

    return () => {
      if (s) {
        s.off('users:online_list');
        s.off('user:status');
      }
    };
  }, [isAuthenticated, user]);

  const isUserOnline = (targetId) => {
    if (!targetId) return false;
    return onlineUserIds.has(targetId.toString());
  };

  return (
    <SocketContext.Provider value={{ socket, isUserOnline, onlineUserIds }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
