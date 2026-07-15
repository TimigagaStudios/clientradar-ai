import React from 'react';
import './assistant.css';

export type OrbState = 'boot' | 'idle' | 'listening' | 'thinking' | 'speaking';

interface AgentOrbProps {
  /** Visual/reactive state of the orb */
  state?: OrbState;
  /** Diameter in px */
  size?: number;
  className?: string;
}

/** Small boot particle spiral â€” nodes condense inward toward the orb. */
const ParticleSpiral: React.FC<{ uid: string }> = ({ uid }) => {
  const nodes = Array.from({ length: 12 });
  return (
    <div className="cr-spiral" aria-hidden>
      {nodes.map((_, i) => {
        const angle = (i / nodes.length) * 360;
        const radius = 40 + (i % 3) * 16;
        return (
          <i
            key={`${uid}-p${i}`}
            style={
              {
                ['--angle' as any]: `${angle}deg`,
                ['--radius' as any]: `${radius}px`,
                animationDelay: `${(i / nodes.length) * 1.8}s`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
};

/**
 * AgentOrb â€” the Executive Agent's "body".
 * Tier 1 implementation: SVG + feTurbulence organic morph approximates the
 * claymorphism concept. Upgrade path: swap inner <svg> for a Spline/Three.js
 * sphere (see Assistant UI Design Spec, Tier 2).
 */
const AgentOrb: React.FC<AgentOrbProps> = ({
  state = 'idle',
  size = 180,
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const filterId = `cr-morph-${uid}`;
  const gradId = `cr-clay-${uid}`;

  return (
    <div
      className={`cr-orb cr-orb--${state} ${className}`}
      style={{ ['--cr-size' as any]: `${size}px` } as React.CSSProperties}
      role="img"
      aria-label={`Assistant ${state}`}
    >
      <div className="cr-orb__glow" />
      <div className="cr-orb__ao" />

      <span className="cr-ring cr-ring--1" />
      <span className="cr-ring cr-ring--2" />
      <span className="cr-ring cr-ring--3" />

      {state === 'boot' && <ParticleSpiral uid={uid} />}

      <svg className="cr-orb__svg" viewBox="0 0 200 200" width="100%" height="100%">
        <defs>
          <radialGradient id={gradId} cx="38%" cy="32%" r="78%">
            <stop offset="0%" stopColor="#FFD8B0" />
            <stop offset="34%" stopColor="var(--accent, #FF7A00)" />
            <stop offset="100%" stopColor="#6E2600" />
          </radialGradient>
          <filter id={filterId} x="-45%" y="-45%" width="190%" height="190%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="4" result="n">
              <animate
                attributeName="baseFrequency"
                dur="16s"
                values="0.012 0.02; 0.02 0.012; 0.012 0.02"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="20" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        <g className="cr-orb__core" filter={`url(#${filterId})`}>
          <circle cx="100" cy="100" r="66" fill={`url(#${gradId})`} />
        </g>
        <ellipse className="cr-orb__sheen" cx="78" cy="72" rx="22" ry="13" fill="#fff" opacity="0.26" />
      </svg>
    </div>
  );
};

export default AgentOrb;