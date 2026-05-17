import React from 'react';

export default function SwynLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#D8BE73" />
          <stop offset="100%" stopColor="#A88235" />
        </linearGradient>
      </defs>
      
      {/* Gold Pills */}
      <rect x="7" y="32" width="34" height="56" rx="17" stroke="url(#goldGrad)" strokeWidth="6"/>
      <rect x="59" y="32" width="34" height="56" rx="17" stroke="url(#goldGrad)" strokeWidth="6"/>
      
      {/* Orange center Pill */}
      <rect x="30" y="25" width="40" height="73" rx="20" stroke="#F15A29" strokeWidth="6"/>
      
      {/* Gold Circles */}
      <circle cx="24" cy="18" r="6" stroke="url(#goldGrad)" strokeWidth="6"/>
      <circle cx="76" cy="18" r="6" stroke="url(#goldGrad)" strokeWidth="6"/>
      
      {/* Orange Circle */}
      <circle cx="50" cy="10" r="7" stroke="#F15A29" strokeWidth="6"/>
    </svg>
  );
}
