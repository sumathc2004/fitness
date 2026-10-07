'use client';

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { ExerciseDto } from '@gym/types';
import { Button } from '@/components/ui/button';

// ───────────────────────── motion library for the built-in mannequin
type Motion = 'squat' | 'hinge' | 'lunge' | 'pushup' | 'plank' | 'curl' | 'press' | 'row' | 'raise' | 'lateral' | 'crunch' | 'cardio' | 'stretch' | 'generic';

export function motionFor(e: Pick<ExerciseDto, 'name' | 'category' | 'primaryMuscles'>): Motion {
  const n = e.name.toLowerCase();
  const has = (...k: string[]) => k.some((x) => n.includes(x));
  if (has('lunge', 'split squat', 'step-up', 'step up')) return 'lunge';
  if (has('squat')) return 'squat';
  if (has('deadlift', 'romanian', 'good morning', 'hinge', 'thrust', 'swing')) return 'hinge';
  if (has('push-up', 'pushup', 'push up')) return 'pushup';
  if (has('plank')) return 'plank';
  if (has('lateral', 'side raise')) return 'lateral';
  if (has('raise', 'fly', 'flye')) return 'raise';
  if (has('curl') && !has('leg curl')) return 'curl';
  if (has('row', 'pull', 'lat ')) return 'row';
  if (has('press', 'bench', 'dip', 'extension')) return 'press';
  if (has('crunch', 'sit-up', 'situp', 'leg raise')) return 'crunch';
  if (e.category === 'CARDIO' || has('run', 'jump', 'jack', 'burpee', 'climber', 'skip')) return 'cardio';
  if (e.category === 'STRETCH' || e.category === 'MOBILITY' || has('stretch')) return 'stretch';
  if (e.category === 'CORE') return 'crunch';
  return 'generic';
}

interface Pose { rootRot: number; lie: boolean; hL: number; hR: number; kL: number; kR: number; torso: number; aL: number; aR: number; abd: number; eL: number; eR: number; bob: number; plant: boolean }
const base = (): Pose => ({ rootRot: 0, lie: false, hL: 0, hR: 0, kL: 0, kR: 0, torso: 0, aL: 0.05, aR: 0.05, abd: 0.08, eL: 0.1, eR: 0.1, bob: 0, plant: true });
const ease = (p: number) => p * p * (3 - 2 * p);

function poseAt(m: Motion, t: number): Pose {
  const p = (Math.sin(t * 2 - Math.PI / 2) + 1) / 2; // 0..1 smooth loop
  const e = ease(p);
  const o = base();
  switch (m) {
    case 'squat': Object.assign(o, { hL: 1.4 * e, hR: 1.4 * e, kL: 1.55 * e, kR: 1.55 * e, torso: 0.5 * e, aL: 1.3 * e + 0.05, aR: 1.3 * e + 0.05, eL: 0.1, eR: 0.1 }); break;
    case 'hinge': Object.assign(o, { hL: 1.15 * e, hR: 1.15 * e, kL: 0.3 * e, kR: 0.3 * e, torso: 1.0 * e, aL: 1.0 * e + 0.05, aR: 1.0 * e + 0.05 }); break;
    case 'lunge': Object.assign(o, { hL: 1.25 * e, kL: 1.35 * e, hR: -0.55 * e, kR: 1.7 * e, torso: 0.1 * e, aL: 0.05, aR: 0.05 }); break;
    case 'pushup': Object.assign(o, { rootRot: 1.27 + 0.18 * e, aL: -0.95 * e, aR: -0.95 * e, eL: 0.95 * e, eR: 0.95 * e, lie: false, plant: true }); break;
    case 'plank': Object.assign(o, { rootRot: 1.36 + Math.sin(t * 3) * 0.01, aL: -1.55, aR: -1.55, eL: 1.55, eR: 1.55, plant: true }); break;
    case 'curl': Object.assign(o, { aL: 0.12, aR: 0.12, eL: 2.45 * e + 0.1, eR: 2.45 * e + 0.1 }); break;
    case 'press': Object.assign(o, { aL: 1.55 + 1.5 * e, aR: 1.55 + 1.5 * e, abd: 0.5 - 0.35 * e, eL: 1.9 * (1 - e) + 0.05, eR: 1.9 * (1 - e) + 0.05 }); break;
    case 'row': Object.assign(o, { hL: 0.7, hR: 0.7, kL: 0.35, kR: 0.35, torso: 1.0, aL: 1.0 - 1.1 * e, aR: 1.0 - 1.1 * e, eL: 0.25 + 1.5 * e, eR: 0.25 + 1.5 * e }); break;
    case 'raise': Object.assign(o, { aL: 1.65 * e + 0.05, aR: 1.65 * e + 0.05, eL: 0.1, eR: 0.1 }); break;
    case 'lateral': Object.assign(o, { aL: 0.05, aR: 0.05, abd: 1.55 * e + 0.08, eL: 0.12, eR: 0.12 }); break;
    case 'crunch': Object.assign(o, { rootRot: -Math.PI / 2, lie: true, hL: 1.0, hR: 1.0, kL: 1.6, kR: 1.6, torso: 0.95 * e, aL: 1.3, aR: 1.3, eL: 1.7, eR: 1.7, plant: false }); break;
    case 'cardio': {
      const s = Math.sin(t * 4);
      Object.assign(o, { hL: 0.9 * Math.max(0, s), hR: 0.9 * Math.max(0, -s), kL: 1.4 * Math.max(0, s), kR: 1.4 * Math.max(0, -s), aL: 0.7 * -s + 0.4, aR: 0.7 * s + 0.4, eL: 1.5, eR: 1.5, torso: 0.15, bob: Math.abs(s) * 0.05, plant: false });
      break;
    }
    case 'stretch': Object.assign(o, { aL: 2.9 * e + 0.05, aR: 2.9 * e + 0.05, abd: 0.25, eL: 0.05, eR: 0.05, torso: -0.12 * e }); break;
    default: { const s = Math.sin(t * 2); Object.assign(o, { aL: 0.35 * s + 0.2, aR: -0.35 * s + 0.2, eL: 0.4, eR: 0.4 }); }
  }
  return o;
}

// ───────────────────────── mannequin rig
const SKIN = '#d9a77f';
const SHIRT = '#65a30d';
const SHORTS = '#23272f';
const L = { thigh: 0.46, shin: 0.46, upper: 0.3, fore: 0.28, torso: 0.56, ankle: 0.07 };

function Limb({ len, r, color, children, rot }: { len: number; r: number; color: string; children?: ReactNode; rot: React.MutableRefObject<THREE.Group | null> }) {
  return (
    <group ref={rot}>
      <mesh position={[0, -len / 2, 0]} castShadow><capsuleGeometry args={[r, len - r * 2, 6, 14]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      <group position={[0, -len, 0]}>{children}</group>
    </group>
  );
}

function Mannequin({ motion, playing, speed }: { motion: Motion; playing: boolean; speed: number }) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const thL = useRef<THREE.Group>(null), thR = useRef<THREE.Group>(null), shL = useRef<THREE.Group>(null), shR = useRef<THREE.Group>(null);
  const uaL = useRef<THREE.Group>(null), uaR = useRef<THREE.Group>(null), faL = useRef<THREE.Group>(null), faR = useRef<THREE.Group>(null);
  const time = useRef(0);

  useFrame((_, dt) => {
    if (playing) time.current += dt * speed;
    const p = poseAt(motion, time.current);
    const g = root.current; if (!g) return;
    g.rotation.x = p.rootRot;
    // plant the feet: lift/shift the pelvis so the ankles stay on the floor
    const footY = (h: number, k: number) => L.thigh * Math.cos(h) + L.shin * Math.cos(k - h);
    const footZ = (h: number, k: number) => L.thigh * Math.sin(h) - L.shin * Math.sin(k - h);
    if (p.lie) { g.position.set(0, 0.2, 0.55); }
    else if (p.rootRot > 1) { g.position.set(0, L.ankle + (L.thigh + L.shin) * Math.cos(p.rootRot), (L.thigh + L.shin) * Math.sin(p.rootRot) - 0.55); }
    else if (p.plant) { const ref = motion === 'lunge' ? [p.hL, p.kL] as const : [p.hL, p.kL] as const; g.position.set(0, L.ankle + footY(ref[0], ref[1]), -footZ(ref[0], ref[1])); }
    else g.position.set(0, L.ankle + footY(0, 0) + p.bob, 0);
    if (motion === 'lunge') g.position.z += 0.0;

    if (torso.current) torso.current.rotation.x = p.torso;
    if (thL.current) { thL.current.rotation.x = -p.hL; }
    if (thR.current) { thR.current.rotation.x = -p.hR; }
    const kneeL = faL, kneeR = faR; void kneeL; void kneeR;
    const sh = (grp: THREE.Group | null, a: number, side: 1 | -1) => { if (!grp) return; grp.rotation.x = -a - p.torso - (p.rootRot > 1 ? 0 : 0); grp.rotation.z = side * p.abd; };
    // plank / push-up: keep arms vertical in world space
    if (p.rootRot > 1) { if (shL.current) { shL.current.rotation.x = -p.aL - p.rootRot - p.torso; shL.current.rotation.z = p.abd; } if (shR.current) { shR.current.rotation.x = -p.aR - p.rootRot - p.torso; shR.current.rotation.z = -p.abd; } }
    else { sh(shL.current, p.aL, 1); sh(shR.current, p.aR, -1); }
    if (faL.current) faL.current.rotation.x = -p.eL;
    if (faR.current) faR.current.rotation.x = -p.eR;
    void uaL; void uaR;
    // knees
    const lowerL = root.current?.getObjectByName('shinL'); const lowerR = root.current?.getObjectByName('shinR');
    if (lowerL) lowerL.rotation.x = p.kL; if (lowerR) lowerR.rotation.x = p.kR;
  });

  const rShinL = useRef<THREE.Group | null>(null), rShinR = useRef<THREE.Group | null>(null);
  void rShinL; void rShinR;
  const refGroup = (r: React.MutableRefObject<THREE.Group | null>) => r;
  return (
    <group ref={root}>
      {/* pelvis / shorts */}
      <mesh position={[0, 0.0, 0]} castShadow><capsuleGeometry args={[0.17, 0.12, 6, 16]} /><meshStandardMaterial color={SHORTS} roughness={0.8} /></mesh>
      {/* torso */}
      <group ref={torso} position={[0, 0.05, 0]}>
        <mesh position={[0, L.torso / 2, 0]} scale={[1.05, 1, 0.68]} castShadow><capsuleGeometry args={[0.2, L.torso - 0.4, 8, 18]} /><meshStandardMaterial color={SHIRT} roughness={0.75} /></mesh>
        <mesh position={[0, L.torso + 0.06, 0]}><cylinderGeometry args={[0.065, 0.075, 0.1, 14]} /><meshStandardMaterial color={SKIN} roughness={0.7} /></mesh>
        <mesh position={[0, L.torso + 0.22, 0]} castShadow><sphereGeometry args={[0.115, 24, 20]} /><meshStandardMaterial color={SKIN} roughness={0.65} /></mesh>
        <mesh position={[0, L.torso + 0.26, -0.015]} scale={[1, 0.8, 1.02]}><sphereGeometry args={[0.121, 24, 14, 0, Math.PI * 2, 0, Math.PI / 1.9]} /><meshStandardMaterial color="#2b2118" roughness={0.9} /></mesh>
        {/* arms */}
        <group position={[-0.265, L.torso - 0.05, 0]}><Limb rot={refGroup(shL)} len={L.upper} r={0.052} color={SHIRT}><Limb rot={refGroup(faL)} len={L.fore} r={0.044} color={SKIN}><mesh position={[0, -0.03, 0]}><sphereGeometry args={[0.05, 14, 12]} /><meshStandardMaterial color={SKIN} /></mesh></Limb></Limb></group>
        <group position={[0.265, L.torso - 0.05, 0]}><Limb rot={refGroup(shR)} len={L.upper} r={0.052} color={SHIRT}><Limb rot={refGroup(faR)} len={L.fore} r={0.044} color={SKIN}><mesh position={[0, -0.03, 0]}><sphereGeometry args={[0.05, 14, 12]} /><meshStandardMaterial color={SKIN} /></mesh></Limb></Limb></group>
      </group>
      {/* legs */}
      <group position={[-0.1, -0.02, 0]}><Limb rot={refGroup(thL)} len={L.thigh} r={0.075} color={SHORTS}><group name="shinL"><Limb rot={{ current: null }} len={L.shin} r={0.058} color={SKIN}><mesh position={[0, -0.04, 0.05]} scale={[1, 0.6, 1.9]}><sphereGeometry args={[0.055, 14, 12]} /><meshStandardMaterial color="#e9e9ee" /></mesh></Limb></group></Limb></group>
      <group position={[0.1, -0.02, 0]}><Limb rot={refGroup(thR)} len={L.thigh} r={0.075} color={SHORTS}><group name="shinR"><Limb rot={{ current: null }} len={L.shin} r={0.058} color={SKIN}><mesh position={[0, -0.04, 0.05]} scale={[1, 0.6, 1.9]}><sphereGeometry args={[0.055, 14, 12]} /><meshStandardMaterial color="#e9e9ee" /></mesh></Limb></group></Limb></group>
    </group>
  );
}

function GlbModel({ url, clip, playing, speed }: { url: string; clip: string | null; playing: boolean; speed: number }) {
  const gltf = useGLTF(url);
  const group = useRef<THREE.Group>(null);
  const { actions, names, mixer } = useAnimations(gltf.animations, group);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  useEffect(() => {
    const name = clip && names.includes(clip) ? clip : names[0];
    const a = name ? actions[name] : null;
    a?.reset().play();
    return () => { a?.stop(); };
  }, [actions, names, clip]);
  useEffect(() => { mixer.timeScale = playing ? speed : 0; }, [mixer, playing, speed]);
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const k = 1.8 / Math.max(size.y, 0.001);
    scene.scale.setScalar(k);
    box.setFromObject(scene);
    scene.position.y -= box.min.y;
    scene.position.x -= (box.min.x + box.max.x) / 2;
    scene.position.z -= (box.min.z + box.max.z) / 2;
  }, [scene]);
  return <group ref={group}><primitive object={scene} /></group>;
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function ExerciseViewer({ exercise }: { exercise: ExerciseDto }) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState(0);
  const motion = useMemo(() => motionFor(exercise), [exercise]);
  const asset = exercise.assets[0];
  const mannequin = <Mannequin motion={motion} playing={playing} speed={speed} />;
  const floor = motion === 'pushup' || motion === 'plank' || motion === 'crunch';
  const cam: [number, number, number] = asset ? [0, 1.2, 4.2] : floor ? [4.3, 1.3, 1.6] : ['squat', 'lunge', 'hinge', 'row'].includes(motion) ? [3.3, 1.35, 3.1] : [1.6, 1.4, 4.3];
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent sm:aspect-[16/10]">
        <Canvas key={view} shadows camera={{ position: cam, fov: 36 }} dpr={[1, 2]} aria-label={`3D demonstration of ${exercise.name}`}>
          <hemisphereLight args={['#ffffff', '#3a4350', 1.1]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[-3, 2, -2]} intensity={0.6} />
          <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
          <Suspense fallback={null}>
            {asset ? <Boundary fallback={mannequin}><GlbModel url={asset.url} clip={asset.animationClip} playing={playing} speed={speed} /></Boundary> : mannequin}
            <ContactShadows position={[0, 0.001, 0]} opacity={0.5} scale={5} blur={2.4} far={2.5} />
          </Suspense>
          <OrbitControls ref={controls} target={[0, floor ? 0.35 : 0.85, 0]} enablePan={false} minDistance={1.6} maxDistance={5} maxPolarAngle={Math.PI / 2 + 0.1} />
        </Canvas>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] p-2">
          <Button size="icon" variant="secondary" className="size-9" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause /> : <Play />}</Button>
          <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">Speed<input type="range" min={0.3} max={1.8} step={0.1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" aria-label="Animation speed" /></label>
          <Button size="icon" variant="ghost" className="size-9" onClick={() => setView((v) => v + 1)} aria-label="Reset view"><RotateCcw /></Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{asset ? `Model: ${asset.credit ?? 'uploaded GLB'}. ` : 'Built-in demonstration figure — a trainer or admin can upload a GLB model for this exercise. '}Drag to rotate, scroll to zoom.</p>
    </div>
  );
}
