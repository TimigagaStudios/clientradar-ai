import React, { useEffect, useRef, useState } from 'react';
import AgentPresence from './AgentPresence';
import { createOrb, type OrbHandle, type OrbState } from './orbEngine';
import './fluidOrb.css';

export type { OrbState } from './orbEngine';

interface FluidOrbProps {
  state?: OrbState;
  /** Largest width in pixels (desktop). Phones use a smaller size from the stylesheet. */
  size?: number;
  /** Voice loudness 0..1 while speaking, when audio data exists. */
  level?: number | null;
  className?: string;
}

const LABELS: Record<OrbState, string> = {
  boot: 'starting',
  idle: 'ready',
  listening: 'listening',
  thinking: 'thinking',
  delegating: 'assigning work',
  speaking: 'responding',
  success: 'done',
  error: 'needs attention',
};

/**
 * Master Agent presence: fluid blue-white orb with an animated face.
 * Falls back to the previous particle presence if WebGL is unavailable.
 */
const FluidOrb: React.FC<FluidOrbProps> = ({ state = 'idle', size = 340, level = null, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<OrbHandle | null>(null);
  const stateRef = useRef<OrbState>(state);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    let orb: OrbHandle;
    try {
      orb = createOrb(canvas, { reducedMotion: query.matches });
    } catch {
      setFailed(true);
      return;
    }
    orbRef.current = orb;
    orb.setState(stateRef.current);
    const onMotion = () => orb.setReducedMotion(query.matches);
    query.addEventListener?.('change', onMotion);
    return () => {
      query.removeEventListener?.('change', onMotion);
      orb.destroy();
      orbRef.current = null;
    };
  }, []);

  useEffect(() => {
    stateRef.current = state;
    orbRef.current?.setState(state);
  }, [state]);

  useEffect(() => {
    orbRef.current?.setLevel(level);
  }, [level]);

  if (failed) {
    const legacy = state === 'boot' || state === 'idle' || state === 'listening' || state === 'thinking' || state === 'speaking' ? state : 'thinking';
    return <AgentPresence state={legacy} size={size} className={className} />;
  }

  return (
    <div
      className={`fluid-orb fluid-orb--${state} ${className}`.trim()}
      style={{ '--fluid-orb-size': `${size}px` } as React.CSSProperties}
      role="img"
      aria-label={`Master Agent, ${LABELS[state]}`}
    >
      <canvas ref={canvasRef} className="fluid-orb__canvas" />
    </div>
  );
};

export default FluidOrb;
