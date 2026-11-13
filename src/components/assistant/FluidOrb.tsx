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
  /** Called when the orb is tapped. When set, the orb becomes a button. */
  onTap?: () => void;
  /** Spoken label for the tap action. */
  tapLabel?: string;
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

const SLEEP_AFTER_MS = 90000;

/**
 * Master Agent presence: fluid blue-white orb with an animated face.
 * The eyes follow the pointer or finger, the orb rests after a while without
 * activity, and it falls back to the previous particle presence if WebGL is
 * unavailable.
 */
const FluidOrb: React.FC<FluidOrbProps> = ({ state = 'idle', size = 408, level = null, onTap, tapLabel = 'Master Agent', className = '' }) => {
  const boxRef = useRef<HTMLDivElement>(null);
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

    // Eyes follow the pointer or the last touch; any activity keeps the orb awake.
    let lastActivity = Date.now();
    const awake = () => { lastActivity = Date.now(); orb.setAsleep(false); };
    const onPointer = (event: PointerEvent) => {
      awake();
      const box = boxRef.current?.getBoundingClientRect();
      if (!box || !box.width) return;
      const reach = Math.max(box.width * 0.9, 1);
      orb.setLook((event.clientX - (box.left + box.width / 2)) / reach, -(event.clientY - (box.top + box.height / 2)) / reach);
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
    window.addEventListener('keydown', awake);
    window.addEventListener('scroll', awake, { passive: true });
    const sleepTimer = window.setInterval(() => {
      if (Date.now() - lastActivity > SLEEP_AFTER_MS) orb.setAsleep(true);
    }, 5000);

    return () => {
      query.removeEventListener?.('change', onMotion);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', awake);
      window.removeEventListener('scroll', awake);
      window.clearInterval(sleepTimer);
      orb.destroy();
      orbRef.current = null;
    };
  }, []);

  useEffect(() => {
    stateRef.current = state;
    orbRef.current?.setState(state);
    if (state !== 'idle') orbRef.current?.setAsleep(false);
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
      ref={boxRef}
      className={`fluid-orb fluid-orb--${state} ${className}`.trim()}
      style={{ '--fluid-orb-size': `${size}px` } as React.CSSProperties}
      role={onTap ? undefined : 'img'}
      aria-label={onTap ? undefined : `Master Agent, ${LABELS[state]}`}
    >
      <canvas ref={canvasRef} className="fluid-orb__canvas" aria-hidden="true" />
      {onTap && (
        <button
          type="button"
          className="fluid-orb__tap"
          aria-label={`${tapLabel} (${LABELS[state]})`}
          onClick={() => {
            orbRef.current?.poke();
            onTap();
          }}
        />
      )}
    </div>
  );
};

export default FluidOrb;
