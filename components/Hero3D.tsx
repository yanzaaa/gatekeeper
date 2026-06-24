"use client";

import { Canvas } from "@react-three/fiber";
import { Float, Icosahedron, MeshDistortMaterial } from "@react-three/drei";

// A premium, lightweight 3D centerpiece: a slowly morphing emerald gem inside a faceted
// wireframe cage. No HDR/network assets, capped DPR, so it stays smooth.
export default function Hero3D() {
  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [0, 0, 4.4], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none", background: "transparent" }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 5, 4]} intensity={1.5} />
      <pointLight position={[-5, -2, -2]} intensity={1.3} color="#38b6ff" />
      <pointLight position={[3, -3, 2]} intensity={0.9} color="#36e29a" />
      <Float speed={1.3} rotationIntensity={0.9} floatIntensity={1.2}>
        <Icosahedron args={[1.3, 4]}>
          <MeshDistortMaterial
            color="#1c8b5f"
            roughness={0.3}
            metalness={0}
            distort={0.36}
            speed={1.6}
            emissive="#35e6a0"
            emissiveIntensity={0.55}
          />
        </Icosahedron>
        <Icosahedron args={[1.62, 1]}>
          <meshBasicMaterial color="#6cf2bb" wireframe transparent opacity={0.1} />
        </Icosahedron>
      </Float>
    </Canvas>
  );
}
