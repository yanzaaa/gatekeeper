"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Icosahedron, Edges } from "@react-three/drei";
import type { Group } from "three";

// A faceted amethyst crystal (low-poly, flat-shaded) lit by aurora-colored lights,
// slowly rotating and bobbing inside a counter-rotating wireframe cage.
function Crystal() {
  const gem = useRef<Group>(null!);
  const cage = useRef<Group>(null!);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (gem.current) {
      gem.current.rotation.y += dt * 0.28;
      gem.current.rotation.x += dt * 0.08;
      gem.current.position.y = Math.sin(t * 0.7) * 0.07;
    }
    if (cage.current) {
      cage.current.rotation.y -= dt * 0.14;
      cage.current.rotation.z += dt * 0.05;
    }
  });
  return (
    <group>
      <group ref={gem}>
        <Icosahedron args={[1.35, 0]}>
          <meshStandardMaterial
            color="#6d3bef"
            flatShading
            metalness={0.28}
            roughness={0.18}
            emissive="#8b5cff"
            emissiveIntensity={0.3}
          />
          <Edges threshold={1} color="#e2c4ff" />
        </Icosahedron>
      </group>
      <group ref={cage}>
        <Icosahedron args={[1.82, 0]}>
          <meshBasicMaterial color="#6ee7ff" wireframe transparent opacity={0.16} />
        </Icosahedron>
      </group>
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
      camera={{ position: [0, 0, 4.8], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none", background: "transparent" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 5, 4]} intensity={1.5} />
      <pointLight position={[-5, -2, -3]} intensity={1.4} color="#c026d3" />
      <pointLight position={[3, -3, 3]} intensity={1.1} color="#22d3ee" />
      <pointLight position={[0, 4, 2]} intensity={0.9} color="#a78bfa" />
      <Crystal />
    </Canvas>
  );
}
