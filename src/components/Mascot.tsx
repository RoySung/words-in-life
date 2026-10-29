import React from 'react';

interface MascotProps {
  variant?: 'hero' | 'analyzing' | 'pointing' | 'cheering' | 'mini' | 'confused';
  className?: string;
}

export const Mascot: React.FC<MascotProps> = ({ variant = 'hero', className = 'w-24 h-24' }) => {
  if (variant === 'mini') {
    return (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Cat Face */}
        <circle cx="50" cy="50" r="38" fill="#FFFBF5" stroke="#2D2824" strokeWidth="3" />
        {/* Ears */}
        <path d="M22 30 L12 10 L35 18 Z" fill="#FFA559" stroke="#2D2824" strokeWidth="3" strokeLinejoin="round" />
        <path d="M78 30 L88 10 L65 18 Z" fill="#583E26" stroke="#2D2824" strokeWidth="3" strokeLinejoin="round" />
        <path d="M20 25 L16 14 L30 19 Z" fill="#FF8E72" />
        {/* Cheeks */}
        <circle cx="30" cy="58" r="6" fill="#FFB7B2" opacity="0.6" />
        <circle cx="70" cy="58" r="6" fill="#FFB7B2" opacity="0.6" />
        {/* Eyes */}
        <ellipse cx="37" cy="48" rx="4" ry="5" fill="#2D2824" />
        <circle cx="38" cy="46" r="1.5" fill="#FFFFFF" />
        <ellipse cx="63" cy="48" rx="4" ry="5" fill="#2D2824" />
        <circle cx="64" cy="46" r="1.5" fill="#FFFFFF" />
        {/* Nose & Mouth */}
        <path d="M48 54 L52 54 L50 57 Z" fill="#FF8E72" />
        <path d="M45 59 C47 62 49 62 50 59 C51 62 53 62 55 59" stroke="#2D2824" strokeWidth="2.5" strokeLinecap="round" />
        {/* Sparkle */}
        <path d="M84 45 L86 48 L89 50 L86 52 L84 55 L82 52 L79 50 L82 48 Z" fill="#FFA559" />
      </svg>
    );
  }

  if (variant === 'analyzing') {
    return (
      <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Outer Glow */}
        <circle cx="80" cy="85" r="55" fill="#FFF4E6" />
        {/* Ears */}
        <path d="M38 55 L22 25 L56 36 Z" fill="#FFA559" stroke="#2D2824" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M122 55 L138 25 L104 36 Z" fill="#583E26" stroke="#2D2824" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M36 48 L27 30 L48 37 Z" fill="#FFB7B2" />
        <path d="M124 48 L133 30 L112 37 Z" fill="#FFB7B2" />
        {/* Head */}
        <ellipse cx="80" cy="85" rx="52" ry="46" fill="#FFFDF9" stroke="#2D2824" strokeWidth="3.5" />
        {/* Patch */}
        <path d="M32 75 C30 55 50 48 60 52 C50 68 45 80 32 75 Z" fill="#FFA559" />
        {/* Curious big eyes with sparkles */}
        <circle cx="60" cy="80" r="11" fill="#2D2824" />
        <circle cx="58" cy="77" r="4" fill="#FFFFFF" />
        <circle cx="63" cy="83" r="2" fill="#FFFFFF" />
        <circle cx="100" cy="80" r="11" fill="#2D2824" />
        <circle cx="98" cy="77" r="4" fill="#FFFFFF" />
        <circle cx="103" cy="83" r="2" fill="#FFFFFF" />
        {/* Cheeks */}
        <ellipse cx="44" cy="94" rx="8" ry="5" fill="#FFB7B2" opacity="0.7" />
        <ellipse cx="116" cy="94" rx="8" ry="5" fill="#FFB7B2" opacity="0.7" />
        {/* Nose & mouth */}
        <path d="M77 87 L83 87 L80 91 Z" fill="#FF8E72" />
        <path d="M74 94 Q80 99 80 94 Q80 99 86 94" stroke="#2D2824" strokeWidth="3" strokeLinecap="round" />
        {/* Whiskers */}
        <path d="M30 88 L14 85 M28 94 L12 96" stroke="#2D2824" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M130 88 L146 85 M132 94 L148 96" stroke="#2D2824" strokeWidth="2.5" strokeLinecap="round" />
        {/* Magnifying Glass floating */}
        <g transform="translate(10, 20)">
          <path d="M110 85 L135 110" stroke="#FF6B2C" strokeWidth="7" strokeLinecap="round" />
          <path d="M110 85 L135 110" stroke="#2D2824" strokeWidth="3" strokeLinecap="round" />
          <circle cx="95" cy="70" r="22" fill="#E6F4FE" fillOpacity="0.8" stroke="#FF6B2C" strokeWidth="6" />
          <circle cx="95" cy="70" r="22" stroke="#2D2824" strokeWidth="3" />
          <path d="M85 62 A12 12 0 0 1 105 62" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
        </g>
        {/* Sparkles */}
        <path d="M22 45 L25 50 L30 52 L25 54 L22 59 L19 54 L14 52 L19 50 Z" fill="#FFB800" />
        <path d="M135 40 L137 43 L142 45 L137 47 L135 52 L133 47 L128 45 L133 43 Z" fill="#FF6B2C" />
      </svg>
    );
  }

  if (variant === 'cheering') {
    return (
      <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Cheering Paws */}
        <ellipse cx="40" cy="50" rx="9" ry="12" fill="#FFFDF9" stroke="#2D2824" strokeWidth="3" transform="rotate(-25 40 50)" />
        <ellipse cx="120" cy="50" rx="9" ry="12" fill="#FFFDF9" stroke="#2D2824" strokeWidth="3" transform="rotate(25 120 50)" />
        {/* Ears */}
        <path d="M42 62 L26 32 L60 43 Z" fill="#FFA559" stroke="#2D2824" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M118 62 L134 32 L100 43 Z" fill="#583E26" stroke="#2D2824" strokeWidth="3.5" strokeLinejoin="round" />
        {/* Head */}
        <ellipse cx="80" cy="90" rx="52" ry="46" fill="#FFFDF9" stroke="#2D2824" strokeWidth="3.5" />
        {/* Happy curved eyes ^^ */}
        <path d="M52 82 Q62 72 72 82" stroke="#2D2824" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M88 82 Q98 72 108 82" stroke="#2D2824" strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* Open happy mouth */}
        <path d="M72 95 Q80 110 88 95 Z" fill="#FF6B6B" stroke="#2D2824" strokeWidth="3" />
        {/* Cheeks */}
        <ellipse cx="46" cy="92" rx="9" ry="6" fill="#FFB7B2" opacity="0.8" />
        <ellipse cx="114" cy="92" rx="9" ry="6" fill="#FFB7B2" opacity="0.8" />
        {/* Floating Stars */}
        <polygon points="80,12 84,24 96,25 87,33 90,45 80,38 70,45 73,33 64,25 76,24" fill="#FFD13B" />
        <polygon points="25,20 27,27 34,27 29,32 31,39 25,35 19,39 21,32 16,27 23,27" fill="#FF8E72" />
        <polygon points="135,20 137,27 144,27 139,32 141,39 135,35 129,39 131,32 126,27 133,27" fill="#FF6B2C" />
      </svg>
    );
  }

  if (variant === 'confused') {
    return (
      <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Soft Background Cloud */}
        <circle cx="80" cy="85" r="54" fill="#FFF2E8" />
        {/* Scratching Paw */}
        <ellipse cx="118" cy="50" rx="9" ry="12" fill="#FFFDF9" stroke="#2D2824" strokeWidth="3" transform="rotate(35 118 50)" />
        {/* Ears (one drooped slightly for puzzled look) */}
        <path d="M40 58 L20 30 L54 40 Z" fill="#FFA559" stroke="#2D2824" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M120 62 L140 38 L104 46 Z" fill="#583E26" stroke="#2D2824" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M37 50 L27 35 L47 41 Z" fill="#FFB7B2" />
        {/* Head tilted slightly */}
        <ellipse cx="80" cy="88" rx="52" ry="46" fill="#FFFDF9" stroke="#2D2824" strokeWidth="3.5" transform="rotate(5 80 88)" />
        {/* Calico Patch */}
        <path d="M32 78 C30 58 50 50 60 55 C50 71 45 83 32 78 Z" fill="#FFA559" />
        {/* Puzzled Eyes - one round curious, one squiggly/wobbly */}
        <circle cx="58" cy="82" r="9" fill="#2D2824" />
        <circle cx="56" cy="79" r="3" fill="#FFFFFF" />
        {/* Spiral / Squiggly eye on right */}
        <path d="M96 78 C102 75 106 82 101 87 C96 90 92 84 97 80" stroke="#2D2824" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        {/* Cheeks */}
        <ellipse cx="44" cy="95" rx="7" ry="5" fill="#FFB7B2" opacity="0.7" />
        <ellipse cx="114" cy="95" rx="7" ry="5" fill="#FFB7B2" opacity="0.7" />
        {/* Wobbly confused mouth */}
        <path d="M72 96 Q77 92 82 96 Q87 100 92 95" stroke="#2D2824" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* Whiskers */}
        <path d="M28 90 L12 88 M27 96 L13 99" stroke="#2D2824" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M130 90 L146 88 M131 96 L145 99" stroke="#2D2824" strokeWidth="2.5" strokeLinecap="round" />
        {/* Big Question Mark Floating */}
        <g transform="translate(115, 8)">
          <circle cx="16" cy="16" r="16" fill="#FF6B2C" />
          <text x="16" y="23" textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="900" fontFamily="sans-serif">?</text>
        </g>
        {/* Small sweat drop */}
        <path d="M42 42 C40 45 40 49 44 49 C48 49 48 45 44 42 Z" fill="#60A5FA" />
      </svg>
    );
  }

  // Default: Hero Mascot holding Magnifying Glass (matching mockup)
  return (
    <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background Soft Bubble */}
      <circle cx="85" cy="95" r="68" fill="#FFF3E8" />
      {/* Tail */}
      <path d="M135 130 C155 125 165 95 155 85 C148 78 142 85 145 95 C148 105 138 120 128 125" stroke="#FFA559" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M135 130 C155 125 165 95 155 85 C148 78 142 85 145 95 C148 105 138 120 128 125" stroke="#2D2824" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* Left Ear */}
      <path d="M42 65 L26 28 L64 42 Z" fill="#FFA559" stroke="#2D2824" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M38 55 L29 34 L53 43 Z" fill="#FFB7B2" />
      {/* Right Ear (Brown Patch) */}
      <path d="M118 65 L136 28 L98 42 Z" fill="#583E26" stroke="#2D2824" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M116 55 L129 34 L105 43 Z" fill="#FFB7B2" />

      {/* Body */}
      <ellipse cx="80" cy="125" rx="42" ry="32" fill="#FFFDF9" stroke="#2D2824" strokeWidth="3.5" />
      <path d="M45 115 C42 100 65 95 72 102 C62 115 55 125 45 115 Z" fill="#FFA559" />

      {/* Head */}
      <ellipse cx="80" cy="85" rx="52" ry="45" fill="#FFFDF9" stroke="#2D2824" strokeWidth="3.5" />
      {/* Head Calico Orange Patch */}
      <path d="M34 76 C32 54 54 48 64 52 C54 68 48 82 34 76 Z" fill="#FFA559" />

      {/* Eyes */}
      <ellipse cx="58" cy="80" rx="6.5" ry="8.5" fill="#2D2824" />
      <circle cx="56" cy="77" r="3" fill="#FFFFFF" />
      <circle cx="60" cy="83" r="1.5" fill="#FFFFFF" />

      <ellipse cx="102" cy="80" rx="6.5" ry="8.5" fill="#2D2824" />
      <circle cx="100" cy="77" r="3" fill="#FFFFFF" />
      <circle cx="104" cy="83" r="1.5" fill="#FFFFFF" />

      {/* Cheeks */}
      <ellipse cx="44" cy="93" rx="8" ry="5.5" fill="#FFB7B2" opacity="0.8" />
      <ellipse cx="116" cy="93" rx="8" ry="5.5" fill="#FFB7B2" opacity="0.8" />

      {/* Cute Whiskers */}
      <path d="M30 87 L14 84 M28 93 L12 95" stroke="#2D2824" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M130 87 L146 84 M132 93 L148 95" stroke="#2D2824" strokeWidth="2.5" strokeLinecap="round" />

      {/* Nose & Mouth */}
      <path d="M77 88 L83 88 L80 92 Z" fill="#FF8E72" />
      <path d="M74 94 Q80 98 80 94 Q80 98 86 94" stroke="#2D2824" strokeWidth="3" strokeLinecap="round" />

      {/* Paw Holding Magnifying Glass */}
      <ellipse cx="120" cy="115" rx="10" ry="12" fill="#FFFDF9" stroke="#2D2824" strokeWidth="3" />
      <ellipse cx="50" cy="125" rx="10" ry="12" fill="#FFFDF9" stroke="#2D2824" strokeWidth="3" />

      {/* Magnifying Glass (Words in Life Signature) */}
      <g transform="translate(15, 10)">
        {/* Handle */}
        <path d="M125 105 L152 135" stroke="#3877EE" strokeWidth="9" strokeLinecap="round" />
        <path d="M125 105 L152 135" stroke="#2D2824" strokeWidth="3" strokeLinecap="round" />
        {/* Glass Ring */}
        <circle cx="112" cy="92" r="23" fill="#E8F4FD" fillOpacity="0.85" stroke="#3877EE" strokeWidth="7" />
        <circle cx="112" cy="92" r="23" stroke="#2D2824" strokeWidth="3" />
        {/* Glass Glare */}
        <path d="M101 82 A13 13 0 0 1 123 82" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
        {/* Gold Sparkle on Lens */}
        <path d="M112 85 L114 89 L118 91 L114 93 L112 97 L110 93 L106 91 L110 89 Z" fill="#FFB800" />
      </g>
    </svg>
  );
};
