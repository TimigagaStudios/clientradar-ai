import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import AgentOrb, { OrbState } from './AgentOrb';

/**
 * AgentOrb3D â€” clean, engineered AI assistant sphere.
 *
 * SPEC COMPLIANCE:
 *  - Near-perfect sphere (no blob, no noise, no random displacement)
 *  - 5 clean mathematical spiral grooves, evenly spaced, consistent width
 *  - Perfect symmetry from every angle
 *  - Premium glossy finish, soft studio lighting
 *  - State-reactive: idle / listening / thinking / speaking
 *  - No clipping â€” container allows full overflow
 *
 * NO noise functions. NO organic melt. Everything is mathematical sine/cos.
 */

/* ======================================================================
   VERTEX SHADER â€” clean spiral grooves on a perfect sphere
   ====================================================================== */
const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uFlowSpeed;    // how fast grooves flow (state-dependent)
  uniform float uRipple;       // sound-wave ripple amount (listening/speaking)
  uniform float uBands;        // number of spiral bands (5.0)
  uniform float uTwist;        // spiral twist factor (3.0)
  uniform float uGrooveDepth;  // how deep the grooves are (subtle, 0.04)

  varying vec3 vNormal;
  varying vec3 vView;
  varying float vGroovePattern;  // raw groove pattern for fragment shading
  varying float vDisp;

  // Returns groove displacement at a point on the unit sphere.
  // PURE MATHEMATICS. No noise. Clean cosine spiral.
  float getDisp(vec3 p) {
    float angle = atan(p.z, p.x);
    float lat = p.y;

    // Spiral phase: bands twist from bottom to top
    float phase = angle * uBands + lat * uTwist + uTime * uFlowSpeed;
    float bands = cos(phase);

    // Sound-wave ripple layered on top (active in listening/speaking)
    bands += sin(uTime * 3.5 + phase * 2.0) * uRipple * 0.18;

    // Map to 0..1 and create clean grooves with smooth walls
    float b = bands * 0.5 + 0.5;
    float groove = smoothstep(0.30, 0.60, b);

    // Displacement: bands push out slightly, grooves push in slightly
    return (groove - 0.5) * uGrooveDepth * 2.0;
  }

  void main() {
    vec3 N = normalize(position);  // unit sphere: normal = position direction
    float d = getDisp(N);
    vec3 displaced = N * (1.0 + d);

    // ---- Recompute normal via finite differences for accurate groove shading ----
    float eps = 0.015;
    vec3 upRef = abs(N.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 t1 = normalize(cross(N, upRef));
    vec3 t2 = normalize(cross(N, t1));

    // Sample neighbors ON the sphere surface
    vec3 sB = normalize(N + t1 * eps);
    vec3 sC = normalize(N + t2 * eps);
    vec3 dB = sB * (1.0 + getDisp(sB));
    vec3 dC = sC * (1.0 + getDisp(sC));

    vec3 newNormal = normalize(cross(dB - displaced, dC - displaced));
    if (dot(newNormal, N) < 0.0) newNormal = -newNormal;

    vNormal = normalize(normalMatrix * newNormal);

    // Pass groove pattern for fragment energy effect
    float phase = atan(N.z, N.x) * uBands + N.y * uTwist + uTime * uFlowSpeed;
    vGroovePattern = cos(phase);

    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    vView = normalize(-mv.xyz);
    vDisp = d;
    gl_Position = projectionMatrix * mv;
  }
`;

/* ======================================================================
   FRAGMENT SHADER â€” premium glossy studio-lit material
   ====================================================================== */
const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uColorHi;    // highlight (warm cream)
  uniform vec3 uColorMid;   // mid (vibrant accent)
  uniform vec3 uColorLo;    // shadow (deep warm)
  uniform vec3 uGlow;       // energy/glow tint
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uEnergy;    // internal energy brightness (state-dependent)

  varying vec3 vNormal;
  varying vec3 vView;
  varying float vGroovePattern;
  varying float vDisp;

  void main() {
    vec3 N = normalize(vNormal);

    // ---- 3-point studio lighting ----
    vec3 keyDir  = normalize(vec3(0.45, 0.80, 0.55));   // key, upper-left-front
    vec3 fillDir = normalize(vec3(-0.50, -0.15, 0.55)); // soft fill, right
    vec3 rimDir  = normalize(vec3(0.10, 0.35, -0.95));  // rim/back

    float keyLight  = max(dot(N, keyDir), 0.0);
    float fillLight = max(dot(N, fillDir), 0.0) * 0.30;
    float rimLight  = pow(max(dot(N, rimDir), 0.0), 2.0) * 0.45;

    // ---- Fresnel rim glow ----
    float fres = pow(1.0 - max(dot(N, vView), 0.0), 2.5);

    // ---- Glossy specular (tight highlight = premium gloss) ----
    vec3 H = normalize(keyDir + vView);
    float spec = pow(max(dot(N, H), 0.0), 52.0) * 1.4;

    // ---- Base color: gradient from key light ----
    vec3 base = mix(uColorLo, uColorMid, keyLight * 0.72 + 0.28);

    // ---- Band/groove visual enhancement ----
    // Bands (high points) catch more light, grooves are slightly darker
    float bandFactor = vGroovePattern * 0.5 + 0.5;
    base = mix(base * 0.82, base * 1.08, bandFactor);

    vec3 col = base;
    col += uColorMid * fillLight;
    col += uGlow * rimLight;
    col += uColorHi * spec;              // glossy specular sheen
    col += uGlow * fres * 0.55;          // fresnel rim

    // ---- Internal energy flowing along spiral bands ----
    float energy = smoothstep(0.15, 0.85, sin(vGroovePattern * 3.0 - uTime * 1.6 * uFlowSpeed) * 0.5 + 0.5);
    col += uGlow * energy * uEnergy * 0.18;

    // ---- Subtle filmic tone map for rich, non-flat color ----
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ======================================================================
   STATE PARAMETERS â€” each AI state has clean, defined behavior
   ====================================================================== */
interface StateParams {
  flow: number;         // groove flow speed
  ripple: number;       // sound-wave ripple
  energy: number;       // internal energy glow
  breathe: number;      // breathing scale amplitude (1-2% idle)
  breatheSpeed: number; // breathing speed
  rotSpeed: number;     // rotation speed
}

const STATE_PARAMS: Record<OrbState, StateParams> = {
  boot:      { flow: 0.25, ripple: 0.05, energy: 0.30, breathe: 0.015, breatheSpeed: 0.8, rotSpeed: 0.06 },
  idle:      { flow: 0.12, ripple: 0.00, energy: 0.12, breathe: 0.012, breatheSpeed: 0.5, rotSpeed: 0.04 },
  listening: { flow: 0.40, ripple: 0.50, energy: 0.40, breathe: 0.035, breatheSpeed: 1.5, rotSpeed: 0.08 },
  thinking:  { flow: 0.70, ripple: 0.15, energy: 0.60, breathe: 0.020, breatheSpeed: 0.9, rotSpeed: 0.12 },
  speaking:  { flow: 0.50, ripple: 0.30, energy: 0.50, breathe: 0.030, breatheSpeed: 1.2, rotSpeed: 0.08 },
};

/* ======================================================================
   THE ORB MESH
   ====================================================================== */
interface OrbMeshProps {
  state: OrbState;
}

const OrbMesh: React.FC<OrbMeshProps> = ({ state: orbState }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  // High-detail smooth sphere â€” no facets
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 128, 128), []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFlowSpeed: { value: 0.12 },
      uRipple: { value: 0 },
      uEnergy: { value: 0.12 },
      uBands: { value: 5.0 },
      uTwist: { value: 3.0 },
      uGrooveDepth: { value: 0.04 },
      uColorHi: { value: new THREE.Color('#FFE8D0') },
      uColorMid: { value: new THREE.Color('#FF7A00') },
      uColorLo: { value: new THREE.Color('#5C1F00') },
      uGlow: { value: new THREE.Color('#FF8C1A') },
    }),
    []
  );

  // Track interpolated state params across frames
  const interp = useRef({ flow: 0.12, ripple: 0, energy: 0.12, breathe: 0.012, breatheSpeed: 0.5, rotSpeed: 0.04 });

  useFrame((threeState, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = STATE_PARAMS[orbState] ?? STATE_PARAMS.idle;
    const k = Math.min(dt * 2.5, 1); // smooth interpolation factor

    // Interpolate toward target state params
    interp.current.flow += (target.flow - interp.current.flow) * k;
    interp.current.ripple += (target.ripple - interp.current.ripple) * k;
    interp.current.energy += (target.energy - interp.current.energy) * k;
    interp.current.breathe += (target.breathe - interp.current.breathe) * k;
    interp.current.breatheSpeed += (target.breatheSpeed - interp.current.breatheSpeed) * k;
    interp.current.rotSpeed += (target.rotSpeed - interp.current.rotSpeed) * k;

    if (matRef.current) {
      const u = matRef.current.uniforms;
      u.uTime.value += dt;
      u.uFlowSpeed.value = interp.current.flow;
      u.uRipple.value = interp.current.ripple;
      u.uEnergy.value = interp.current.energy;
    }

    if (meshRef.current) {
      // Gentle breathing (1-2% scale for idle, more for active states)
      let breatheAmt = interp.current.breathe;
      let breatheSpd = interp.current.breatheSpeed;

      // Listening: simulate volume-reactive expansion/contraction
      // (Wire to real mic amplitude via Web Audio API later)
      if (orbState === 'listening') {
        const simulatedVolume = Math.sin(threeState.clock.elapsedTime * 4.0) * 0.5 + 0.5;
        breatheAmt = 0.015 + simulatedVolume * 0.04;
      }

      const scale = 1.0 + Math.sin(threeState.clock.elapsedTime * breatheSpd) * breatheAmt;
      meshRef.current.scale.setScalar(scale);

      // Slow elegant rotation
      meshRef.current.rotation.y += dt * interp.current.rotSpeed;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
      />
    </mesh>
  );
};

/* ======================================================================
   PUBLIC API
   ====================================================================== */
interface AgentOrb3DProps {
  state?: OrbState;
  size?: number;
}

const AgentOrb3D: React.FC<AgentOrb3DProps> = ({ state = 'idle', size = 240 }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        overflow: 'visible', // FIX: never clip the orb or its glow
      }}
    >
      {/* Soft glow behind the orb â€” extends beyond container, not clipped */}
      <div
        style={{
          position: 'absolute',
          inset: '-18%',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 50% 45%, var(--accent, #FF7A00), transparent 60%)',
          opacity: 0.16,
          filter: 'blur(20px)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <Canvas
        camera={{ position: [0, 0, 3], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 4]} intensity={1.1} />
        <OrbMesh state={state} />
      </Canvas>
    </div>
  );
};

export default AgentOrb3D;