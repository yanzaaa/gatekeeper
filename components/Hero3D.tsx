"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Icosahedron, Edges } from "@react-three/drei";
import type { Group } from "three";

// A faceted emerald crystal (low-poly, flat-shaded) with glowing edges, slowly rotating
// inside a counter-rotating wireframe cage. Geometric and intentional, not a blob.
function Crystal() {
  const gem = useRef<Group>(null!);
  const cage = useRef<Group>(null!);
  useFrame((_, dt) => {
    if (gem.current) {
      gem.current.rotation.y += dt * 0.3;
      gem.current.rotation.x += dt * 0.09;
    }
    if (cage.current) {
      cage.current.rotation.y -= dt * 0.16;
      cage.current.rotation.z += dt * 0.05;
    }
  });
  return (
    <group>
      <group ref={gem}>
        <Icosahedron args={[1.35, 0]}>
          <meshStandardMaterial
            color="#0f7a52"
            flatShading
            metalness={0.18}
            roughness={0.22}
            emissive="#22b37c"
            emissiveIntensity={0.28}
          />
          <Edges threshold={1} color="#7df7c4" />
        </Icosahedron>
      </group>
      <group ref={cage}>
        <Icosahedron args={[1.82, 0]}>
          <meshBasicMaterial color="#4fd3a0" wireframe transparent opacity={0.16} />
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
      <directionalLight position={[4, 5, 4]} intensity={1.7} />
      <directionalLight position={[-5, -2, -3]} intensity={0.8} color="#38b6ff" />
      <pointLight position={[2, -3, 3]} intensity={0.9} color="#36e29a" />
      <Crystal />
    </Canvas>
  );
}
