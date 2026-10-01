import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, PhoneOff } from 'lucide-react';
import { useCall } from '../context/CallContext';
import Avatar from './Avatar';

export const CallModal = () => {
  const {
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
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Bind local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callType]);

  // Bind remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callType]);

  // Only display if active call (calling, connected, or ended with message)
  if (callState === 'idle' || callState === 'incoming') {
    return null;
  }

  // Format MM:SS
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col justify-between bg-black text-white select-none overflow-hidden"
      >
        {/* Hidden audio element for voice calls */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {/* Video Call Background or Remote Stream */}
        {callType === 'video' && remoteStream ? (
          <div className="absolute inset-0 z-0">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}

        {/* Local Video Picture-in-Picture (for video call) */}
        {callType === 'video' && localStream && isVideoEnabled ? (
          <div className="absolute top-6 right-6 z-20 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-900 shadow-2xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
          </div>
        ) : null}

        {/* Top Header: Peer info & Timer */}
        <div className="relative z-10 pt-12 pb-6 px-6 flex flex-col items-center text-center bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            {peerUser?.name || 'Call'}
          </h2>
          <p className="text-sm font-medium text-zinc-400 mt-1">
            {errorMessage ? (
              <span className="text-white font-semibold">{errorMessage}</span>
            ) : callState === 'calling' ? (
              'Ringing...'
            ) : (
              formatTimer(duration)
            )}
          </p>
        </div>

        {/* Center: Avatar view for Voice Call or when remote video is not yet attached */}
        {(!remoteStream || callType === 'voice') && (
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center -mt-10">
            <div className="relative">
              {/* Subtle pulse animation around avatar during calling / connection */}
              <div className="absolute inset-0 rounded-full border border-white/20 animate-ping" />
              <div className="absolute -inset-4 rounded-full border border-zinc-700/50" />
              <Avatar
                name={peerUser?.name}
                avatar={peerUser?.avatar}
                size="xl"
                className="relative z-10 shadow-2xl"
              />
            </div>

            <p className="mt-8 text-xs uppercase tracking-widest text-zinc-500 font-semibold">
              {callType === 'video' ? 'Video Call' : 'Voice Call'}
            </p>
          </div>
        )}

        {/* Bottom Call Controls (Strictly: Mute, Camera on/off, Speaker, End Call) */}
        <div className="relative z-10 pb-12 pt-6 px-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-center gap-5 sm:gap-8">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 border ${
              isMuted
                ? 'bg-white text-black border-white'
                : 'bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800'
            }`}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* Camera On/Off (Only for video calls) */}
          {callType === 'video' && (
            <button
              onClick={toggleVideo}
              aria-label={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 border ${
                !isVideoEnabled
                  ? 'bg-white text-black border-white'
                  : 'bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              {isVideoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
            </button>
          )}

          {/* Speaker Button */}
          <button
            onClick={toggleSpeaker}
            aria-label={isSpeakerOn ? 'Turn speaker off' : 'Turn speaker on'}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 border ${
              !isSpeakerOn
                ? 'bg-white text-black border-white'
                : 'bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800'
            }`}
          >
            {isSpeakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </button>

          {/* End Call Button */}
          <button
            onClick={endCall}
            aria-label="End Call"
            className="w-14 h-14 rounded-full bg-white text-black border border-white hover:bg-zinc-200 flex items-center justify-center transition-all active:scale-90 shadow-xl"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CallModal;
