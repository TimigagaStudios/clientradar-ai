import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbState } from './AgentOrb';

/**
 * AgentOrb3D â€” engineered AI-assistant sphere.
 *
 * The mesh position is never displaced. This guarantees a perfectly circular
 * silhouette and removes the pole pinch that the previous displaced geometry
 * produced. The five spiral grooves are created by mathematically perturbing
 * only the surface normals.
 *
 * No noise, fbm, turbulence, random deformation, or organic morphing is used.
 */

/* ======================================================================
   VERTEX SHADER â€” five mathematical spiral grooves, circular silhouette
   ====================================================================== */

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uRipple;
  uniform float uBands;
  uniform float uTwist;
  uniform float uGrooveDepth;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vBandHeight;
  varying float vGrooveLine;

  float spiralHeight(vec3 pointOnSphere) {
    vec3 p = normalize(pointOnSphere);
    float longitude = atan(p.z, p.x);
    float latitude = asin(clamp(p.y, -1.0, 1.0));

    // Five evenly spaced helical bands. Animation moves energy through the
    // grooves without changing the sphere's geometry or silhouette.
    float phase = longitude * uBands
      + latitude * uTwist
      - uTime * uFlowSpeed;

    float wave = cos(phase);
    wave += sin(phase * 2.0 + uTime * 3.2) * uRipple * 0.075;

    // Broad rounded ridges separated by clean, narrow valleys.
    float ridge = pow(clamp(wave * 0.5 + 0.5, 0.0, 1.0), 1.35);
    return ridge;
  }

  void main() {
    vec3 N = normalize(normal);

    // Build a stable tangent frame on the sphere.
    vec3 referenceAxis = abs(N.y) > 0.92
      ? vec3(1.0, 0.0, 0.0)
      : vec3(0.0, 1.0, 0.0);
    vec3 tangentA = normalize(cross(referenceAxis, N));
    vec3 tangentB = normalize(cross(N, tangentA));

    // Finite differences calculate the mathematical groove slope. Only the
    // normal changes; the vertex position remains the original sphere.
    float epsilon = 0.006;
    float h = spiralHeight(N);
    float hA = spiralHeight(normalize(N + tangentA * epsilon));
    float hB = spiralHeight(normalize(N + tangentB * epsilon));

    float slopeA = (hA - h) / epsilon;
    float slopeB = (hB - h) / epsilon;
    vec3 grooveNormal = normalize(
      N - (tangentA * slopeA + tangentB * slopeB) * uGrooveDepth
    );

    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);

    vNormal = normalize(normalMatrix * grooveNormal);
    vViewPosition = -modelViewPosition.xyz;
    vBandHeight = h;
    vGrooveLine = 1.0 - smoothstep(0.08, 0.30, h);

    // IMPORTANT: untouched sphere position = perfectly circular silhouette.
    gl_Position = projectionMatrix * modelViewPosition;
  }
`;

/* ======================================================================
   FRAGMENT SHADER â€” premium glossy studio material
   ====================================================================== */

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uColorHi;
  uniform vec3 uColorMid;
  uniform vec3 uColorLo;
  uniform vec3 uGlow;
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uEnergy;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vBandHeight;
  varying float vGrooveLine;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPosition);

    vec3 keyDirection = normalize(vec3(-0.52, 0.72, 0.66));
    vec3 fillDirection = normalize(vec3(0.70, 0.05, 0.55));
    vec3 rimDirection = normalize(vec3(0.10, 0.42, -0.90));

    float key = max(dot(N, keyDirection), 0.0);
    float fill = max(dot(N, fillDirection), 0.0);
    float rim = pow(max(dot(N, rimDirection), 0.0), 2.2);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    vec3 halfVector = normalize(keyDirection + V);
    float primarySpecular = pow(max(dot(N, halfVector), 0.0), 72.0);

    vec3 fillHalfVector = normalize(fillDirection + V);
    float secondarySpecular = pow(max(dot(N, fillHalfVector), 0.0), 34.0);

    // Rich orange base with cream-facing light and deep warm shadow.
    vec3 base = mix(uColorLo, uColorMid, 0.24 + key * 0.76);
    base = mix(base, uColorHi, key * key * 0.20);

    // The valleys remain clean and dark while rounded ridges catch light.
    base *= mix(0.64, 1.08, smoothstep(0.02, 0.94, vBandHeight));
    base = mix(base, uColorLo * 0.72, vGrooveLine * 0.48);

    vec3 color = base;
    color += uColorMid * fill * 0.16;
    color += uGlow * rim * 0.22;
    color += uColorHi * primarySpecular * 1.30;
    color += uColorHi * secondarySpecular * 0.28;
    color += uGlow * fresnel * 0.22;

    // State energy travels inside the existing bands; it never deforms them.
    float travellingEnergy = 0.5 + 0.5 * sin(
      vBandHeight * 8.0 - uTime * (1.0 + uFlowSpeed * 2.0)
    );
    color += uGlow * travellingEnergy * uEnergy * vBandHeight * 0.10;

    // Filmic tone mapping.
    color = (color * (2.51 * color + 0.03)) /
      (color * (2.43 * color + 0.59) + 0.14);
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ======================================================================
   STATE PARAMETERS
   ====================================================================== */

interface StateParams {
  flow: number;
  ripple: number;
  energy: number;
  breathe: number;
  breatheSpeed: number;
  rotationSpeed: number;
}

const STATE_PARAMS: Record<OrbState, StateParams> = {
  boot: {
    flow: 0.22,
    ripple: 0.02,
    energy: 0.28,
    breathe: 0.010,
    breatheSpeed: 0.75,
    rotationSpeed: 0.045,
  },
  idle: {
    flow: 0.08,
    ripple: 0,
    energy: 0.10,
    breathe: 0.010,
    breatheSpeed: 0.48,
    rotationSpeed: 0.028,
  },
  listening: {
    flow: 0.34,
    ripple: 0.34,
    energy: 0.38,
    breathe: 0.024,
    breatheSpeed: 1.45,
    rotationSpeed: 0.052,
  },
  thinking: {
    flow: 0.54,
    ripple: 0.08,
    energy: 0.52,
    breathe: 0.015,
    breatheSpeed: 0.86,
    rotationSpeed: 0.082,
  },
  speaking: {
    flow: 0.42,
    ripple: 0.22,
    energy: 0.44,
    breathe: 0.022,
    breatheSpeed: 1.18,
    rotationSpeed: 0.060,
  },
};

interface OrbMeshProps {
  state: OrbState;
}

const OrbMesh: React.FC<OrbMeshProps> = ({ state: orbState }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 128, 128), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFlowSpeed: { value: STATE_PARAMS.idle.flow },
      uRipple: { value: STATE_PARAMS.idle.ripple },
      uEnergy: { value: STATE_PARAMS.idle.energy },

      // Locked orb controls â€” keep together for screenshot-driven tuning.
      uBands: { value: 5.0 },
      uTwist: { value: 3.0 },
      uGrooveDepth: { value: 0.040 },

      // Locked ClientRadar brand palette.
      uColorHi: { value: new THREE.Color('#FFE8D0') },
      uColorMid: { value: new THREE.Color('#FF7A00') },
      uColorLo: { value: new THREE.Color('#5C1F00') },
      uGlow: { value: new THREE.Color('#FF8C1A') },
    }),
    []
  );

  const interpolated = useRef({ ...STATE_PARAMS.idle });

  useFrame((threeState, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = STATE_PARAMS[orbState] ?? STATE_PARAMS.idle;
    const smoothing = Math.min(dt * 2.5, 1);
    const current = interpolated.current;

    current.flow += (target.flow - current.flow) * smoothing;
    current.ripple += (target.ripple - current.ripple) * smoothing;
    current.energy += (target.energy - current.energy) * smoothing;
    current.breathe += (target.breathe - current.breathe) * smoothing;
    current.breatheSpeed +=
      (target.breatheSpeed - current.breatheSpeed) * smoothing;
    current.rotationSpeed +=
      (target.rotationSpeed - current.rotationSpeed) * smoothing;

    if (materialRef.current) {
      const shaderUniforms = materialRef.current.uniforms;
      shaderUniforms.uTime.value += dt;
      shaderUniforms.uFlowSpeed.value = current.flow;
      shaderUniforms.uRipple.value = current.ripple;
      shaderUniforms.uEnergy.value = current.energy;
    }

    if (meshRef.current) {
      let breatheAmount = current.breathe;

      if (orbState === 'listening') {
        // Temporary simulated amplitude. Replace with Web Audio API amplitude.
        const simulatedVolume =
          Math.sin(threeState.clock.elapsedTime * 4.0) * 0.5 + 0.5;
        breatheAmount = 0.012 + simulatedVolume * 0.024;
      }

      const scale =
        1.0 +
        Math.sin(threeState.clock.elapsedTime * current.breatheSpeed) *
          breatheAmount;

      meshRef.current.scale.setScalar(scale);
      meshRef.current.rotation.y += dt * current.rotationSpeed;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={[0.28, -0.22, -0.08]}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
      />
    </mesh>
  );
};

interface AgentOrb3DProps {
  state?: OrbState;
  size?: number;
}

const AgentOrb3D: React.FC<AgentOrb3DProps> = ({
  state = 'idle',
  size = 240,
}) => {
  return (
    <div
      className="cr-orb3d"
      style={{
        width: size,
        height: size,
      }}
    >
      <div className="cr-orb3d__glow" aria-hidden="true" />

      <Canvas
        camera={{ position: [0, 0, 3.15], fov: 42 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <OrbMesh state={state} />
      </Canvas>
    </div>
  );
};

export default AgentOrb3D;