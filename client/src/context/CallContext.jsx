import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { WebRTCManager } from '../services/webrtc';
import { ringtone } from '../components/AudioRingtone';

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  // Call States: 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'
  const [callState, setCallState] = useState('idle');
  const [callType, setCallType] = useState('voice'); // 'voice' | 'video'
  const [callId, setCallId] = useState(null);
  const [peerUser, setPeerUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Audio / Video control states
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Call duration timer
  const [duration, setDuration] = useState(0);

  // Streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const webrtcRef = useRef(null);
  const timerRef = useRef(null);
  const timeoutRef = useRef(null);
  const callDurationRef = useRef(0);

  // Stop ringtone and timer helper
  const stopTimersAndRingtone = useCallback(() => {
    ringtone.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cleanup WebRTC and Media Streams
  const cleanupCall = useCallback(() => {
    stopTimersAndRingtone();
    if (webrtcRef.current) {
      webrtcRef.current.cleanup();
      webrtcRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setCallId(null);
    setPeerUser(null);
    setErrorMessage('');
    setIsMuted(false);
    setIsVideoEnabled(true);
    setDuration(0);
    callDurationRef.current = 0;
  }, [stopTimersAndRingtone]);

  // Handle call duration counter
  const startDurationTimer = useCallback(() => {
    setDuration(0);
    callDurationRef.current = 0;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      callDurationRef.current += 1;
      setDuration(callDurationRef.current);
    }, 1000);
  }, []);

  // Start Outgoing Call
  const startCall = async (recipient, type = 'voice') => {
    if (!socket || !recipient) return;
    cleanupCall();

    setCallType(type);
    setPeerUser(recipient);
    setCallState('calling');
    setErrorMessage('');

    try {
      // Initialize WebRTC
      const rtc = new WebRTCManager({
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
        },
        onIceCandidate: (candidate) => {
          socket.emit('call:ice-candidate', {
            to: recipient._id,
            candidate,
            callId: callId || undefined,
          });
        },
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            setCallState('connected');
            startDurationTimer();
          } else if (state === 'failed' || state === 'disconnected') {
            setErrorMessage('Call connection lost.');
          }
        },
      });

      webrtcRef.current = rtc;
      const stream = await rtc.initLocalStream(type);
      setLocalStream(stream);
      rtc.createPeerConnection();

      // Emit call initiate to server
      socket.emit('call:initiate', {
        recipientId: recipient._id,
        type,
      });

      // 30s auto timeout if no answer
      timeoutRef.current = setTimeout(() => {
        setErrorMessage('No answer');
        setTimeout(cleanupCall, 2000);
      }, 30000);
    } catch (err) {
      console.error('[Call] Media permission error:', err);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone/Camera permission was denied. Please allow access.'
          : 'Failed to access audio/video hardware.'
      );
      setTimeout(cleanupCall, 3500);
    }
  };

  // Accept Incoming Call
  const acceptCall = async () => {
    if (!socket || !callId || !peerUser) return;
    stopTimersAndRingtone();
    setErrorMessage('');

    try {
      const rtc = new WebRTCManager({
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
        },
        onIceCandidate: (candidate) => {
          socket.emit('call:ice-candidate', {
            to: peerUser._id,
            candidate,
            callId,
          });
        },
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            setCallState('connected');
            startDurationTimer();
          }
        },
      });

      webrtcRef.current = rtc;
      const stream = await rtc.initLocalStream(callType);
      setLocalStream(stream);
      rtc.createPeerConnection();

      socket.emit('call:accept', { callId });
      setCallState('connected');
      startDurationTimer();
    } catch (err) {
      console.error('[Call] Accept error:', err);
      setErrorMessage('Permission denied or media hardware unavailable.');
      setTimeout(cleanupCall, 2500);
    }
  };

  // Decline Incoming Call
  const declineCall = () => {
    if (socket && callId) {
      socket.emit('call:decline', { callId, reason: 'Call declined' });
    }
    cleanupCall();
  };

  // End Call (hang up)
  const endCall = () => {
    if (socket && callId) {
      socket.emit('call:end', {
        callId,
        duration: callDurationRef.current,
      });
    }
    cleanupCall();
  };

  // Toggle Mute
  const toggleMute = () => {
    if (webrtcRef.current) {
      const next = !isMuted;
      webrtcRef.current.toggleAudio(!next);
      setIsMuted(next);
    }
  };

  // Toggle Video
  const toggleVideo = () => {
    if (webrtcRef.current) {
      const next = !isVideoEnabled;
      webrtcRef.current.toggleVideo(next);
      setIsVideoEnabled(next);
    }
  };

  // Toggle Speaker / Audio output
  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => !prev);
  };

  // Socket listener for signaling
  useEffect(() => {
    if (!socket) return;

    // Caller receives initiated confirmation
    const handleInitiated = ({ callId: cId }) => {
      setCallId(cId);
    };

    // Recipient receives incoming call
    const handleIncoming = ({ callId: cId, caller, type }) => {
      if (callState !== 'idle') {
        socket.emit('call:busy', { recipientId: caller._id, callId: cId });
        return;
      }

      setCallId(cId);
      setPeerUser(caller);
      setCallType(type);
      setCallState('incoming');
      ringtone.start();

      // Auto cancel after 30s
      timeoutRef.current = setTimeout(() => {
        cleanupCall();
      }, 30000);
    };

    // Caller receives call accepted -> create & send SDP offer
    const handleAccepted = async ({ callId: cId }) => {
      stopTimersAndRingtone();
      if (webrtcRef.current && peerUser) {
        try {
          const offer = await webrtcRef.current.createOffer();
          socket.emit('call:offer', {
            to: peerUser._id,
            sdp: offer,
            callId: cId,
          });
          setCallState('connected');
          startDurationTimer();
        } catch (e) {
          console.error('[WebRTC] Create offer error:', e);
        }
      }
    };

    // Recipient receives SDP offer -> create & send SDP answer
    const handleOffer = async ({ from, sdp, callId: cId }) => {
      if (webrtcRef.current) {
        try {
          const answer = await webrtcRef.current.createAnswer(sdp);
          socket.emit('call:answer', {
            to: from,
            sdp: answer,
            callId: cId,
          });
        } catch (e) {
          console.error('[WebRTC] Handle offer error:', e);
        }
      }
    };

    // Caller receives SDP answer
    const handleAnswer = async ({ sdp }) => {
      if (webrtcRef.current) {
        await webrtcRef.current.handleAnswer(sdp);
      }
    };

    // Both receive ICE candidate
    const handleIceCandidate = async ({ candidate }) => {
      if (webrtcRef.current && candidate) {
        await webrtcRef.current.addIceCandidate(candidate);
      }
    };

    // Call declined / busy / unavailable / timeout / ended
    const handleDeclined = ({ reason }) => {
      setErrorMessage(reason || 'Call was declined.');
      setTimeout(cleanupCall, 2000);
    };

    const handleBusy = ({ reason }) => {
      setErrorMessage(reason || 'User is busy on another call.');
      setTimeout(cleanupCall, 2500);
    };

    const handleUnavailable = ({ reason }) => {
      setErrorMessage(reason || 'User is offline.');
      setTimeout(cleanupCall, 2500);
    };

    const handleTimeout = () => {
      setErrorMessage('No answer.');
      setTimeout(cleanupCall, 2000);
    };

    const handleEnded = () => {
      setCallState('ended');
      setErrorMessage('Call ended');
      setTimeout(cleanupCall, 1500);
    };

    socket.on('call:initiated', handleInitiated);
    socket.on('call:incoming', handleIncoming);
    socket.on('call:accepted', handleAccepted);
    socket.on('call:offer', handleOffer);
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:declined', handleDeclined);
    socket.on('call:busy', handleBusy);
    socket.on('call:unavailable', handleUnavailable);
    socket.on('call:timeout', handleTimeout);
    socket.on('call:ended', handleEnded);

    return () => {
      socket.off('call:initiated', handleInitiated);
      socket.off('call:incoming', handleIncoming);
      socket.off('call:accepted', handleAccepted);
      socket.off('call:offer', handleOffer);
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:declined', handleDeclined);
      socket.off('call:busy', handleBusy);
      socket.off('call:unavailable', handleUnavailable);
      socket.off('call:timeout', handleTimeout);
      socket.off('call:ended', handleEnded);
    };
  }, [socket, callState, peerUser, callId, cleanupCall, startDurationTimer, stopTimersAndRingtone]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        peerUser,
        duration,
        errorMessage,
        localStream,
        remoteStream,
        isMuted,
        isVideoEnabled,
        isSpeakerOn,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleSpeaker,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
