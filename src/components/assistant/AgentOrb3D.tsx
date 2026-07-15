import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import AgentOrb, { OrbState } from './AgentOrb'; // CSS fallback (Suspense / no-WebGL)

/**
 * AgentOrb3D â€” premium claymorphism morphing sphere (Tier 2, UPGRADED).
 * React Three Fiber + custom GLSL.
 *
 * What makes it feel "real" this time:
 *  - Structured DIAGONAL RIDGES that twist + melt over time (not random lumps)
 *  - High-detail smooth sphere (128x128) â€” no facets
 *  - Rich PBR-style shading: key/fill/rim lights, fresnel rim, soft specular
 *  - Inner subsurface-style glow core + additive light halo
 *  - Orbiting 3D particles (Concept A energy)
 *  - Dramatic state-reactive morphing (idle = gentle, thinking = intense)
 *
 * Same deps as before (three + @react-three/fiber). No new installs needed.
 */

/* ----------------------------- GLSL NOISE ----------------------------- */
const NOISE_GLSL = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  float fbm(vec3 p){
    float f=0.0; float a=0.5; float fr=1.0;
    for(int i=0;i<4;i++){ f+=a*snoise(p*fr); fr*=2.0; a*=0.5; }
    return f;
  }
`;

/* ----------------------------- SHADERS ----------------------------- */
const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDisp;
  varying vec3 vLocal;
  ${NOISE_GLSL}

  // Structured diagonal ridges that TWIST + organic noise MELT
  float getDisp(vec3 p){
    float t = uTime * 0.4;
    float angle = atan(p.z, p.x);
    // diagonal twisting ridges (the "carved clay bead" look)
    float ridges = sin(angle * 5.0 + p.y * 4.0 + t * 1.4);
    // soft organic melt layered on top
    float n = fbm(vec3(p.x, p.y + t * 0.8, p.z) * 0.85);
    float d = ridges * 0.16 + n * 0.28;
    return d * uIntensity;
  }

  void main(){
    vec3 pos = position;
    float d = getDisp(pos);
    vec3 displaced = pos + normal * d * 0.55;

    // smooth normal via finite differences -> soft clay shading
    float eps = 0.06;
    vec3 t1 = normalize(cross(normal, vec3(0.0,1.0,0.0)) + vec3(0.001,0.0,0.0));
    vec3 t2 = normalize(cross(normal, t1));
    vec3 pB = pos + t1 * eps;
    vec3 pC = pos + t2 * eps;
    vec3 dB = pB + normal * getDisp(pB) * 0.55;
    vec3 dC = pC + normal * getDisp(pC) * 0.55;
    vec3 newNormal = normalize(cross(dB - displaced, dC - displaced));
    if (dot(newNormal, normal) < 0.0) newNormal = -newNormal;

    vNormal = normalize(normalMatrix * newNormal);
    vLocal = displaced;
    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    vView = normalize(-mv.xyz);
    vDisp = d;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uColorHi;   // highlight (warm cream)
  uniform vec3 uColorMid;  // mid (vibrant accent)
  uniform vec3 uColorLo;   // shadow (deep)
  uniform vec3 uGlow;      // rim/glow tint
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDisp;
  varying vec3 vLocal;

  void main(){
    vec3 N = normalize(vNormal);
    // 3-point lighting
    vec3 L1 = normalize(vec3(0.5, 0.9, 0.7));   // key, upper-left-front
    vec3 L2 = normalize(vec3(-0.4, -0.35, 0.55)); // soft fill
    vec3 L3 = normalize(vec3(-0.2, 0.5, -0.9));   // rim/back

    float d1 = pow(max(dot(N, L1), 0.0), 0.85);
    float d2 = max(dot(N, L2), 0.0) * 0.45;
    float d3 = pow(max(dot(N, L3), 0.0), 2.0);

    float fres = pow(1.0 - max(dot(N, vView), 0.0), 2.6);

    // soft specular sheen on the clay
    vec3 H = normalize(L1 + vView);
    float spec = pow(max(dot(N, H), 0.0), 48.0) * 1.1;

    // base gradient driven by displacement + key light
    float grad = clamp(vDisp * 1.6 + 0.5, 0.0, 1.0);
    vec3 base = mix(uColorLo, uColorMid, grad);
    base = mix(base, uColorHi, d1 * 0.65);

    vec3 col = base;
    col += uColorMid * d2;            // fill
    col += uGlow * d3 * 0.6;          // back rim
    col += uColorHi * spec;           // spec sheen
    col += uGlow * fres * 0.9;        // fresnel rim glow
    col += uGlow * (1.0 - grad) * 0.18; // subsurface inner glow

    // gentle filmic tone curve -> richer, less flat
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* --------------------------- Inner glow halo --------------------------- */
const HaloMaterial = React.forwardRef<THREE.ShaderMaterial>((_, ref) => {
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color('#FF7A00') },
    uTime: { value: 0 },
  }), []);
  return (
    <shaderMaterial
      ref={ref}
      transparent
      blending={THREE.AdditiveBlending}
      depthWrite={false}
      uniforms={uniforms}
      vertexShader={/* glsl */`
        varying vec3 vN; varying vec3 vV;
        void main(){
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `}
      fragmentShader={/* glsl */`
        uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
        void main(){
          float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 3.0);
          gl_FragColor = vec4(uColor, f * 0.55);
        }
      `}
    />
  );
});
HaloMaterial.displayName = 'HaloMaterial';

/* --------------------------- The morphing mesh --------------------------- */
interface OrbMeshProps { state: OrbState; }

const STATE_INTENSITY: Record<OrbState, number> = {
  boot: 0.3,
  idle: 0.55,
  listening: 0.9,
  thinking: 1.15,
  speaking: 1.1,
};

const OrbMesh: React.FC<OrbMeshProps> = ({ state }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.ShaderMaterial>(null);
  const target = STATE_INTENSITY[state] ?? 0.55;

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: target },
    uColorHi: { value: new THREE.Color('#FFE0C2') },
    uColorMid: { value: new THREE.Color('#FF7A00') },
    uColorLo: { value: new THREE.Color('#3D1400') },
    uGlow: { value: new THREE.Color('#FF8C1A') },
  }), []); // eslint-disable-line

  // high-detail smooth sphere
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 128, 128), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (matRef.current) {
      const u = matRef.current.uniforms;
      u.uTime.value += dt;
      const cur = u.uIntensity.value as number;
      u.uIntensity.value = cur + (target - cur) * Math.min(dt * 2.5, 1);
    }
    if (haloRef.current) {
      haloRef.current.uniforms.uTime.value += dt;
    }
    if (meshRef.current) {
      const speed = state === 'idle' ? 0.12 : 0.45;
      meshRef.current.rotation.y += dt * speed;
      meshRef.current.rotation.x += dt * speed * 0.3;
      const s = 1 + Math.sin(performance.now() * 0.0014) * 0.025;
      meshRef.current.scale.setScalar(s);
    }
  });

  return (
    <group>
      {/* additive halo slightly larger than the orb */}
      <mesh scale={1.18}>
        <sphereGeometry args={[1, 64, 64]} />
        <HaloMaterial ref={haloRef} />
      </mesh>

      <mesh ref={meshRef} geometry={geometry}>
        <shaderMaterial
          ref={matRef}
          vertexShader={VERTEX}
          fragmentShader={FRAGMENT}
          uniforms={uniforms}
        />
      </mesh>
    </group>
  );
};

/* --------------------------- Orbiting particles --------------------------- */
const Particles: React.FC<{ count?: number }> = ({ count = 14 }) => {
  const group = useRef<THREE.Group>(null);
  const data = useMemo(
    () => Array.from({ length: count }).map((_, i) => ({
      radius: 1.35 + (i % 4) * 0.18,
      speed: 0.3 + (i % 5) * 0.12,
      offset: (i / count) * Math.PI * 2,
      tilt: (i % 3) * 0.5,
      size: 0.018 + (i % 3) * 0.012,
    })),
    [count]
  );

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((c, i) => {
      const d = data[i];
      const a = t * d.speed + d.offset;
      c.position.set(
        Math.cos(a) * d.radius,
        Math.sin(a * 1.3 + d.tilt) * 0.5,
        Math.sin(a) * d.radius
      );
    });
    group.current.rotation.y = t * 0.1;
  });

  return (
    <group ref={group}>
      {data.map((d, i) => (
        <mesh key={i}>
          <sphereGeometry args={[d.size, 12, 12]} />
          <meshBasicMaterial color="#FFD8B0" transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
};

/* --------------------------- Public API --------------------------- */
interface AgentOrb3DProps {
  state?: OrbState;
  size?: number;
}

const AgentOrb3D: React.FC<AgentOrb3DProps> = ({ state = 'idle', size = 220 }) => {
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      {/* CSS glow behind */}
      <div
        style={{
          position: 'absolute', inset: '-25%', borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 45%, var(--accent, #FF7A00), transparent 62%)',
          opacity: 0.26, filter: 'blur(22px)', zIndex: 0,
        }}
      />
      <Canvas
        camera={{ position: [0, 0, 3], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 4]} intensity={1.2} />
        <OrbMesh state={state} />
        <Particles />
      </Canvas>
    </div>
  );
};

export default AgentOrb3D;