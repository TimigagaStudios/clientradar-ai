import React from 'react';

type LogoProps = {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
};

/**
 * ClientRadar AI â€“ Radar mark
 * Uses /icons/icon-192.png â€“ white radar on orange
 * Swap to an SVG later if you want crisper scaling
 */
export const LogoMark: React.FC<{ size?: number; className?: string; rounded?: boolean }> = ({
  size = 44,
  className = '',
  rounded = true,
}) => {
  return (
    <img
      src="/icons/icon-192.png"
      alt="ClientRadar"
      width={size}
      height={size}
      className={`${rounded ? 'rounded-2xl' : ''} object-cover ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
};

const Logo: React.FC<LogoProps> = ({
  size = 44,
  className = '',
  showText = true,
  textClassName = '',
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      {showText && (
        <span className={`text-xl font-black tracking-tight text-[var(--text-primary)] ${textClassName}`}>
          ClientRadar
        </span>
      )}
    </div>
  );
};

export default Logo;