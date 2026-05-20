import React from 'react';

export const SwynLogo: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 32 }) => {
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C59B27" />
            <stop offset="35%" stopColor="#E5C158" />
            <stop offset="70%" stopColor="#B3861B" />
            <stop offset="100%" stopColor="#866110" />
          </linearGradient>
        </defs>
        
        {/* Left Person */}
        <circle cx="54" cy="40" r="18" stroke="url(#goldGradient)" strokeWidth="16" fill="none" />
        <rect x="18" y="70" width="72" height="112" rx="36" stroke="url(#goldGradient)" strokeWidth="16" fill="none" />

        {/* Right Person */}
        <circle cx="146" cy="40" r="18" stroke="url(#goldGradient)" strokeWidth="16" fill="none" />
        <rect x="110" y="70" width="72" height="112" rx="36" stroke="url(#goldGradient)" strokeWidth="16" fill="none" />

        {/* Center Person (Drawn last for the correct stacked overlapping effect) */}
        <circle cx="100" cy="26" r="18" stroke="#F05A28" strokeWidth="16" fill="none" />
        <rect x="64" y="58" width="72" height="128" rx="36" stroke="#F05A28" strokeWidth="16" fill="none" />
      </svg>
      <span className="text-xl font-black tracking-tight uppercase">
        <span className="text-swyn-orange">SWYN</span>
        <span className="text-swyn-gold">Match</span>
      </span>
    </div>
  );
};

export default SwynLogo;
