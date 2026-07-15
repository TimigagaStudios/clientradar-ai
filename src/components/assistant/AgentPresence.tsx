import React, { useId, useMemo } from 'react';
import './agentPresence.css';

export type AgentPresenceState =
  | 'boot'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking';

interface AgentPresenceProps {
  state?: AgentPresenceState;
  size?: number;
  className?: string;
}

interface RingDefinition {
  radius: number;
  count: number;
  dotRadius: number;
  opacity: number;
  speed: number;
  direction: 'normal' | 'reverse';
  offset: number;
}

interface DotDefinition {
  id: string;
  x: number;
  y: number;
  radius: number;
  delay: number;
}

interface RenderRing extends RingDefinition {
  dots: DotDefinition[];
}

const VIEWBOX_SIZE = 360;
const CENTER = VIEWBOX_SIZE / 2;

// Exact hierarchy requested: the center rings carry the largest dots and each
// outward ring progressively resolves into smaller, micro-fine particles.
const RINGS: RingDefinition[] = [
  {
    radius: 28,
    count: 8,
    dotRadius: 7.8,
    opacity: 1,
    speed: 13.0,
    direction: 'normal',
    offset: 0.16,
  },
  {
    radius: 50,
    count: 12,
    dotRadius: 6.8,
    opacity: 0.98,
    speed: 15.5,
    direction: 'reverse',
    offset: 0.38,
  },
  {
    radius: 73,
    count: 17,
    dotRadius: 5.6,
    opacity: 0.94,
    speed: 18.0,
    direction: 'normal',
    offset: 0.06,
  },
  {
    radius: 96,
    count: 22,
    dotRadius: 4.3,
    opacity: 0.84,
    speed: 21.0,
    direction: 'reverse',
    offset: 0.28,
  },
  {
    radius: 119,
    count: 28,
    dotRadius: 2.9,
    opacity: 0.66,
    speed: 24.5,
    direction: 'normal',
    offset: 0.12,
  },
  {
    radius: 141,
    count: 36,
    dotRadius: 1.65,
    opacity: 0.38,
    speed: 29.0,
    direction: 'reverse',
    offset: 0.32,
  },
];

function buildRings(): RenderRing[] {
  return RINGS.map((ring, ringIndex) => {
    const dots = Array.from({ length: ring.count }, (_, dotIndex) => {
      const progress = dotIndex / ring.count;
      const theta = progress * Math.PI * 2 + ring.offset;

      return {
        id: `${ringIndex}-${dotIndex}`,
        x: CENTER + ring.radius * Math.cos(theta),
        y: CENTER + ring.radius * Math.sin(theta),
        radius: ring.dotRadius,
        // A negative phase delay creates the travelling bright crescent seen
        // in the reference without changing the perfect polar-coordinate grid.
        delay: -(progress * 6.8 + ringIndex * 0.14),
      };
    });

    return { ...ring, dots };
  });
}

/**
 * AgentPresence â programmatic Sparkybit-style SVG loader.
 *
 * Rendering is entirely React + inline SVG + CSS. There are no images, video,
 * GIFs, canvas libraries, WebGL dependencies, or external assets.
 */
const AgentPresence: React.FC<AgentPresenceProps> = ({
  state = 'idle',
  size = 640,
  className = '',
}) => {
  const rings = useMemo(buildRings, []);
  const reactId = useId().replace(/:/g, '');
  const particleGlowId = `sparky-particle-glow-${reactId}`;

  return (
    <section
      className={`sparky-loader sparky-loader--${state} relative isolate grid w-full place-items-center overflow-hidden rounded-[36px] bg-[#EBF0F5] ${className}`.trim()}
      style={
        {
          '--sparky-max-width': `${size}px`,
        } as React.CSSProperties
      }
      role="img"
      aria-label={`AI assistant is ${state}`}
    >
      <div className="sparky-loader__lavender" aria-hidden="true" />

      <div className="sparky-loader__spotlight-orbit" aria-hidden="true">
        <div className="sparky-loader__spotlight" />
      </div>

      <svg
        className="sparky-loader__svg"
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        aria-hidden="true"
      >
        <defs>
          <filter
            id={particleGlowId}
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="1.45" result="particleBlur" />
            <feMerge>
              <feMergeNode in="particleBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          className="sparky-loader__particle-field"
          filter={`url(#${particleGlowId})`}
        >
          {rings.map((ring, ringIndex) => (
            <g
              key={ring.radius}
              className="sparky-loader__ring"
              style={
                {
                  '--sparky-ring-speed': `${ring.speed}s`,
                  '--sparky-ring-delay': `${-ringIndex * 0.72}s`,
                  '--sparky-ring-opacity': ring.opacity,
                  animationDirection: ring.direction,
                } as React.CSSProperties
              }
            >
              {ring.dots.map((dot) => (
                <circle
                  key={dot.id}
                  className="sparky-loader__dot"
                  cx={dot.x}
                  cy={dot.y}
                  r={dot.radius}
                  fill="#FFFFFF"
                  style={
                    {
                      '--sparky-dot-delay': `${dot.delay}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </g>
          ))}
        </g>
      </svg>

      <div className="sparky-loader__response-ring" aria-hidden="true" />
    </section>
  );
};

export default AgentPresence;
