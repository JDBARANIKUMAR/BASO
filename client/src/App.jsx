import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';

import SplashScreen from './components/SplashScreen';
import IncomingCallBanner from './components/IncomingCallBanner';
import CallModal from './components/CallModal';

import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isPendingRegistration, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isPendingRegistration) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Main App Contents with Splash Handling and Router
const AppContent = () => {
  const { isAuthenticated, isPendingRegistration, loading } = useAuth();

  // Check if splash has already been shown in this browser session
  const [splashFinished, setSplashFinished] = useState(() => {
    return Boolean(sessionStorage.getItem('baso_splash_shown'));
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem('baso_splash_shown', 'true');
    setSplashFinished(true);
  };

  // Show splash animation on initial session visit
  if (!splashFinished) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Brief loader if auth check is still settling after splash
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      {/* Global Call Overlays */}
      <IncomingCallBanner />
      <CallModal />

      <Routes>
        {/* Auth Route */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : isPendingRegistration ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <AuthPage />
            )
          }
        />

        {/* Onboarding Route */}
        <Route
          path="/onboarding"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <OnboardingPage />
            )
          }
        />

        {/* Protected Home Route */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        {/* Protected Chat Route */}
        <Route
          path="/chat/:friendId"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <CallProvider>
          <AppContent />
        </CallProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
