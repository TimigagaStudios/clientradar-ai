import React, { useEffect, useId, useMemo, useRef } from 'react';
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

interface ParticleDefinition {
  id: string;
  baseX: number;
  baseY: number;
  radialX: number;
  radialY: number;
  baseRadius: number;
  baseOpacity: number;
  maxPush: number;
}

interface ParticlePhysics {
  influence: number;
  influenceVelocity: number;
}

interface PointPhysics {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

const VIEWBOX_WIDTH = 360;
const VIEWBOX_HEIGHT = 270;
const CENTER_X = VIEWBOX_WIDTH / 2;
const CENTER_Y = VIEWBOX_HEIGHT / 2;

// Exactly three static concentric circles. The circles never rotate; only the
// local dots nearest the moving pressure field are displaced radially.
const RINGS = [
  { radius: 43, count: 12, dotRadius: 6.8, opacity: 0.20, maxPush: 10 },
  { radius: 76, count: 20, dotRadius: 4.9, opacity: 0.18, maxPush: 15 },
  { radius: 110, count: 28, dotRadius: 3.1, opacity: 0.16, maxPush: 20 },
] as const;

const STATE_SPEED: Record<AgentPresenceState, number> = {
  boot: 0.32,
  idle: 0.43,
  listening: 0.58,
  thinking: 0.68,
  speaking: 0.62,
};

const STATE_PRESSURE: Record<AgentPresenceState, number> = {
  boot: 0.70,
  idle: 1,
  listening: 1.16,
  thinking: 1.08,
  speaking: 1.12,
};

function createParticles(): ParticleDefinition[] {
  return RINGS.flatMap((ring, ringIndex) =>
    Array.from({ length: ring.count }, (_, dotIndex) => {
      const angle = (dotIndex / ring.count) * Math.PI * 2 - Math.PI / 2;
      const radialX = Math.cos(angle);
      const radialY = Math.sin(angle);

      return {
        id: `${ringIndex}-${dotIndex}`,
        baseX: CENTER_X + radialX * ring.radius,
        baseY: CENTER_Y + radialY * ring.radius,
        radialX,
        radialY,
        baseRadius: ring.dotRadius,
        baseOpacity: ring.opacity,
        maxPush: ring.maxPush,
      };
    })
  );
}

function springPoint(
  point: PointPhysics,
  targetX: number,
  targetY: number,
  stiffness: number,
  damping: number,
  delta: number
): void {
  const accelerationX = (targetX - point.x) * stiffness;
  const accelerationY = (targetY - point.y) * stiffness;

  point.velocityX += accelerationX * delta;
  point.velocityY += accelerationY * delta;

  const drag = Math.exp(-damping * delta);
  point.velocityX *= drag;
  point.velocityY *= drag;

  point.x += point.velocityX * delta;
  point.y += point.velocityY * delta;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function smoothPressure(distance: number, radius: number): number {
  const normalized = clamp(1 - distance / radius, 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

/**
 * AgentPresence â three-ring Sparkybit-style particle loader.
 *
 * The electric-blue field follows a spring-driven infinity path. Its leading
 * body and slower trailing mass create the requested water-balloon/jellyfish
 * behavior. Particle rings remain aligned and never rotate; proximity to the
 * field alone produces local radial expansion, dot growth, and illumination.
 */
const AgentPresence: React.FC<AgentPresenceProps> = ({
  state = 'idle',
  size = 640,
  className = '',
}) => {
  const particles = useMemo(createParticles, []);
  const particleRefs = useRef<Array<SVGCircleElement | null>>([]);
  const mainBlobRef = useRef<SVGGElement | null>(null);
  const trailBlobRef = useRef<SVGGElement | null>(null);
  const stateRef = useRef<AgentPresenceState>(state);
  const reactId = useId().replace(/:/g, '');
  const blueGradientId = `sparky-blue-gradient-${reactId}`;
  const lavenderGradientId = `sparky-lavender-gradient-${reactId}`;
  const mainBlurId = `sparky-main-blur-${reactId}`;
  const trailBlurId = `sparky-trail-blur-${reactId}`;
  const dotGlowId = `sparky-dot-glow-${reactId}`;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const main: PointPhysics = {
      x: CENTER_X,
      y: CENTER_Y,
      velocityX: 0,
      velocityY: 0,
    };
    const trail: PointPhysics = {
      x: CENTER_X - 10,
      y: CENTER_Y,
      velocityX: 0,
      velocityY: 0,
    };
    const particlePhysics: ParticlePhysics[] = particles.map(() => ({
      influence: 0,
      influenceVelocity: 0,
    }));

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let animationFrame = 0;
    let previousTime = performance.now();
    let phase = 0;

    const render = (now: number) => {
      const delta = Math.min((now - previousTime) / 1000, 1 / 30);
      previousTime = now;

      const currentState = stateRef.current;
      const speed = reduceMotion ? 0 : STATE_SPEED[currentState];
      phase += delta * speed;

      // Gerono lemniscate: a continuous, centered infinity path.
      const targetX = CENTER_X + Math.sin(phase) * 88;
      const targetY = CENTER_Y + Math.sin(phase * 2) * 47;

      // The leading body reacts first. The second mass follows more slowly,
      // producing delayed, viscous direction changes instead of linear travel.
      springPoint(main, targetX, targetY, 15.5, 6.2, delta);
      springPoint(trail, main.x, main.y, 7.0, 4.7, delta);

      const speedMagnitude = Math.hypot(main.velocityX, main.velocityY);
      const stretch = clamp(speedMagnitude / 320, 0, 0.22);
      const heading =
        Math.atan2(main.velocityY, main.velocityX) * (180 / Math.PI);
      const squash = 1 - stretch * 0.42;

      mainBlobRef.current?.setAttribute(
        'transform',
        `translate(${main.x.toFixed(2)} ${main.y.toFixed(2)}) rotate(${heading.toFixed(
          2
        )}) scale(${(1 + stretch).toFixed(3)} ${squash.toFixed(3)})`
      );

      const trailSpeed = Math.hypot(trail.velocityX, trail.velocityY);
      const trailStretch = clamp(trailSpeed / 360, 0, 0.16);
      const trailHeading =
        Math.atan2(trail.velocityY, trail.velocityX) * (180 / Math.PI);

      trailBlobRef.current?.setAttribute(
        'transform',
        `translate(${trail.x.toFixed(2)} ${trail.y.toFixed(
          2
        )}) rotate(${trailHeading.toFixed(2)}) scale(${(
          1 + trailStretch
        ).toFixed(3)} ${(1 - trailStretch * 0.34).toFixed(3)})`
      );

      const pressureMultiplier = STATE_PRESSURE[currentState];

      particles.forEach((particle, index) => {
        const element = particleRefs.current[index];
        if (!element) return;

        const distance = Math.hypot(
          particle.baseX - main.x,
          particle.baseY - main.y
        );
        const targetInfluence =
          smoothPressure(distance, 120) * pressureMultiplier;
        const physics = particlePhysics[index];

        // Each dot has its own damped spring, so the pressure wave arrives and
        // relaxes organically rather than snapping to the blob position.
        const acceleration =
          (targetInfluence - physics.influence) * 28 -
          physics.influenceVelocity * 9.2;
        physics.influenceVelocity += acceleration * delta;
        physics.influence += physics.influenceVelocity * delta;
        physics.influence = clamp(physics.influence, 0, 1.18);

        const influence = physics.influence;
        const push = particle.maxPush * influence;
        const x = particle.baseX + particle.radialX * push;
        const y = particle.baseY + particle.radialY * push;
        const radius = particle.baseRadius * (1 + influence * 0.72);
        const opacity = clamp(
          particle.baseOpacity + (1 - particle.baseOpacity) * influence,
          particle.baseOpacity,
          1
        );

        element.setAttribute('cx', x.toFixed(2));
        element.setAttribute('cy', y.toFixed(2));
        element.setAttribute('r', radius.toFixed(2));
        element.setAttribute('opacity', opacity.toFixed(3));
      });

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationFrame);
  }, [particles]);

  return (
    <section
      className={`sparky-loader sparky-loader--${state} relative grid w-full place-items-center overflow-visible bg-transparent ${className}`.trim()}
      style={
        {
          '--sparky-max-width': `${size}px`,
        } as React.CSSProperties
      }
      role="img"
      aria-label={`AI assistant is ${state}`}
    >
      <svg
        className="sparky-loader__svg"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={blueGradientId} cx="42%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#1F51FF" stopOpacity="0.96" />
            <stop offset="42%" stopColor="#2563EB" stopOpacity="0.76" />
            <stop offset="76%" stopColor="#1F51FF" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#1F51FF" stopOpacity="0" />
          </radialGradient>

          <radialGradient id={lavenderGradientId} cx="45%" cy="48%" r="64%">
            <stop offset="0%" stopColor="#ABA4EE" stopOpacity="0.48" />
            <stop offset="58%" stopColor="#BEBBEF" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#D7D5EF" stopOpacity="0" />
          </radialGradient>

          {/* Larger fields with more defined edges than the previous 35px blur. */}
          <filter id={mainBlurId} x="-65%" y="-65%" width="230%" height="230%">
            <feGaussianBlur stdDeviation="13.5" />
          </filter>
          <filter id={trailBlurId} x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="17" />
          </filter>
          <filter id={dotGlowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="1.35" result="dotBlur" />
            <feMerge>
              <feMergeNode in="dotBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          ref={trailBlobRef}
          className="sparky-loader__blob sparky-loader__blob--trail"
          filter={`url(#${trailBlurId})`}
        >
          <ellipse
            cx="0"
            cy="0"
            rx="96"
            ry="72"
            fill={`url(#${lavenderGradientId})`}
          />
        </g>

        <g
          ref={mainBlobRef}
          className="sparky-loader__blob sparky-loader__blob--main"
          filter={`url(#${mainBlurId})`}
        >
          <ellipse
            cx="0"
            cy="0"
            rx="88"
            ry="66"
            fill={`url(#${blueGradientId})`}
          />
          <ellipse
            className="sparky-loader__blob-core"
            cx="-10"
            cy="-5"
            rx="47"
            ry="37"
            fill="#1F51FF"
            opacity="0.20"
          />
        </g>

        <g className="sparky-loader__rings" filter={`url(#${dotGlowId})`}>
          {particles.map((particle, index) => (
            <circle
              key={particle.id}
              ref={(element) => {
                particleRefs.current[index] = element;
              }}
              className="sparky-loader__dot"
              cx={particle.baseX}
              cy={particle.baseY}
              r={particle.baseRadius}
              fill="#FFFFFF"
              opacity={particle.baseOpacity}
            />
          ))}
        </g>
      </svg>
    </section>
  );
};

export default AgentPresence;
