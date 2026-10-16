"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function Core() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = state.clock.elapsedTime * 0.12;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.08;
  });
  return (
    <group ref={group}>
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.8}>
        <mesh>
          <icosahedronGeometry args={[1.2, 4]} />
          <meshStandardMaterial color="#dff5ff" emissive="#27b3ff" emissiveIntensity={3.5} roughness={0.2} metalness={0.1} />
        </mesh>
        <mesh scale={1.45}>
          <icosahedronGeometry args={[1.2, 3]} />
          <meshBasicMaterial color="#27b3ff" transparent opacity={0.07} wireframe />
        </mesh>
      </Float>
      <Sparkles count={110} scale={6} size={3} speed={0.45} opacity={0.8} color="#7bd4ff" />
    </group>
  );
}

export default function EnergyScene() {
  return (
    <div className="absolute inset-0">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 42 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[2, 2, 3]} intensity={25} color="#27b3ff" />
        <Core />
      </Canvas>
    </div>
  );
}
