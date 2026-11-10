import React from 'react';

interface AppLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBadge?: boolean;
}

const SIZE_MAP: Record<NonNullable<AppLogoProps['size']>, string> = {
  xs: 'w-7 h-7 rounded-lg',
  sm: 'w-9 h-9 rounded-xl',
  md: 'w-11 h-11 sm:w-12 sm:h-12 rounded-2xl',
  lg: 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl',
  xl: 'w-20 h-20 rounded-3xl',
};

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  className = '',
  showBadge = false,
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none shadow-md border border-[#d4af37]/40 bg-gradient-to-br from-[#0d2622] via-[#0b1720] to-[#070c12] overflow-hidden ${SIZE_MAP[size]} ${className}`}
      title="الموسوعة الإباضية الشاملة"
    >
      <svg
        viewBox="0 0 512 512"
        className="w-full h-full p-0.5"
        aria-label="شعار الموسوعة الإباضية الشاملة"
      >
        <defs>
          <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fae08c" />
            <stop offset="45%" stopColor="#dfb852" />
            <stop offset="100%" stopColor="#9e7419" />
          </linearGradient>
          <linearGradient id="logoEmerald" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="logoPageR" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#e7c97a" />
            <stop offset="100%" stopColor="#fff8e7" />
          </linearGradient>
          <linearGradient id="logoPageL" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fff8e7" />
            <stop offset="100%" stopColor="#e7c97a" />
          </linearGradient>
        </defs>

        {/* Subtle 8-Pointed Star Watermark */}
        <g opacity="0.16" stroke="url(#logoGold)" strokeWidth="5" fill="none">
          <rect x="126" y="126" width="260" height="260" rx="14" />
          <rect
            x="126"
            y="126"
            width="260"
            height="260"
            rx="14"
            transform="rotate(45 256 256)"
          />
        </g>

        {/* Mihrab Arch */}
        <path
          d="M104 402 L104 205 C104 122 178 72 256 44 C334 72 408 122 408 205 L408 402"
          fill="none"
          stroke="url(#logoGold)"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.78"
        />

        {/* Star of Knowledge */}
        <path
          d="M256 68 L264 90 L288 90 L269 104 L276 126 L256 113 L236 126 L243 104 L224 90 L248 90 Z"
          fill="url(#logoGold)"
        />

        {/* Knowledge Rays */}
        <g stroke="url(#logoGold)" strokeWidth="8" strokeLinecap="round" opacity="0.85">
          <line x1="256" y1="138" x2="256" y2="170" />
          <line x1="204" y1="148" x2="218" y2="176" />
          <line x1="308" y1="148" x2="294" y2="176" />
        </g>

        {/* Emerald Book Cover Base */}
        <path
          d="M72 222 C136 204 210 220 256 250 C302 220 376 204 440 222 L440 390 C376 372 302 388 256 416 C210 388 136 372 72 390 Z"
          fill="url(#logoEmerald)"
          stroke="url(#logoGold)"
          strokeWidth="12"
          strokeLinejoin="round"
        />

        {/* Open Manuscript Pages */}
        <path
          d="M90 200 C148 182 214 198 256 230 L256 394 C214 364 148 348 90 366 Z"
          fill="url(#logoPageL)"
          stroke="url(#logoGold)"
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <path
          d="M422 200 C364 182 298 198 256 230 L256 394 C298 364 364 348 422 366 Z"
          fill="url(#logoPageR)"
          stroke="url(#logoGold)"
          strokeWidth="8"
          strokeLinejoin="round"
        />

        {/* Center Spine */}
        <line
          x1="256"
          y1="226"
          x2="256"
          y2="398"
          stroke="#9e7419"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Manuscript Text Lines */}
        <g stroke="#784f04" strokeWidth="10" strokeLinecap="round" opacity="0.88">
          <line x1="388" y1="242" x2="288" y2="258" />
          <line x1="388" y1="280" x2="288" y2="296" />
          <line x1="388" y1="318" x2="288" y2="334" />
          <line x1="124" y1="242" x2="224" y2="258" />
          <line x1="124" y1="280" x2="224" y2="296" />
          <line x1="124" y1="318" x2="224" y2="334" />
        </g>

        {/* Traditional Rehal Stand */}
        <path
          d="M140 444 L256 400 L372 444"
          fill="none"
          stroke="url(#logoGold)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showBadge && (
        <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0b1720]" />
      )}
    </div>
  );
};
