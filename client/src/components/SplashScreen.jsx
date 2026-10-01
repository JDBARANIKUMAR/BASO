import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Premium Minimal SplashScreen for BASO
 * Strictly black and white with 60fps Framer Motion SVG stroke-draw,
 * soft fill + bounce, staggered letter reveal, pulsing dots, and smooth exit.
 */
export const SplashScreen = ({ onComplete }) => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Finish callback after 2.3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, reducedMotion ? 800 : 2300);

    return () => clearTimeout(timer);
  }, [onComplete, reducedMotion]);

  // Staggered letters for BASO
  const letters = ['B', 'A', 'S', 'O'];

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black select-none overflow-hidden"
    >
      <div className="flex flex-col items-center gap-6">
        {/* Animated SVG Chat-Bubble Icon */}
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
          animate={
            reducedMotion
              ? { opacity: 1 }
              : {
                  scale: [0.85, 1.05, 1],
                  opacity: 1,
                  transition: {
                    delay: 0.1,
                    duration: 0.8,
                    ease: [0.16, 1, 0.3, 1],
                  },
                }
          }
          className="relative flex items-center justify-center"
        >
          <svg
            width="88"
            height="88"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-2xl"
          >
            {/* Outer border container */}
            <motion.rect
              width="100"
              height="100"
              rx="24"
              fill="#09090b"
              stroke="#27272a"
              strokeWidth="2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            />

            {/* Stroke-draw then fill of the B Chat-bubble silhouette */}
            <motion.path
              d="M 28 24 
                 C 28 24 64 24 64 38 
                 C 64 47 52 50 52 50 
                 C 66 50 72 60 72 70 
                 C 72 82 56 82 56 82 
                 L 28 82 Z"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={
                reducedMotion
                  ? { pathLength: 1, fill: '#ffffff' }
                  : { pathLength: 0, fill: 'rgba(255, 255, 255, 0)' }
              }
              animate={
                reducedMotion
                  ? { pathLength: 1, fill: '#ffffff' }
                  : {
                      pathLength: 1,
                      fill: '#ffffff',
                      transition: {
                        pathLength: { duration: 0.7, ease: 'easeInOut' },
                        fill: { delay: 0.6, duration: 0.4, ease: 'easeOut' },
                      },
                    }
              }
            />

            {/* Inner Chat Bubble Cutout */}
            <motion.path
              d="M 38 48 
                 C 38 42 46 42 54 42 
                 C 60 42 63 46 63 51 
                 C 63 57 58 60 52 60 
                 L 44 60 
                 L 38 66 Z"
              fill="#000000"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.3 }}
            />

            {/* Three Dots inside cutout */}
            {[44, 51, 58].map((cx, i) => (
              <motion.circle
                key={cx}
                cx={cx}
                cy="51"
                r="2.2"
                fill="#ffffff"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.85 + i * 0.1,
                  duration: 0.25,
                  type: 'spring',
                  stiffness: 300,
                }}
              />
            ))}
          </svg>
        </motion.div>

        {/* Staggered App Name Reveal */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          {letters.map((letter, index) => (
            <motion.span
              key={index}
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 14 }
              }
              animate={
                reducedMotion
                  ? { opacity: 1 }
                  : {
                      opacity: 1,
                      y: 0,
                      transition: {
                        delay: 0.9 + index * 0.08,
                        duration: 0.4,
                        ease: [0.16, 1, 0.3, 1],
                      },
                    }
              }
              className="text-white text-3xl md:text-4xl font-extrabold tracking-[0.25em] font-sans"
            >
              {letter}
            </motion.span>
          ))}
        </div>

        {/* Subtle Typing Dots / Progress Indicator */}
        <div className="flex items-center gap-1.5 mt-2">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-zinc-500"
              initial={{ opacity: 0.2, scale: 0.8 }}
              animate={{
                opacity: [0.2, 1, 0.2],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                delay: 1.2 + i * 0.15,
                duration: 0.8,
                repeat: 1,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default SplashScreen;
