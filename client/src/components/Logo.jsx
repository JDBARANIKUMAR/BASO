import React from 'react';

/**
 * BASO Minimal Monochrome Logo
 * Can be rendered statically or styled for different screens
 */
export const Logo = ({ size = 'md', className = '', showText = true, layout = 'row' }) => {
  // Size mapping
  const sizeMap = {
    sm: { icon: 24, text: 'text-lg tracking-wider font-bold' },
    md: { icon: 36, text: 'text-2xl tracking-widest font-black' },
    lg: { icon: 54, text: 'text-4xl tracking-widest font-black' },
    xl: { icon: 72, text: 'text-5xl tracking-[0.25em] font-black' },
  };

  const { icon, text } = sizeMap[size] || sizeMap.md;
  const isCol = layout === 'col';

  return (
    <div
      className={`inline-flex items-center ${isCol ? 'flex-col gap-3' : 'gap-3'} select-none ${className}`}
    >
      {/* Crisp Minimal Chat-Bubble B Icon */}
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Subtle dark rounded pill background */}
        <rect width="100" height="100" rx="24" fill="#000000" stroke="#27272a" strokeWidth="2" />
        
        {/* Stylized minimal Chat-Bubble B path */}
        <path
          d="M 28 24 
             C 28 24 64 24 64 38 
             C 64 47 52 50 52 50 
             C 66 50 72 60 72 70 
             C 72 82 56 82 56 82 
             L 28 82 Z"
          fill="#ffffff"
        />
        {/* Chat bubble cutout inside B */}
        <path
          d="M 38 48 
             C 38 42 46 42 54 42 
             C 60 42 63 46 63 51 
             C 63 57 58 60 52 60 
             L 44 60 
             L 38 66 Z"
          fill="#000000"
        />
        {/* Three dots inside bubble */}
        <circle cx="44" cy="51" r="2.2" fill="#ffffff" />
        <circle cx="51" cy="51" r="2.2" fill="#ffffff" />
        <circle cx="58" cy="51" r="2.2" fill="#ffffff" />
      </svg>

      {showText && (
        <span className={`text-white font-sans uppercase ${text}`}>
          BASO
        </span>
      )}
    </div>
  );
};

export default Logo;
