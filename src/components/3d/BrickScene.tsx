"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, ContactShadows, RoundedBox } from "@react-three/drei";
import { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";

function ArchitecturalBrick({ index, total, ...props }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Premium, rich, natural Terracotta colors
  const colorHex = useMemo(() => {
    const colors = ["#8A3324", "#A5402D", "#C15438", "#7A2E20", "#9E3C26"];
    const baseColor = new THREE.Color(colors[index % colors.length]);
    // Tiny random variation for realism
    baseColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05);
    return baseColor;
  }, [index]);

  // "Kumugu Kadakura" state: A chaotic, piled-up heap at the bottom
  const piledOffset = useMemo(() => {
    // Simulate a dropped pile using layers (pyramid structure)
    const level = Math.floor(index / 5); // levels 0, 1, 2, 3
    const posInLevel = index % 5;
    
    // Arrange in a messy circle that gets tighter at the top
    const angle = (posInLevel / 5) * Math.PI * 2 + (level * 0.8);
    const radius = Math.max(0.5, 3.5 - level * 0.8);
    
    return {
      x: Math.cos(angle) * radius + (Math.random() - 0.5) * 1.5,
      y: level * 1.2 - 4, // Piled near the ground
      z: Math.sin(angle) * radius + (Math.random() - 0.5) * 1.5,
      rx: (Math.random() - 0.5) * 0.8, // Tilted resting on each other
      ry: Math.random() * Math.PI, // Completely random Y rotation
      rz: (Math.random() - 0.5) * 0.8,
    };
  }, [index]);

  // "Spread aganum" state: Beautifully floating, separated grid in the air
  const COLS = 5;
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  
  const spreadOffset = useMemo(() => {
    const dirX = col - 2; 
    const dirY = row - 1.5; 
    
    return {
      x: dirX * 3.8, // Spread wide horizontally
      y: dirY * 3.5 + 2, // Spread high vertically
      z: (Math.random() - 0.5) * 4 - 2, // Spread in depth
      rx: Math.random() * 0.4 - 0.2, 
      ry: Math.random() * 0.4 - 0.2,
      rz: Math.random() * 0.4 - 0.2,
    };
  }, [row, col]);

  // "Assembled" state: Perfect masonry wall
  const assembledOffset = useMemo(() => {
    const isEvenRow = row % 2 === 0;
    const brickWidth = 3.2;
    const gap = 0.1;
    const xOffset = isEvenRow ? 0 : (brickWidth + gap) / 2;
    const startX = -((COLS * brickWidth) / 2) + brickWidth / 2;
    
    return {
      x: startX + col * (brickWidth + gap) + xOffset,
      y: row * 1.1 - 2, 
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0,
    };
  }, [row, col]);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    // Use full document height for continuous scrolling effect
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const scrollY = window.scrollY;
    const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
    
    let targetPos = { ...piledOffset };
    
    // Timeline logic
    // Phase 1 (0 to 0.2): Pile to Spread (Manufacturing)
    if (progress < 0.2) {
      const p = Math.min(progress / 0.2, 1);
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      targetPos.x = THREE.MathUtils.lerp(piledOffset.x, spreadOffset.x, ease);
      targetPos.y = THREE.MathUtils.lerp(piledOffset.y, spreadOffset.y, ease);
      targetPos.z = THREE.MathUtils.lerp(piledOffset.z, spreadOffset.z, ease);
      targetPos.rx = THREE.MathUtils.lerp(piledOffset.rx, spreadOffset.rx, ease);
      targetPos.ry = THREE.MathUtils.lerp(piledOffset.ry, spreadOffset.ry, ease);
      targetPos.rz = THREE.MathUtils.lerp(piledOffset.rz, spreadOffset.rz, ease);
    } 
    // Phase 2 (0.2 to 0.5): Spread to Assembled Wall (Products)
    else if (progress < 0.5) {
      const p = Math.min((progress - 0.2) / 0.3, 1);
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      targetPos.x = THREE.MathUtils.lerp(spreadOffset.x, assembledOffset.x, ease);
      targetPos.y = THREE.MathUtils.lerp(spreadOffset.y, assembledOffset.y, ease);
      targetPos.z = THREE.MathUtils.lerp(spreadOffset.z, assembledOffset.z, ease);
      targetPos.rx = THREE.MathUtils.lerp(spreadOffset.rx, assembledOffset.rx, ease);
      targetPos.ry = THREE.MathUtils.lerp(spreadOffset.ry, assembledOffset.ry, ease);
      targetPos.rz = THREE.MathUtils.lerp(spreadOffset.rz, assembledOffset.rz, ease);
    }
    // Phase 3 (0.5 to 1.0): Sink away gracefully so they don't block the footer
    else {
      const p = Math.min((progress - 0.5) / 0.5, 1);
      const ease = p * p * p; // late acceleration
      
      // The wall slowly sinks down into the abyss as you reach the footer
      targetPos.x = THREE.MathUtils.lerp(assembledOffset.x, assembledOffset.x * 1.5, p);
      targetPos.y = THREE.MathUtils.lerp(assembledOffset.y, assembledOffset.y - 40 * ease, p); // Sink deep down
      targetPos.z = THREE.MathUtils.lerp(assembledOffset.z, assembledOffset.z - 10 * ease, p); // Push slightly back
      
      targetPos.rx = THREE.MathUtils.lerp(assembledOffset.rx, assembledOffset.rx + Math.PI * ease, p); // Tumble backwards
      targetPos.ry = THREE.MathUtils.lerp(assembledOffset.ry, assembledOffset.ry, p);
      targetPos.rz = THREE.MathUtils.lerp(assembledOffset.rz, assembledOffset.rz, p);
    }

    // Add subtle floating breath to whatever state they are in
    const time = state.clock.elapsedTime;
    const breath = Math.sin(time + index) * 0.2;

    meshRef.current.position.x = targetPos.x;
    meshRef.current.position.y = targetPos.y + breath;
    meshRef.current.position.z = targetPos.z;

    meshRef.current.rotation.x = targetPos.rx;
    meshRef.current.rotation.y = targetPos.ry;
    meshRef.current.rotation.z = targetPos.rz;
  });

  return (
    <RoundedBox 
      ref={meshRef} 
      args={[3.2, 1, 1.5]} 
      radius={0.04} // Extremely subtle, realistic chamfer
      smoothness={4} 
      castShadow 
      receiveShadow
      {...props}
    >
      <meshStandardMaterial 
        color={colorHex} 
        roughness={0.9} 
        metalness={0.05}
      />
    </RoundedBox>
  );
}

function BrickAssembly() {
  const groupRef = useRef<THREE.Group>(null);
  const [isMobile, setIsMobile] = useState(false);
  const ROWS = 4;
  const COLS = 5;
  const TOTAL_BRICKS = ROWS * COLS;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize(); // Check initially
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      const scrollY = window.scrollY;
      const moveProgress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
      
      const mouseX = (state.pointer.x * Math.PI) / 10;
      const mouseY = (state.pointer.y * Math.PI) / 10;
      
      // Stop the extreme sweeping rotation. Just a majestic subtle shift.
      groupRef.current.position.z = THREE.MathUtils.lerp(0, isMobile ? -15 : -10, moveProgress);
      // On mobile, keep it centered. On desktop, shift it left as you scroll
      groupRef.current.position.x = THREE.MathUtils.lerp(0, isMobile ? 0 : -3, moveProgress); 
      
      const baseRotationY = -0.25;
      const targetRotationY = 0.2; // Gentle rotation
      
      groupRef.current.rotation.y = THREE.MathUtils.lerp(baseRotationY, targetRotationY, moveProgress) + mouseX * 0.15;
      groupRef.current.rotation.x = mouseY * 0.1;
    }
  });

  return (
    // On mobile, center it horizontally and push it down slightly. On desktop, shift right.
    <group ref={groupRef} position={isMobile ? [0, -4, -8] : [3, -2, 0]}>
      {Array.from({ length: TOTAL_BRICKS }).map((_, i) => (
        <ArchitecturalBrick key={i} index={i} total={TOTAL_BRICKS} />
      ))}
    </group>
  );
}

export default function BrickScene() {
  return (
    <div className="w-full h-screen fixed top-0 inset-x-0 z-0 pointer-events-none overflow-hidden">
      <div className="w-full h-full lg:w-[80%] lg:ml-auto lg:right-0">
        <Canvas 
          shadows 
          camera={{ position: [0, 2, 30], fov: 32 }} // Tight, cinematic architectural framing
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          dpr={[1, 1.5]}
        >
          {/* Moody, dramatic lighting setup */}
          <ambientLight intensity={0.4} color="#08111F" />
          
          {/* Main Key Light (Warm Sun) */}
          <directionalLight 
            position={[-8, 12, 10]} 
            intensity={1.8} 
            color="#FFF4E6" 
            castShadow 
            shadow-mapSize={2048} // High quality shadows
            shadow-bias={-0.0001}
          />
          
          {/* Cool Fill Light for shadow details */}
          <directionalLight 
            position={[10, 5, -5]} 
            intensity={0.8} 
            color="#8BA4C7" 
          />

          {/* Deep Orange Rim Light */}
          <pointLight 
            position={[5, -2, -5]} 
            intensity={3} 
            color="#E85D04" 
            distance={40}
          />

          <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.2}>
            <BrickAssembly />
          </Float>

          {/* Subtle natural atmosphere */}
          <Sparkles 
            count={40} 
            scale={18} 
            size={1} 
            speed={0.2} 
            opacity={0.1} 
            color="#FFF8F1" 
          />
          
          {/* Soft Ground Shadow */}
          <ContactShadows 
            position={[2, -5, 0]} 
            opacity={0.7} 
            scale={35} 
            blur={3} 
            far={8} 
            color="#050A14"
          />
        </Canvas>
      </div>
    </div>
  );
}
