"use client";

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Edges, Bounds, BakeShadows, Center, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useCalculator } from './CalculatorContext';
import { toMeters } from '@/lib/brickCalculator';
import { Maximize, RotateCcw, Box, View, LayoutDashboard, AlertTriangle } from 'lucide-react';

import { SharedBrickWall } from '../3d/SharedBrickWall';

function CameraController({ preset }: { preset: string }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    const ctrl = controlsRef.current;
    
    switch (preset) {
      case 'front':
        ctrl.setAzimuthalAngle(0);
        ctrl.setPolarAngle(Math.PI/2 - 0.2);
        break;
      case 'back':
        ctrl.setAzimuthalAngle(Math.PI);
        ctrl.setPolarAngle(Math.PI/2 - 0.2);
        break;
      case 'left':
        ctrl.setAzimuthalAngle(-Math.PI/2);
        ctrl.setPolarAngle(Math.PI/2 - 0.2);
        break;
      case 'right':
        ctrl.setAzimuthalAngle(Math.PI/2);
        ctrl.setPolarAngle(Math.PI/2 - 0.2);
        break;
      case 'top':
        ctrl.setPolarAngle(0);
        ctrl.setAzimuthalAngle(0);
        break;
      case 'iso':
        ctrl.setAzimuthalAngle(Math.PI/4);
        ctrl.setPolarAngle(Math.PI/3);
        break;
    }
  }, [preset]);

  return (
    <OrbitControls 
      ref={controlsRef}
      makeDefault 
      enableZoom={true}
      enablePan={true}
      minPolarAngle={0} 
      maxPolarAngle={Math.PI / 2 + 0.1}
      maxDistance={100}
      minDistance={2}
    />
  );
}

export default function StructurePreview3D() {
  const { walls, pillars, mode, brickType, settings, hasCalculated } = useCalculator();
  const [wireframe, setWireframe] = useState(false);
  const [viewPreset, setViewPreset] = useState<string>('iso');
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setWebglSupported(!!gl);
    } catch (e) {
      setWebglSupported(false);
    }
  }, []);

  if (!hasCalculated) return null;

  // Determine wall positions based on mode
  const renderWalls = () => {
    if (mode === 'single') {
      return <SharedBrickWall wall={walls[0]} brickType={brickType} settings={settings} wireframe={wireframe} />;
    }
    
    if (mode === 'room' || mode === 'bathroom') {
      // Create a rectangular room. Walls: 0=North, 1=East, 2=South, 3=West
      const wN = walls[0];
      const wE = walls[1] || walls[0];
      const wS = walls[2] || walls[0];
      const wW = walls[3] || walls[0];

      // Explicitly gather and route openings
      const allRoomOpenings = [
        ...(wN.openings || []),
        ...(wE !== wN ? (wE.openings || []) : []),
        ...(wS !== wN ? (wS.openings || []) : []),
        ...(wW !== wN ? (wW.openings || []) : [])
      ];

      const frontOpenings = allRoomOpenings.filter(o => o.wallSide === 'Front Wall' || !o.wallSide);
      const rightOpenings = allRoomOpenings.filter(o => o.wallSide === 'Right Wall');
      const backOpenings = allRoomOpenings.filter(o => o.wallSide === 'Back Wall');
      const leftOpenings = allRoomOpenings.filter(o => o.wallSide === 'Left Wall');

      const wallFront = { ...wN, openings: frontOpenings };
      const wallRight = { ...wE, openings: rightOpenings };
      const wallBack = { ...wS, openings: backOpenings };
      const wallLeft = { ...wW, openings: leftOpenings };
      
      const lN = toMeters(wallFront.dimensions.length, wallFront.dimensions.unit);
      const lE = toMeters(wallRight.dimensions.length, wallRight.dimensions.unit);

      return (
        <group>
          {/* North / Front */}
          <group position={[0, 0, -lE/2]}>
            <SharedBrickWall wall={wallFront} brickType={brickType} settings={settings} wireframe={wireframe} />
            {wireframe && <Html position={[0, 1, 0]} center><div className="text-white text-[10px] font-bold bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">Front Wall</div></Html>}
          </group>
          {/* East / Right */}
          <group position={[lN/2, 0, 0]} rotation={[0, Math.PI/2, 0]}>
            <SharedBrickWall wall={wallRight} brickType={brickType} settings={settings} wireframe={wireframe} />
            {wireframe && <Html position={[0, 1, 0]} center><div className="text-white text-[10px] font-bold bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">Right Wall</div></Html>}
          </group>
          {/* South / Back */}
          <group position={[0, 0, lE/2]} rotation={[0, Math.PI, 0]}>
            <SharedBrickWall wall={wallBack} brickType={brickType} settings={settings} wireframe={wireframe} />
            {wireframe && <Html position={[0, 1, 0]} center><div className="text-white text-[10px] font-bold bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">Back Wall</div></Html>}
          </group>
          {/* West / Left */}
          <group position={[-lN/2, 0, 0]} rotation={[0, -Math.PI/2, 0]}>
            <SharedBrickWall wall={wallLeft} brickType={brickType} settings={settings} wireframe={wireframe} />
            {wireframe && <Html position={[0, 1, 0]} center><div className="text-white text-[10px] font-bold bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">Left Wall</div></Html>}
          </group>
          {/* Floor Slab */}
          {!wireframe && (
            <mesh position={[0, -0.05, 0]} receiveShadow>
              <boxGeometry args={[lN + 0.5, 0.1, lE + 0.5]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
            </mesh>
          )}
        </group>
      );
    }
    
    if (mode === 'balcony') {
      const wN = walls[0];
      const wE = walls[1] || walls[0];
      const wW = walls[2] || walls[0];
      
      const lN = toMeters(wN.dimensions.length, wN.dimensions.unit);
      const lE = toMeters(wE.dimensions.length, wE.dimensions.unit);
      const lW = toMeters(wW.dimensions.length, wW.dimensions.unit);

      return (
        <group>
          <SharedBrickWall wall={wN} brickType={brickType} settings={settings} position={[0, 0, -lE/2]} wireframe={wireframe} />
          <SharedBrickWall wall={wE} brickType={brickType} settings={settings} position={[lN/2, 0, 0]} rotation={[0, Math.PI/2, 0]} wireframe={wireframe} />
          <SharedBrickWall wall={wW} brickType={brickType} settings={settings} position={[-lN/2, 0, 0]} rotation={[0, -Math.PI/2, 0]} wireframe={wireframe} />
          {!wireframe && (
            <mesh position={[0, -0.05, 0]} receiveShadow>
              <boxGeometry args={[lN + 0.5, 0.1, Math.max(lE, lW) + 0.5]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
            </mesh>
          )}
        </group>
      );
    }
    
    if (mode === 'compound') {
      const w = walls[0];
      const l = toMeters(w.dimensions.length, w.dimensions.unit);
      const h = toMeters(w.dimensions.height, w.dimensions.unit);
      
      return (
        <group>
          <SharedBrickWall wall={w} brickType={brickType} settings={settings} position={[0, 0, 0]} wireframe={wireframe} />
          
          {/* Pillars Rendering (Abstract representation) */}
          {!wireframe && pillars.length > 0 && pillars[0].count > 0 && (
            <group>
              {Array.from({ length: pillars[0].count }).map((_, i) => {
                const spacing = l / (pillars[0].count - 1 || 1);
                const x = -l/2 + (i * spacing);
                const pW = toMeters(pillars[0].width, pillars[0].unit);
                const pD = toMeters(pillars[0].depth, pillars[0].unit);
                const pH = toMeters(pillars[0].height, pillars[0].unit);
                
                return (
                  <mesh key={i} position={[x, pH/2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[pW, pH, pD]} />
                    <meshStandardMaterial color="#8a3324" roughness={0.9} />
                  </mesh>
                );
              })}
            </group>
          )}
        </group>
      );
    }
    
    if (mode === 'building') {
      // Simplified small building layout (outer box + simple partition)
      const wN = walls[0];
      const wE = walls[1] || walls[0];
      
      const lN = toMeters(wN.dimensions.length, wN.dimensions.unit);
      const lE = toMeters(wE.dimensions.length, wE.dimensions.unit);

      return (
        <group>
          <SharedBrickWall wall={wN} brickType={brickType} settings={settings} position={[0, 0, -lE/2]} wireframe={wireframe} />
          <SharedBrickWall wall={{...wE, dimensions: {...wE.dimensions, length: wE.dimensions.length}}} brickType={brickType} settings={settings} position={[lN/2, 0, 0]} rotation={[0, Math.PI/2, 0]} wireframe={wireframe} />
          <SharedBrickWall wall={wN} brickType={brickType} settings={settings} position={[0, 0, lE/2]} wireframe={wireframe} />
          <SharedBrickWall wall={wE} brickType={brickType} settings={settings} position={[-lN/2, 0, 0]} rotation={[0, Math.PI/2, 0]} wireframe={wireframe} />
          
          {/* Internal partition wall example */}
          <SharedBrickWall wall={{...wE, dimensions: {...wE.dimensions, length: wE.dimensions.length}}} brickType={brickType} settings={settings} position={[0, 0, 0]} rotation={[0, Math.PI/2, 0]} wireframe={wireframe} />
          
          {!wireframe && (
            <mesh position={[0, -0.05, 0]} receiveShadow>
              <boxGeometry args={[lN + 1, 0.1, lE + 1]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
            </mesh>
          )}
        </group>
      );
    }
    
    // Multiple mode (side by side)
    let currentX = 0;
    return walls.map((wall, index) => {
      const l = toMeters(wall.dimensions.length, wall.dimensions.unit);
      const posX = currentX + l / 2;
      currentX += l + 1; // 1m gap
      return (
        <SharedBrickWall 
          key={wall.id} 
          wall={wall} 
          brickType={brickType} 
          settings={settings} 
          position={[posX, 0, 0]} 
          wireframe={wireframe} 
        />
      );
    });
  };

  return (
    <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden mt-8 mb-16 relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4 z-0"></div>
      
      <div className="p-6 md:p-8 border-b border-slate-800 relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Box className="h-6 w-6 text-primary" /> 3D Structure Preview
          </h2>
          <p className="text-slate-400 text-sm mt-1">Interactive visual representation of your estimated structure</p>
          {(mode === 'room' || mode === 'bathroom') && (
            <p className="text-primary/90 text-xs mt-2 font-medium bg-primary/10 inline-block px-2 py-1 rounded">Doors and windows shown only on the selected wall sides.</p>
          )}
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => setWireframe(!wireframe)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${wireframe ? 'bg-primary text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            {wireframe ? 'Solid View' : 'Wireframe'}
          </button>
        </div>
      </div>

      <div 
        className="w-full h-[500px] md:h-[600px] relative z-10 bg-slate-950 touch-none"
        data-lenis-prevent="true"
        onWheel={(e) => e.stopPropagation()}
      >
        {webglSupported === false ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-900 rounded-lg">
            <AlertTriangle className="w-12 h-12 text-orange-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-200 mb-2">WebGL Not Supported</h3>
            <p className="text-sm max-w-md mx-auto mb-4">
              Your browser could not initialize the WebGL context required for 3D rendering. Please enable <strong>Hardware Acceleration</strong> in your browser settings and restart your browser.
            </p>
          </div>
        ) : webglSupported === null ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 rounded-lg text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p>Initializing 3D Engine...</p>
          </div>
        ) : (
          <Canvas 
            shadows 
            dpr={[1, 1.5]} 
            camera={{ position: [5, 5, 5], fov: 45 }}
            gl={{ failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: true }}
            fallback={
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-900 rounded-lg">
                <AlertTriangle className="w-12 h-12 text-orange-500 mb-4" />
                <h3 className="text-lg font-bold text-slate-200 mb-2">WebGL Not Supported</h3>
                <p className="text-sm max-w-md mx-auto mb-4">
                  Your browser could not initialize the WebGL context. Please enable Hardware Acceleration in your browser settings.
                </p>
              </div>
            }
          >
          <color attach="background" args={['#020617']} />
          <ambientLight intensity={0.5} />
          <hemisphereLight args={['#ffffff', '#475569', 0.6]} />
          <directionalLight castShadow position={[10, 10, 5]} intensity={1.5} shadow-mapSize={[1024, 1024]} />
          <Center top>
            {renderWalls()}
          </Center>

          {/* frames={1} is critical for performance: it bakes the soft shadow once instead of every frame */}
          <ContactShadows resolution={512} frames={1} position={[0, 0, 0]} opacity={0.4} scale={50} blur={2} far={10} />
          <gridHelper args={[50, 50, '#1e293b', '#0f172a']} position={[0, 0, 0]} />

          <CameraController preset={viewPreset} />
          <BakeShadows />
        </Canvas>
        )}

        {/* View Presets at Bottom Center */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700 shadow-xl flex gap-1 z-20">
          <button onClick={() => setViewPreset('iso')} className={`px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${viewPreset === 'iso' ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Iso</button>
          <button onClick={() => setViewPreset('front')} className={`px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${viewPreset === 'front' ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Front</button>
          <button onClick={() => setViewPreset('back')} className={`px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${viewPreset === 'back' ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Back</button>
          <button onClick={() => setViewPreset('left')} className={`px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${viewPreset === 'left' ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Left</button>
          <button onClick={() => setViewPreset('right')} className={`px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${viewPreset === 'right' ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Right</button>
          <button onClick={() => setViewPreset('top')} className={`px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${viewPreset === 'top' ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Top</button>
        </div>

        {/* Navigation Info */}
        <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-slate-700 shadow-xl pointer-events-none hidden sm:block">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Navigation Controls</p>
          <div className="text-xs text-slate-300 space-y-1">
            <p>🖱️ <b>Left Click + Drag</b>: Rotate</p>
            <p>🖱️ <b>Right Click + Drag</b>: Pan</p>
            <p>⚙️ <b>Scroll</b>: Zoom In/Out</p>
          </div>
        </div>
        
        <div className="absolute top-4 left-4 bg-primary/90 text-white text-[10px] font-bold px-2 py-1 rounded">
          Approximate Visual Preview
        </div>
      </div>
      
      <div className="bg-slate-900 p-4 md:p-6 border-t border-slate-800 text-xs text-slate-500 leading-relaxed">
        <p><b>Disclaimer:</b> This 3D preview is an approximate visualization based on the dimensions and assumptions you entered. Brick quantities, mortar, openings, wall arrangements, and costs are estimates only. This is not an engineering drawing, structural plan, load-bearing calculation, or construction approval. Please consult a qualified civil engineer, architect, or contractor before construction.</p>
      </div>
    </div>
  );
}
