import React from 'react';

export const Avatar = ({
  name = '',
  avatar = '',
  size = 'md',
  isOnline = false,
  showStatus = false,
  className = '',
}) => {
  const sizeMap = {
    sm: { container: 'w-9 h-9 text-xs', dot: 'w-2.5 h-2.5' },
    md: { container: 'w-12 h-12 text-sm', dot: 'w-3 h-3' },
    lg: { container: 'w-16 h-16 text-lg', dot: 'w-3.5 h-3.5' },
    xl: { container: 'w-24 h-24 text-2xl', dot: 'w-4 h-4' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  // Generate 1-2 letter initials
  const initials = (name || '')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      <div
        className={`${currentSize.container} rounded-full overflow-hidden flex items-center justify-center bg-zinc-900 border border-zinc-700 text-white font-semibold select-none`}
      >
        {avatar ? (
          <img src={avatar} alt={name || 'Avatar'} className="w-full h-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 ${currentSize.dot} rounded-full ring-2 ring-black ${
            isOnline ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-zinc-600'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

export default Avatar;
