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

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface ParticleFrame {
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

interface Particle {
  id: number;
  frames: ParticleFrame[];
  delay: number;
}

const PARTICLE_COUNT = 58;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const PHASES = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5, Math.PI * 2];

const STATE_DURATION: Record<AgentPresenceState, number> = {
  boot: 3.8,
  idle: 12,
  listening: 5.2,
  thinking: 6.4,
  speaking: 4.8,
};

function rotateY(point: Vector3, angle: number): Vector3 {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return {
    x: point.x * cosine + point.z * sine,
    y: point.y,
    z: -point.x * sine + point.z * cosine,
  };
}

function rotateX(point: Vector3, angle: number): Vector3 {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return {
    x: point.x,
    y: point.y * cosine - point.z * sine,
    z: point.y * sine + point.z * cosine,
  };
}

function projectParticle(point: Vector3, phase: number): ParticleFrame {
  const turned = rotateY(point, phase);
  const tilted = rotateX(turned, -0.16 + Math.sin(phase) * 0.10);

  // A gentle perspective makes front particles larger and brighter while the
  // rear particles fade into the blue/lavender atmosphere.
  const perspective = 1 + tilted.z * 0.12;
  const depth = (tilted.z + 1) * 0.5;

  return {
    x: 160 + tilted.x * 76 * perspective,
    y: 150 + tilted.y * 96 * perspective,
    radius: 2.0 + depth * 5.1,
    opacity: 0.12 + depth * 0.86,
  };
}

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    // Deterministic Fibonacci-sphere distribution: evenly spaced and free of
    // random clusters while still reading as a living particle volume.
    const y = 1 - (2 * (index + 0.5)) / PARTICLE_COUNT;
    const horizontalRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const longitude = index * GOLDEN_ANGLE;

    const point: Vector3 = {
      x: Math.cos(longitude) * horizontalRadius,
      y,
      z: Math.sin(longitude) * horizontalRadius,
    };

    return {
      id: index,
      frames: PHASES.map((phase) => projectParticle(point, phase)),
      delay: (index % 11) * 0.07,
    };
  });
}

function frameValues(
  frames: ParticleFrame[],
  key: keyof ParticleFrame,
  precision = 2
): string {
  return frames.map((frame) => frame[key].toFixed(precision)).join(';');
}

/**
 * AgentPresence â€” ClientRadar AI's SVG particle identity.
 *
 * It replaces the WebGL orb with a lightweight rotating particle sphere over
 * a blue/lavender atmospheric field. The component remains state-reactive and
 * works without Three.js, React Three Fiber, canvas, or GPU-specific shaders.
 */
const AgentPresence: React.FC<AgentPresenceProps> = ({
  state = 'idle',
  size = 300,
  className = '',
}) => {
  const particles = useMemo(createParticles, []);
  const rawId = useId();
  const filterId = `cr-presence-glow-${rawId.replace(/:/g, '')}`;
  const duration = STATE_DURATION[state];

  return (
    <div
      className={`cr-presence cr-presence--${state} ${className}`.trim()}
      style={{ '--cr-presence-size': `${size}px` } as React.CSSProperties}
      role="img"
      aria-label={`AI assistant is ${state}`}
    >
      <div className="cr-presence__atmosphere" aria-hidden="true" />
      <div className="cr-presence__aura" aria-hidden="true" />

      <svg
        className="cr-presence__svg"
        viewBox="0 0 320 300"
        aria-hidden="true"
      >
        <defs>
          <filter
            id={filterId}
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="1.8" result="softGlow" />
            <feMerge>
              <feMergeNode in="softGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="cr-presence__particles" filter={`url(#${filterId})`}>
          {particles.map((particle) => {
            const firstFrame = particle.frames[0];

            return (
              <circle
                key={particle.id}
                className="cr-presence__dot"
                cx={firstFrame.x}
                cy={firstFrame.y}
                r={firstFrame.radius}
                opacity={firstFrame.opacity}
                style={
                  {
                    '--cr-dot-delay': `${particle.delay}s`,
                  } as React.CSSProperties
                }
              >
                <animate
                  attributeName="cx"
                  values={frameValues(particle.frames, 'x')}
                  keyTimes="0;0.25;0.5;0.75;1"
                  dur={`${duration}s`}
                  repeatCount="indefinite"
                  calcMode="spline"
                  keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
                />
                <animate
                  attributeName="cy"
                  values={frameValues(particle.frames, 'y')}
                  keyTimes="0;0.25;0.5;0.75;1"
                  dur={`${duration}s`}
                  repeatCount="indefinite"
                  calcMode="spline"
                  keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
                />
                <animate
                  attributeName="r"
                  values={frameValues(particle.frames, 'radius')}
                  keyTimes="0;0.25;0.5;0.75;1"
                  dur={`${duration}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values={frameValues(particle.frames, 'opacity')}
                  keyTimes="0;0.25;0.5;0.75;1"
                  dur={`${duration}s`}
                  repeatCount="indefinite"
                />
              </circle>
            );
          })}
        </g>
      </svg>

      <div className="cr-presence__state-ring" aria-hidden="true" />
    </div>
  );
};

export default AgentPresence;