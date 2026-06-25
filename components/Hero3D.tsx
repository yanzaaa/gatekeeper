"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Gatekeeper, visualized: a luminous gate (ring) with a stream of refund
// requests flowing toward it. Routine ones pass straight through (aurora mint);
// risky ones are caught and held at the gate, pulsing amber, then cleared.
const COUNT = 30;
const C_PASS = new THREE.Color("#4ee6b0");   // approved / passes through
const C_HELD = new THREE.Color("#f6c065");   // held back at the gate

type Token = { x: number; y: number; z: number; speed: number; risky: boolean; held: number; spin: number };

function spawn(fresh: boolean): Token {
  return {
    x: (Math.random() - 0.5) * 0.95,
    y: (Math.random() - 0.5) * 0.95,
    z: fresh ? -6.5 - Math.random() * 3 : -3 - Math.random() * 6.5,
    speed: 0.55 + Math.random() * 0.5,
    risky: Math.random() < 0.24,
    held: 0,
    spin: Math.random() * Math.PI,
  };
}

function GateScene() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const gate = useRef<THREE.Group>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const tokens = useMemo(() => Array.from({ length: COUNT }, () => spawn(false)), []);
  const GATE_Z = 0;

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05); // clamp to avoid jumps after tab refocus
    const time = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      let t = tokens[i];
      if (t.risky && t.z >= GATE_Z - 0.05 && t.held < 1.5) {
        t.held += dt;          // caught and held at the gate
        t.z = GATE_Z - 0.05;
      } else {
        t.z += dt * t.speed;   // flowing through
      }
      if (t.z > 3.6 || t.held >= 1.5) {
        tokens[i] = spawn(true);
        t = tokens[i];
      }
      const pulse = t.held > 0 ? 1 + Math.sin(time * 9) * 0.25 : 1;
      const size = (t.risky ? 0.13 : 0.1) * pulse;
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(t.spin + t.z * 0.55, t.spin + t.z * 0.45, 0);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      mesh.current.setColorAt(i, t.risky ? C_HELD : C_PASS);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    if (gate.current) {
      gate.current.rotation.z += dt * 0.1;
      gate.current.rotation.x = Math.sin(time * 0.3) * 0.12;
      gate.current.rotation.y = Math.cos(time * 0.22) * 0.1;
    }
  });

  return (
    <group>
      <group ref={gate}>
        {/* the gate */}
        <mesh>
          <torusGeometry args={[1.15, 0.07, 24, 96]} />
          <meshStandardMaterial color="#7c3aed" emissive="#a78bfa" emissiveIntensity={0.75} metalness={0.45} roughness={0.25} />
        </mesh>
        {/* thin concentric halo rings */}
        <mesh>
          <torusGeometry args={[1.42, 0.012, 10, 96]} />
          <meshBasicMaterial color="#c4b5fd" transparent opacity={0.35} toneMapped={false} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.9, 0.01, 10, 96]} />
          <meshBasicMaterial color="#f0abfc" transparent opacity={0.3} toneMapped={false} />
        </mesh>
      </group>
      {/* flowing tokens */}
      <instancedMesh ref={mesh} args={[geo, mat, COUNT]} />
    </group>
  );
}

export default function Hero3D() {
  // R3F can latch onto the parent's pre-layout size; nudge a re-measure.
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 140);
    return () => clearTimeout(t);
  }, []);
  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [0, 0.25, 5], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none", background: "transparent" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 5, 4]} intensity={1.3} />
      <pointLight position={[-5, -2, -3]} intensity={1.2} color="#c026d3" />
      <pointLight position={[3, -3, 3]} intensity={0.9} color="#22d3ee" />
      <GateScene />
    </Canvas>
  );
}
