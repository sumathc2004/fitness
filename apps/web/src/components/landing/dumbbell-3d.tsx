'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Float, Lightformer, OrbitControls } from '@react-three/drei';
import type { Group } from 'three';

function Dumbbell() {
  const group = useRef<Group>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.4;
  });

  const steel = <meshStandardMaterial color="#cfd6de" metalness={1} roughness={0.2} />;
  const rubber = <meshStandardMaterial color="#1b1f23" metalness={0.45} roughness={0.38} />;
  const lime = <meshStandardMaterial color="#c8ff2e" emissive="#6fa000" emissiveIntensity={0.55} roughness={0.35} />;

  const plate = (x: number) => (
    <group position={[x, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.78, 0.78, 0.18, 64]} />{rubber}</mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.78, 0.022, 16, 80]} />{lime}</mesh>
      <mesh position={[Math.sign(x) * 0.17, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.6, 0.6, 0.14, 64]} />{rubber}</mesh>
      <mesh position={[Math.sign(x) * 0.17, 0, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.6, 0.016, 16, 80]} />{steel}</mesh>
    </group>
  );

  return (
    <group ref={group} rotation={[0.28, 0, 0.12]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.07, 0.07, 3.1, 32]} />{steel}</mesh>
      {[-0.35, -0.18, 0, 0.18, 0.35].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.085, 0.085, 0.07, 32]} />{steel}</mesh>
      ))}
      {plate(-1.1)}
      {plate(1.1)}
      {[-1.6, 1.6].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.17, 0.17, 0.2, 32]} />{steel}</mesh>
      ))}
    </group>
  );
}

export default function Dumbbell3D() {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.8, 6.6], fov: 38 }} aria-label="Interactive 3D dumbbell — drag to rotate">
      <ambientLight intensity={0.35} />
      <spotLight position={[4, 6, 4]} angle={0.4} penumbra={1} intensity={90} castShadow color="#ffffff" />
      <pointLight position={[-4, 1, -2]} intensity={14} color="#c8ff2e" />
      {/* Studio lighting built from light-panels, so nothing is downloaded at runtime. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 5, -4]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={2} position={[-5, 1, 2]} scale={[3, 6, 1]} color="#c8ff2e" />
        <Lightformer form="rect" intensity={2} position={[5, 1, 2]} scale={[3, 6, 1]} />
      </Environment>
      <Float speed={1.6} rotationIntensity={0.15} floatIntensity={0.8}><Dumbbell /></Float>
      <ContactShadows position={[0, -1.35, 0]} opacity={0.55} scale={9} blur={2.6} far={3} />
      <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3.2} maxPolarAngle={Math.PI / 1.9} />
    </Canvas>
  );
}
