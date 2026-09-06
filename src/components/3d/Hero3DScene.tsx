"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, ContactShadows, Text } from "@react-three/drei";
import { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";

const BUILDING_POSITIONS = [
  // Row 0 (Base)
  { x: -6.6, y: -4, z: 0 }, { x: -3.3, y: -4, z: 0 }, { x: 0, y: -4, z: 0 }, { x: 3.3, y: -4, z: 0 }, { x: 6.6, y: -4, z: 0 },
  // Row 1
  { x: -4.95, y: -2.9, z: 0 }, { x: -1.65, y: -2.9, z: 0 }, { x: 1.65, y: -2.9, z: 0 }, { x: 4.95, y: -2.9, z: 0 },
  // Row 2
  { x: -6.6, y: -1.8, z: 0 }, { x: -3.3, y: -1.8, z: 0 }, { x: 0, y: -1.8, z: 0 }, { x: 3.3, y: -1.8, z: 0 }, { x: 6.6, y: -1.8, z: 0 },
  // Row 3
  { x: -4.95, y: -0.7, z: 0 }, { x: -1.65, y: -0.7, z: 0 }, { x: 1.65, y: -0.7, z: 0 }, { x: 4.95, y: -0.7, z: 0 },
  // Row 4 (Roof tier 1)
  { x: -3.3, y: 0.4, z: 0 }, { x: 0, y: 0.4, z: 0 }, { x: 3.3, y: 0.4, z: 0 },
  // Row 5 (Roof tier 2)
  { x: -1.65, y: 1.5, z: 0 }, { x: 1.65, y: 1.5, z: 0 },
  // Row 6 (Peak)
  { x: 0, y: 2.6, z: 0 }
];

function ArchitecturalBrick({ index, logoTexture }: { index: number, logoTexture: THREE.CanvasTexture | null }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const colorHex = useMemo(() => {
    const colors = ["#8A3324", "#A5402D", "#C15438", "#7A2E20", "#9E3C26"];
    const baseColor = new THREE.Color(colors[index % colors.length]);
    baseColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05);
    return baseColor;
  }, [index]);

  // Building state (a stepped pyramid / house shape)
  const piledOffset = useMemo(() => {
    const pos = BUILDING_POSITIONS[index] || { x: 0, y: 0, z: 0 };
    return {
      x: pos.x,
      y: pos.y, 
      z: pos.z,
      rx: 0,
      ry: 0,
      rz: 0,
    };
  }, [index]);

  // Scattered state (explode away when scrolling)
  const COLS = 6;
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  
  const spreadOffset = useMemo(() => {
    const dirX = col - 2.5; 
    const dirY = row - 2; 
    return {
      x: dirX * 6 + (Math.random() - 0.5) * 4,
      y: dirY * 6 + (Math.random() - 0.5) * 4 + 4,
      z: (Math.random() - 0.5) * 10 - 5,
      rx: Math.random() * Math.PI * 2, 
      ry: Math.random() * Math.PI * 2,
      rz: Math.random() * Math.PI * 2,
    };
  }, [row, col]);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    const scrollY = window.scrollY;
    // Progress from 0 to 1 as user scrolls from 0 to 600px down
    const progress = Math.min(Math.max(scrollY / 600, 0), 1);
    
    // Ease function for smooth scattering
    const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    const targetPos = {
      x: THREE.MathUtils.lerp(piledOffset.x, spreadOffset.x, ease),
      y: THREE.MathUtils.lerp(piledOffset.y, spreadOffset.y, ease),
      z: THREE.MathUtils.lerp(piledOffset.z, spreadOffset.z, ease),
      rx: THREE.MathUtils.lerp(piledOffset.rx, spreadOffset.rx, ease),
      ry: THREE.MathUtils.lerp(piledOffset.ry, spreadOffset.ry, ease),
      rz: THREE.MathUtils.lerp(piledOffset.rz, spreadOffset.rz, ease),
    };

    const time = state.clock.elapsedTime;
    // Add a very tiny breathing effect to the building to make it feel alive
    const breath = Math.sin(time * 2 + index) * 0.05 * (1 - ease); // Breath stops as it scatters

    meshRef.current.position.set(targetPos.x, targetPos.y + breath, targetPos.z);
    meshRef.current.rotation.set(targetPos.rx, targetPos.ry, targetPos.rz);
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[3.2, 1, 1.5]} />
      <meshStandardMaterial 
        color={colorHex} 
        roughness={0.9} 
        metalness={0.05} 
        map={logoTexture} 
      />
    </mesh>
  );
}

function BrickAssembly() {
  const TOTAL_BRICKS = BUILDING_POSITIONS.length;

  const logoTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Use white background so it multiplies with the individual brick colors (White * Color = Color)
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 512, 512);
      
      // Use a dark shade for the text so it multiplies to a darker brick color (engraved look)
      ctx.fillStyle = "#333333"; 
      ctx.font = "bold 140px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // BoxGeometry applies the whole texture to each face.
      ctx.fillText("AVM", 256, 256);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16;
    return texture;
  }, []);

  return (
    // Physically shift the entire assembly to the right side (but not off-screen)
    <group position={[6, -2, 0]} scale={0.7}>
      {Array.from({ length: TOTAL_BRICKS }).map((_, i) => (
        <ArchitecturalBrick key={i} index={i} logoTexture={logoTexture} />
      ))}
    </group>
  );
}

export default function Hero3DScene() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) return null;

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-40 lg:opacity-100">
      <Canvas camera={{ position: [-2, 2, 30], fov: 32 }}>
        <ambientLight intensity={0.4} color="#08111F" />
        <directionalLight position={[-8, 12, 10]} intensity={1.8} color="#FFF4E6" />
        <directionalLight position={[10, 5, -5]} intensity={0.8} color="#8BA4C7" />
        <pointLight position={[5, -2, -5]} intensity={3} color="#E85D04" distance={40} />
        
        <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.2}>
          <BrickAssembly />
        </Float>
        
        <ContactShadows position={[6, -4, 0]} opacity={0.6} scale={30} blur={2.5} far={4} color="#050A14" />
      </Canvas>
    </div>
  );
}
