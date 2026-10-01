import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Video, PhoneOff, Check } from 'lucide-react';
import { useCall } from '../context/CallContext';
import Avatar from './Avatar';

export const IncomingCallBanner = () => {
  const { callState, callType, peerUser, acceptCall, declineCall } = useCall();

  if (callState !== 'incoming' || !peerUser) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-4 inset-x-4 max-w-md mx-auto z-50 bg-zinc-950 border border-zinc-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={peerUser.name} avatar={peerUser.avatar} size="md" />
            <div className="truncate">
              <h4 className="text-white font-semibold text-base truncate">
                {peerUser.name || 'Incoming Call'}
              </h4>
              <p className="text-zinc-400 text-xs flex items-center gap-1.5 mt-0.5">
                {callType === 'video' ? (
                  <>
                    <Video size={13} className="text-white" /> Incoming Video Call...
                  </>
                ) : (
                  <>
                    <Phone size={13} className="text-white" /> Incoming Voice Call...
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons: Decline & Accept */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Decline Button */}
            <button
              onClick={declineCall}
              aria-label="Decline Call"
              className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95"
            >
              <PhoneOff size={18} />
            </button>

            {/* Accept Button */}
            <button
              onClick={acceptCall}
              aria-label="Accept Call"
              className="w-11 h-11 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center font-bold transition-all active:scale-95 shadow-md"
            >
              <Check size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default IncomingCallBanner;
