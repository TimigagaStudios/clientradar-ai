import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import AgentOrb, { OrbState } from './AgentOrb'; // CSS fallback (Suspense / no-WebGL)

/**
 * AgentOrb3D â€” the TRUE 3D claymorphism morphing sphere (Tier 2).
 * Built with React Three Fiber + a custom GLSL noise-displacement shader.
 *
 * A high-detail icosahedron is displaced along its normals by 3D simplex
 * noise that evolves over time -> the surface "melts / twists / morphs".
 * Soft diffuse + fresnel lighting gives the matte clay look.
 *
 * The whole 3D scene lives in this one file. No Spline, no hosted assets.
 *
 * INSTALL (in repo root):
 *   npm i three @react-three/fiber @react-three/drei
 *   npm i -D @types/three
 *
 * USAGE (lazy-load it so it never bloats your initial bundle):
 *   const AgentOrb3D = React.lazy(() => import('./AgentOrb3D'));
 *   <Suspense fallback={<AgentOrb size={184} />}>
 *     <AgentOrb3D state="idle" size={184} />
 *   </Suspense>
 */

/* ----------------------------- GLSL ----------------------------- */
const NOISE_GLSL = /* glsl */ `
  // Ashima Arts 3D simplex noise (standard, battle-tested)
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
  // fractal brownian motion (layered noise for richer melt)
  float fbm(vec3 p){
    float f=0.0; float a=0.5; float fr=1.0;
    for(int i=0;i<4;i++){ f+=a*snoise(p*fr); fr*=2.0; a*=0.5; }
    return f;
  }
`;

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity; // 0..1+
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDisp;
  ${NOISE_GLSL}
  // displacement as a function so we can sample neighbours for a smooth normal
  float disp(vec3 p){
    float t = uTime * 0.35;
    return fbm(p * 1.25 + vec3(0.0, t, t*0.5)) * uIntensity;
  }
  void main(){
    vec3 pos = position;
    float d = disp(pos);
    vec3 displaced = pos + normal * d * 0.42;
    // approximate normal via small finite differences -> smooth clay shading
    float eps = 0.08;
    vec3 tangent1 = normalize(cross(normal, vec3(0.0,1.0,0.0) + vec3(0.001)));
    vec3 tangent2 = normalize(cross(normal, tangent1));
    vec3 nb = pos + tangent1*eps;
    vec3 nc = pos + tangent2*eps;
    vec3 displacedB = nb + normal * disp(nb) * 0.42;
    vec3 displacedC = nc + normal * disp(nc) * 0.42;
    vec3 newNormal = normalize(cross(displacedB - displaced, displacedC - displaced));
    vNormal = normalize(normalMatrix * newNormal);
    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    vView = normalize(-mv.xyz);
    vDisp = d;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA; // highlight
  uniform vec3 uColorB; // mid (accent)
  uniform vec3 uColorC; // shadow
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDisp;
  void main(){
    vec3 N = normalize(vNormal);
    vec3 L = normalize(vec3(0.4, 0.8, 0.9));   // key light, upper-left
    float diff = max(dot(N, L), 0.0);
    // soft fill from below so shadows aren't pure black
    float fill = max(dot(N, vec3(-0.3, -0.4, 0.5)), 0.0) * 0.35;
    float fres = pow(1.0 - max(dot(N, vView), 0.0), 2.4); // rim
    // gentle specular for a sheen on the clay
    vec3 H = normalize(L + vView);
    float spec = pow(max(dot(N, H), 0.0), 28.0) * 0.5;
    vec3 base = mix(uColorC, uColorB, clamp(diff + 0.25, 0.0, 1.0));
    base += uColorB * fill;
    vec3 col = base + uColorA * spec + uColorB * fres * 0.6;
    // subtle depth tint from displacement
    col += (vDisp * 0.15) * uColorC;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* --------------------------- The mesh --------------------------- */
interface OrbMeshProps {
  state: OrbState;
}

// map orb state -> morph intensity (driven up while active)
const STATE_INTENSITY: Record<OrbState, number> = {
  boot: 0.25,
  idle: 0.45,
  listening: 0.85,
  thinking: 1.0,
  speaking: 0.95,
};

const OrbMesh: React.FC<OrbMeshProps> = ({ state }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: STATE_INTENSITY[state] ?? 0.5 },
      uColorA: { value: new THREE.Color('#FFD8B0') },
      uColorB: { value: new THREE.Color('#FF7A00') },
      uColorC: { value: new THREE.Color('#5E2200') },
    }),
    []
  );

  // smooth the intensity toward the target state
  const target = STATE_INTENSITY[state] ?? 0.5;

  useFrame((_, delta) => {
    if (matRef.current) {
      const u = matRef.current.uniforms;
      u.uTime.value += delta;
      const cur = u.uIntensity.value as number;
      u.uIntensity.value = cur + (target - cur) * Math.min(delta * 3, 1);
    }
    if (meshRef.current) {
      // gentle whole-body drift; faster when active
      const speed = state === 'idle' ? 0.15 : 0.5;
      meshRef.current.rotation.y += delta * speed;
      const s = 1 + Math.sin(performance.now() * 0.0015) * 0.02;
      meshRef.current.scale.setScalar(s);
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 5]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
      />
    </mesh>
  );
};

/* --------------------------- Public API --------------------------- */
interface AgentOrb3DProps {
  state?: OrbState;
  size?: number;
}

const AgentOrb3D: React.FC<AgentOrb3DProps> = ({ state = 'idle', size = 184 }) => {
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      {/* soft accent glow behind the 3D sphere */}
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 45%, var(--accent, #FF7A00), transparent 60%)',
          opacity: 0.22,
          filter: 'blur(16px)',
          zIndex: 0,
        }}
      />
      <Canvas
        camera={{ position: [0, 0, 3], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={1.1} />
        <OrbMesh state={state} />
      </Canvas>
    </div>
  );
};

export default AgentOrb3D;