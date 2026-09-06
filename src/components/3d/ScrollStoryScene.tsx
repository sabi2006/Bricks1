"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, ContactShadows, RoundedBox } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";

function SingleBrick() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.1} floatIntensity={0.2}>
      <RoundedBox 
        ref={meshRef} 
        args={[3.2, 1, 1.5]} 
        radius={0.05} 
        smoothness={4} 
        castShadow 
        receiveShadow
      >
        <meshStandardMaterial 
          color="#A83D27" 
          roughness={0.8} 
          metalness={0.1}
        />
      </RoundedBox>
    </Float>
  );
}

function BrickWall({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const ROWS = 6;
  const COLS = 5;
  const TOTAL = ROWS * COLS;
  
  useFrame(() => {
    if (groupRef.current) {
      // Assemble based on progress
      const p = Math.max(0, Math.min((progress - 0.25) / 0.25, 1));
      groupRef.current.position.y = THREE.MathUtils.lerp(-10, -2, p);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(Math.PI, 0, p);
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: TOTAL }).map((_, i) => {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        const isEvenRow = row % 2 === 0;
        const brickWidth = 3.2;
        const gap = 0.1;
        const xOffset = isEvenRow ? 0 : (brickWidth + gap) / 2;
        const startX = -((COLS * brickWidth) / 2) + brickWidth / 2;
        
        return (
          <RoundedBox 
            key={i}
            args={[3.2, 1, 1.5]} 
            radius={0.05} 
            smoothness={4} 
            castShadow 
            receiveShadow
            position={[
              startX + col * (brickWidth + gap) + xOffset,
              row * 1.1,
              0
            ]}
          >
            <meshStandardMaterial 
              color="#A83D27" 
              roughness={0.8} 
              metalness={0.1}
            />
          </RoundedBox>
        );
      })}
    </group>
  );
}

function RoomStructure({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (groupRef.current) {
      const p = Math.max(0, Math.min((progress - 0.5) / 0.25, 1));
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(0, 1, p));
      groupRef.current.rotation.y = THREE.MathUtils.lerp(-Math.PI/2, Math.PI/4, p);
    }
  });

  return (
    <group ref={groupRef} position={[0, -2, 0]}>
      {/* Front Wall with door */}
      <mesh position={[-2, 2, 5]} castShadow receiveShadow>
        <boxGeometry args={[4, 4, 0.5]} />
        <meshStandardMaterial color="#F05A00" roughness={0.7} />
      </mesh>
      <mesh position={[3.5, 2, 5]} castShadow receiveShadow>
        <boxGeometry args={[3, 4, 0.5]} />
        <meshStandardMaterial color="#F05A00" roughness={0.7} />
      </mesh>
      <mesh position={[0, 5, 5]} castShadow receiveShadow>
        <boxGeometry args={[10, 2, 0.5]} />
        <meshStandardMaterial color="#F05A00" roughness={0.7} />
      </mesh>
      
      {/* Back Wall */}
      <mesh position={[0, 3, -5]} castShadow receiveShadow>
        <boxGeometry args={[10, 6, 0.5]} />
        <meshStandardMaterial color="#A83D27" roughness={0.7} />
      </mesh>
      
      {/* Left Wall */}
      <mesh position={[-5, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 6, 10]} />
        <meshStandardMaterial color="#F05A00" roughness={0.7} />
      </mesh>
      
      {/* Right Wall */}
      <mesh position={[5, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 6, 10]} />
        <meshStandardMaterial color="#A83D27" roughness={0.7} />
      </mesh>
      
      {/* Floor */}
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[10.5, 0.5, 10.5]} />
        <meshStandardMaterial color="#6B7280" roughness={0.9} />
      </mesh>
    </group>
  );
}

function BuildingStructure({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (groupRef.current) {
      const p = Math.max(0, Math.min((progress - 0.75) / 0.25, 1));
      groupRef.current.position.y = THREE.MathUtils.lerp(-20, -2, p);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(0, Math.PI * 2.25, p);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main Building Block */}
      <mesh position={[0, 4, 0]} castShadow receiveShadow>
        <boxGeometry args={[8, 8, 8]} />
        <meshStandardMaterial color="#111827" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 8.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[9, 1, 9]} />
        <meshStandardMaterial color="#0F172A" roughness={0.6} />
      </mesh>
      {/* Balcony */}
      <mesh position={[0, 3, 4.5]} castShadow receiveShadow>
        <boxGeometry args={[4, 0.5, 2]} />
        <meshStandardMaterial color="#6B7280" roughness={0.8} />
      </mesh>
    </group>
  );
}

function SceneOrchestrator({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const [progress, setProgress] = useState(0);
  const masterGroupRef = useRef<THREE.Group>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile to adjust 3D object shifting
  // We use useEffect instead of useLayoutEffect for Next.js SSR compatibility
  useState(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < 768);
    }
  });

  useFrame(() => {
    setProgress(progressRef.current);
    
    if (masterGroupRef.current) {
      // Shift left and right to make room for text on desktop
      const shiftAmount = isMobile ? 0 : 5.5;
      // cos(progress * 4 * PI) maps [0, 0.25, 0.5, 0.75, 1.0] to [1, -1, 1, -1, 1]
      const targetX = Math.cos(progressRef.current * Math.PI * 4) * shiftAmount;
      
      masterGroupRef.current.position.x = THREE.MathUtils.lerp(
        masterGroupRef.current.position.x,
        targetX,
        0.05
      );
    }
  });

  return (
    <group ref={masterGroupRef}>
      <ambientLight intensity={0.5} color="#FAFAF9" />
      <directionalLight 
        position={[10, 20, 15]} 
        intensity={2} 
        color="#FFFFFF" 
        castShadow 
        shadow-mapSize={2048}
        shadow-bias={-0.0001}
      />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#F05A00" />
      
      {progress < 0.35 && <SingleBrick />}
      {progress >= 0.15 && progress < 0.6 && <BrickWall progress={progress} />}
      {progress >= 0.4 && progress < 0.85 && <RoomStructure progress={progress} />}
      {progress >= 0.65 && <BuildingStructure progress={progress} />}

      <Sparkles count={50} scale={20} size={2} speed={0.4} opacity={0.2} color="#F05A00" />
      <ContactShadows position={[0, -3, 0]} opacity={0.6} scale={40} blur={2.5} color="#0F172A" />
    </group>
  );
}

export default function ScrollStoryScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const progressRef = useRef(0);
  
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    progressRef.current = latest;
  });

  return (
    <div ref={containerRef} className="relative w-full bg-[#0F172A]" style={{ height: "500vh" }}>
      
      {/* Sticky Canvas background */}
      <div className="sticky top-0 w-full h-screen overflow-hidden">
        <Canvas shadows camera={{ position: [0, 2, 20], fov: 35 }}>
          <SceneOrchestrator progressRef={progressRef} />
        </Canvas>
      </div>

      {/* HTML Content Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col">
          
          {/* Page 1: Text Left */}
          <div className="h-screen flex items-end md:items-center pb-24 md:pb-0">
            <div className="w-full md:w-1/2 md:pr-12 text-center md:text-left pointer-events-auto">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.5 }}
                className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-6 drop-shadow-lg"
              >
                Every Strong Structure Starts With <span className="text-primary">One Brick.</span>
              </motion.h2>
              <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white/90 font-medium text-sm border border-white/20 shadow-xl">
                Manufactured for Strength
              </div>
            </div>
          </div>

          {/* Page 2: Text Right */}
          <div className="h-screen flex items-end md:items-center justify-end pb-24 md:pb-0">
            <div className="w-full md:w-1/2 md:pl-12 text-center md:text-right pointer-events-auto">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.5 }}
                className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-6 drop-shadow-lg"
              >
                Built for Every Wall.<br/>Made for Every <span className="text-primary">Dream.</span>
              </motion.h2>
            </div>
          </div>

          {/* Page 3: Text Left */}
          <div className="h-screen flex items-end md:items-center pb-24 md:pb-0">
            <div className="w-full md:w-1/2 md:pr-12 text-center md:text-left pointer-events-auto">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.5 }}
                className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-6 drop-shadow-lg"
              >
                From Brick Quantity to Your <span className="text-primary">Room Preview.</span>
              </motion.h2>
              <button className="px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgba(240,90,0,0.39)] hover:bg-[#F97316] transition-all">
                Try the Advanced Brick Calculator
              </button>
            </div>
          </div>

          {/* Page 4: Text Right */}
          <div className="h-screen flex items-end md:items-center justify-end pb-24 md:pb-0">
            <div className="w-full md:w-1/2 md:pl-12 text-center md:text-right pointer-events-auto flex flex-col md:items-end items-center">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.5 }}
                className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-6 drop-shadow-lg"
              >
                See Your Project Before You <span className="text-primary">Build It.</span>
              </motion.h2>
              <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white/90 font-medium text-sm border border-white/20 mb-8 shadow-xl">
                AI-Assisted Approximate Structure Preview
              </div>
              <button className="px-8 py-4 bg-white/10 border border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-all">
                Upload Your House Plan
              </button>
            </div>
          </div>

          {/* Page 5: Buffer space for transition out */}
          <div className="h-screen" />
          
        </div>
      </div>
      
    </div>
  );
}
