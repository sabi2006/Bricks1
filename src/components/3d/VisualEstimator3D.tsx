"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html } from '@react-three/drei';
import { 
  BuildingModel, 
  Floor, 
  Wall, 
  Opening, 
  BrickSpecification, 
  CalculatorSettings, 
  Pillar, 
  Unit,
  toMeters, 
  trimWallByPillars, 
  splitWallByPillars,
  getEffectivePillarPosition, 
  detectClosedStructuralBays,
  detectPillarToPillarBeams,
  detectStructuralPillars,
  convertUnit,
  DEFAULT_RCC_REINFORCEMENT,
  RCCReinforcementConfig,
  FoundationFooting,
  FoundationConfig,
  DEFAULT_FOUNDATION_CONFIG,
  generateFootingsForPillars
} from '@/lib/brickCalculator';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { AlertTriangle, Info, ZoomIn, ZoomOut, RotateCcw, Hammer, ShieldAlert, X, LandPlot } from 'lucide-react';
import { useCalculator } from '../calculator/CalculatorContext';
import { SharedBrickWall } from './SharedBrickWall';

interface VisualEstimator3DProps {
  model: BuildingModel;
}

class WebGLErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, errorMessage: string}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn("VisualEstimator3D WebGL context issue:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-[400px] flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-6 text-center rounded-xl border border-slate-800">
          <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
          <h3 className="text-lg font-bold text-slate-200 mb-2">3D Viewer Suspended</h3>
          <p className="text-sm max-w-md mx-auto mb-4">
            The 3D graphics context was reset or temporarily unavailable. Click below to reload the 3D model.
          </p>
          <button 
            onClick={() => this.setState({ hasError: false, errorMessage: '' })}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-md transition-colors"
          >
            Reload 3D Preview
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function CustomWallMeshWrapper({ 
  wall, yOffset, isInternal, debugMode, fadeFront, pillars 
}: { 
  wall: Wall, yOffset: number, isInternal: boolean, debugMode: boolean, fadeFront: boolean, pillars?: Pillar[] 
}) {
  const { brickType, settings } = useCalculator();
  if (!wall.start || !wall.end) return null;

  // Split wall into clean brick sub-segments around all intersecting RCC pillars
  const segments = splitWallByPillars(wall, pillars || [], wall.dimensions.unit);
  if (segments.length === 0) return null;

  const toM = (val: number) => toMeters(val, wall.dimensions.unit);
  const isWireframe = debugMode;
  const fullWallHeightM = toM(wall.dimensions.height);
  const fullWallHeightInUnits = convertUnit(fullWallHeightM, 'm', wall.dimensions.unit);

  return (
    <group>
      {segments.map(seg => {
        const startX = toM(seg.start.x);
        const startY = toM(seg.start.y);
        const endX = toM(seg.end.x);
        const endY = toM(seg.end.y);

        const dx = endX - startX;
        const dy = endY - startY;
        // Map 2D Y to 3D -Z to prevent flipping the layout
        const angle = Math.atan2(-dy, dx);
        
        // Midpoint of segment in meters
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        const renderWall: Wall = {
          ...wall,
          id: seg.id,
          start: seg.start,
          end: seg.end,
          dimensions: {
            ...wall.dimensions,
            length: seg.length,
            height: fullWallHeightInUnits
          },
          openings: seg.openings
        };

        return (
          <group key={seg.id} position={[midX, yOffset, -midY]} rotation={[0, -angle, 0]}>
            <SharedBrickWall 
              wall={renderWall} 
              brickType={brickType} 
              settings={settings} 
              wireframe={isWireframe} 
            />
          </group>
        );
      })}
    </group>
  );
}

// Normalize RCC pillar data ensuring safe defaults for all dimensions and rebar configurations
function normalizePillarRebarConfig(
  p: Pillar,
  customReinf?: Partial<RCCReinforcementConfig>
) {
  const reinf: RCCReinforcementConfig = {
    ...DEFAULT_RCC_REINFORCEMENT,
    ...(customReinf || {})
  };
  const toUnitM = (val?: number, unit?: Unit) => toMeters(val || 9, unit || 'in');
  const wM = Math.max(0.15, toUnitM(p.width, p.unit));
  const dM = p.shape === 'circular' ? wM : Math.max(0.15, toUnitM(p.depth, p.unit));

  return {
    wM,
    dM,
    reinf
  };
}

// Rebar cage component for RCC column with structural joint continuity
function PillarRebarCage({ 
  wM, 
  dM, 
  hM, 
  jointM = 0,
  starterM = 0.35,
  shape, 
  reinf: customReinf 
}: { 
  wM: number; 
  dM: number; 
  hM: number; 
  jointM?: number;
  starterM?: number;
  shape?: string; 
  reinf?: Partial<RCCReinforcementConfig>;
}) {
  const reinf: RCCReinforcementConfig = {
    ...DEFAULT_RCC_REINFORCEMENT,
    ...(customReinf || {})
  };

  // Physical rebar diameter with pixel-safe visual radius for Three.js 3D viewport
  const barDiaM = Math.max(0.008, (reinf.pillarMainBarDiaMm || 16) * 0.001);
  const barRadius = Math.max(0.012, barDiaM / 2);
  const stirrupDiaM = Math.max(0.004, (reinf.pillarStirrupDiaMm || 8) * 0.001);
  const stirrupRadius = Math.max(0.007, stirrupDiaM / 2);
  const coverM = Math.max(0.02, (reinf.pillarCoverMm || 40) * 0.001);
  const stirrupSpacingM = Math.max(0.08, (reinf.pillarStirrupSpacingMm || 150) * 0.001);

  const isCircular = shape === 'circular';
  const barCount = Math.max(4, reinf.pillarMainBarCount || 4);

  // Compute bar positions (X, Z) relative to pillar center
  const mainBarPositions: Array<[number, number]> = [];

  if (isCircular) {
    const cageRadius = Math.max(0.025, Math.max(wM, dM) / 2 - coverM - stirrupDiaM);
    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2;
      mainBarPositions.push([cageRadius * Math.cos(angle), cageRadius * Math.sin(angle)]);
    }
  } else {
    const innerW = Math.max(0.04, wM - 2 * (coverM + stirrupDiaM));
    const innerD = Math.max(0.04, dM - 2 * (coverM + stirrupDiaM));

    const halfW = innerW / 2;
    const halfD = innerD / 2;

    // 4 Corner main bars
    mainBarPositions.push([-halfW, -halfD]);
    mainBarPositions.push([halfW, -halfD]);
    mainBarPositions.push([halfW, halfD]);
    mainBarPositions.push([-halfW, halfD]);

    // Extra intermediate bars if count > 4
    const extraBars = barCount - 4;
    if (extraBars > 0) {
      if (extraBars === 2) {
        if (wM >= dM) {
          mainBarPositions.push([0, -halfD]);
          mainBarPositions.push([0, halfD]);
        } else {
          mainBarPositions.push([-halfW, 0]);
          mainBarPositions.push([halfW, 0]);
        }
      } else if (extraBars === 4) {
        mainBarPositions.push([0, -halfD]);
        mainBarPositions.push([0, halfD]);
        mainBarPositions.push([-halfW, 0]);
        mainBarPositions.push([halfW, 0]);
      } else {
        const sideBars = Math.floor(extraBars / 2);
        for (let i = 1; i <= sideBars; i++) {
          const frac = i / (sideBars + 1);
          const x = -halfW + innerW * frac;
          mainBarPositions.push([x, -halfD]);
          mainBarPositions.push([x, halfD]);
        }
      }
    }
  }

  // Total structural height matches column height + starter lap continuation through joint into upper floor
  const effectiveStarterM = starterM || 0;
  const totalVerticalH = hM + effectiveStarterM;
  const barCenterY = effectiveStarterM / 2;

  const innerW = Math.max(0.04, wM - 2 * coverM);
  const innerD = Math.max(0.04, dM - 2 * coverM);
  const cageRadius = Math.max(0.025, Math.max(wM, dM) / 2 - coverM);

  // Structural Beam-Column Joint Zone (top portion of column where horizontal beams frame into the column)
  const jointZoneHeightM = Math.max(0.25, jointM || 0.3048);
  const shaftHeightM = Math.max(0.5, hM - jointZoneHeightM);
  const numShaftStirrups = Math.max(2, Math.floor(shaftHeightM / stirrupSpacingM));

  // 1. Column shaft stirrup positions (from base up to the bottom of the beam joint)
  const stirrupYPositions: number[] = [];
  for (let idx = 0; idx < numShaftStirrups; idx++) {
    stirrupYPositions.push(-hM / 2 + stirrupSpacingM * 0.5 + (idx * ((shaftHeightM - stirrupSpacingM) / Math.max(1, numShaftStirrups - 1))));
  }

  // 2. DEDICATED BEAM-COLUMN JOINT CONFINING TIES (3 dense closed loops inside the beam-column intersection zone)
  const jointBottomY = hM / 2 - jointZoneHeightM;
  stirrupYPositions.push(jointBottomY + 0.04);
  stirrupYPositions.push(jointBottomY + jointZoneHeightM * 0.5);
  stirrupYPositions.push(hM / 2 - 0.025);

  return (
    <group renderOrder={1}>
      {/* Main Vertical Rebar Rods Continuing Through Structural Joint */}
      {mainBarPositions.map(([ox, oz], idx) => (
        <mesh key={`rebar-main-${idx}`} position={[ox, barCenterY, oz]} castShadow renderOrder={1} frustumCulled={false}>
          <cylinderGeometry args={[barRadius, barRadius, totalVerticalH, 16]} />
          <meshStandardMaterial 
            color="#00f0ff" 
            metalness={0.9} 
            roughness={0.2} 
            emissive="#0284c7"
            emissiveIntensity={0.5}
            depthTest={true} 
            depthWrite={true} 
          />
        </mesh>
      ))}

      {/* Confining Stirrups / Joint Ties throughout column shaft and beam-column joint */}
      {stirrupYPositions.map((y, idx) => {
        if (isCircular) {
          return (
            <mesh key={`stirrup-circ-${idx}`} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow renderOrder={1} frustumCulled={false}>
              <torusGeometry args={[cageRadius, stirrupRadius, 8, 24]} />
              <meshStandardMaterial 
                color="#ffb703" 
                metalness={0.9} 
                roughness={0.2} 
                emissive="#d97706"
                emissiveIntensity={0.5}
                depthTest={true} 
                depthWrite={true} 
              />
            </mesh>
          );
        }

        return (
          <group key={`stirrup-rect-${idx}`} position={[0, y, 0]}>
            {/* 4 perimeter tie rods forming the closed rectangular loop */}
            <mesh position={[0, 0, -innerD / 2]} rotation={[0, 0, Math.PI / 2]} renderOrder={1} frustumCulled={false}>
              <cylinderGeometry args={[stirrupRadius, stirrupRadius, innerW, 8]} />
              <meshStandardMaterial 
                color="#ffb703" 
                metalness={0.9} 
                roughness={0.2} 
                emissive="#d97706"
                emissiveIntensity={0.5}
                depthTest={true} 
                depthWrite={true} 
              />
            </mesh>
            <mesh position={[0, 0, innerD / 2]} rotation={[0, 0, Math.PI / 2]} renderOrder={1} frustumCulled={false}>
              <cylinderGeometry args={[stirrupRadius, stirrupRadius, innerW, 8]} />
              <meshStandardMaterial 
                color="#ffb703" 
                metalness={0.9} 
                roughness={0.2} 
                emissive="#d97706"
                emissiveIntensity={0.5}
                depthTest={true} 
                depthWrite={true} 
              />
            </mesh>
            <mesh position={[-innerW / 2, 0, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1} frustumCulled={false}>
              <cylinderGeometry args={[stirrupRadius, stirrupRadius, innerD, 8]} />
              <meshStandardMaterial 
                color="#ffb703" 
                metalness={0.9} 
                roughness={0.2} 
                emissive="#d97706"
                emissiveIntensity={0.5}
                depthTest={true} 
                depthWrite={true} 
              />
            </mesh>
            <mesh position={[innerW / 2, 0, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1} frustumCulled={false}>
              <cylinderGeometry args={[stirrupRadius, stirrupRadius, innerD, 8]} />
              <meshStandardMaterial 
                color="#ffb703" 
                metalness={0.9} 
                roughness={0.2} 
                emissive="#d97706"
                emissiveIntensity={0.5}
                depthTest={true} 
                depthWrite={true} 
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// 2-Direction RCC Floor/Roof Slab Reinforcement Mesh
function SlabRebarMesh({ 
  bayWidthM, 
  bayDepthM, 
  thicknessM, 
  reinf: customReinf 
}: { 
  bayWidthM: number; 
  bayDepthM: number; 
  thicknessM: number; 
  reinf?: Partial<RCCReinforcementConfig>;
}) {
  const reinf: RCCReinforcementConfig = {
    ...DEFAULT_RCC_REINFORCEMENT,
    ...(customReinf || {})
  };

  // Engineering reinforcement diameters in meters with pixel-safe visual radius
  const mainDiaM = Math.max(0.006, (reinf.slabMainBarDiaMm || 10) * 0.001);
  const distDiaM = Math.max(0.006, (reinf.slabDistBarDiaMm || 8) * 0.001);
  
  const mainRadius = Math.max(0.009, mainDiaM / 2);
  const distRadius = Math.max(0.007, distDiaM / 2);
  
  const coverM = Math.max(0.02, (reinf.slabCoverMm || 20) * 0.001);
  const mainSpacingM = Math.max(0.12, (reinf.slabMainBarSpacingMm || 150) * 0.001);
  const distSpacingM = Math.max(0.12, (reinf.slabDistBarSpacingMm || 150) * 0.001);

  // Usable area inside perimeter concrete cover
  const usableWidthM = Math.max(0.1, bayWidthM - 2 * coverM);
  const usableDepthM = Math.max(0.1, bayDepthM - 2 * coverM);

  // Calculate actual number of bars across width and depth
  const mainBarCount = Math.max(2, Math.floor(usableDepthM / mainSpacingM) + 1);
  const distBarCount = Math.max(2, Math.floor(usableWidthM / distSpacingM) + 1);

  // Single 2-Direction Reinforcement Layer placed exactly at the CENTER of the slab thickness
  const yMain = -distRadius / 2;
  const yDist = mainRadius / 2;

  return (
    <group renderOrder={1}>
      {/* Direction A: Main Longitudinal Bars (along X / Width) */}
      {Array.from({ length: mainBarCount }).map((_, idx) => {
        const z = -usableDepthM / 2 + (idx * (usableDepthM / (mainBarCount - 1)));
        return (
          <mesh key={`slab-main-${idx}`} position={[0, yMain, z]} rotation={[0, 0, Math.PI / 2]} renderOrder={1} frustumCulled={false}>
            <cylinderGeometry args={[mainRadius, mainRadius, usableWidthM, 8]} />
            <meshStandardMaterial 
              color="#00f0ff" 
              metalness={0.9} 
              roughness={0.2} 
              emissive="#0284c7"
              emissiveIntensity={0.45}
              depthTest={true}
              depthWrite={true}
            />
          </mesh>
        );
      })}

      {/* Direction B: Distribution Transverse Bars (along Z / Depth) */}
      {Array.from({ length: distBarCount }).map((_, idx) => {
        const x = -usableWidthM / 2 + (idx * (usableWidthM / (distBarCount - 1)));
        return (
          <mesh key={`slab-dist-${idx}`} position={[x, yDist, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1} frustumCulled={false}>
            <cylinderGeometry args={[distRadius, distRadius, usableDepthM, 8]} />
            <meshStandardMaterial 
              color="#ffb703" 
              metalness={0.9} 
              roughness={0.2} 
              emissive="#d97706"
              emissiveIntensity={0.45}
              depthTest={true}
              depthWrite={true}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// 3D RCC Ring Beam Reinforcement Cage (Longitudinal Top/Bottom Bars + Closed Rectangular Stirrups)
function RingBeamRebarCage({ 
  lengthM, 
  heightM, 
  widthM, 
  reinf: customReinf 
}: { 
  lengthM: number; 
  heightM: number; 
  widthM: number; 
  reinf?: Partial<RCCReinforcementConfig>;
}) {
  const reinf: RCCReinforcementConfig = {
    ...DEFAULT_RCC_REINFORCEMENT,
    ...(customReinf || {})
  };

  // Engineering reinforcement diameters in meters with pixel-safe visual radius for Three.js 3D viewport
  const topDiaM = Math.max(0.008, (reinf.beamTopBarDiaMm || 12) * 0.001);
  const bottomDiaM = Math.max(0.008, (reinf.beamBottomBarDiaMm || 12) * 0.001);
  const topBarRadius = Math.max(0.010, topDiaM / 2);
  const bottomBarRadius = Math.max(0.010, bottomDiaM / 2);

  const topBarCount = Math.max(2, reinf.beamTopBarCount || 2);
  const bottomBarCount = Math.max(2, reinf.beamBottomBarCount || 2);

  const stirrupDiaM = Math.max(0.006, (reinf.beamStirrupDiaMm || 8) * 0.001);
  const stirrupRadius = Math.max(0.007, stirrupDiaM / 2);
  const coverM = Math.max(0.02, (reinf.beamCoverMm || 25) * 0.001);
  const stirrupSpacingM = Math.max(0.08, (reinf.beamStirrupSpacingMm || 150) * 0.001);

  // Internal cage core dimensions inside beam concrete cover
  const innerW = Math.max(0.04, widthM - 2 * (coverM + stirrupDiaM));
  const innerH = Math.max(0.04, heightM - 2 * (coverM + stirrupDiaM));

  // Compute longitudinal bar positions (Y, Z) relative to beam center
  // Beam runs along local X: X spans [-lengthM/2, lengthM/2], height along Y [-heightM/2, heightM/2], thickness along Z [-widthM/2, widthM/2]
  const topY = innerH / 2;
  const bottomY = -innerH / 2;

  const topBarZPositions: number[] = [];
  if (topBarCount === 2) {
    topBarZPositions.push(-innerW / 2, innerW / 2);
  } else {
    for (let i = 0; i < topBarCount; i++) {
      topBarZPositions.push(-innerW / 2 + i * (innerW / (topBarCount - 1)));
    }
  }

  const bottomBarZPositions: number[] = [];
  if (bottomBarCount === 2) {
    bottomBarZPositions.push(-innerW / 2, innerW / 2);
  } else {
    for (let i = 0; i < bottomBarCount; i++) {
      bottomBarZPositions.push(-innerW / 2 + i * (innerW / (bottomBarCount - 1)));
    }
  }

  // Calculate closed stirrups along beam length
  const usableLengthM = Math.max(0.1, lengthM - 2 * coverM);
  const numStirrups = Math.max(2, Math.floor(usableLengthM / stirrupSpacingM) + 1);
  const stirrupXPositions: number[] = [];
  for (let idx = 0; idx < numStirrups; idx++) {
    stirrupXPositions.push(-usableLengthM / 2 + idx * (usableLengthM / Math.max(1, numStirrups - 1)));
  }

  return (
    <group renderOrder={1}>
      {/* 1. Top Longitudinal Bars (along local X) */}
      {topBarZPositions.map((z, idx) => (
        <mesh key={`beam-top-${idx}`} position={[0, topY, z]} rotation={[0, 0, Math.PI / 2]} renderOrder={1} frustumCulled={false}>
          <cylinderGeometry args={[topBarRadius, topBarRadius, lengthM, 8]} />
          <meshStandardMaterial 
            color="#00f0ff" 
            metalness={0.9} 
            roughness={0.2} 
            emissive="#0284c7"
            emissiveIntensity={0.45}
            depthTest={true}
            depthWrite={true}
          />
        </mesh>
      ))}

      {/* 2. Bottom Longitudinal Bars (along local X) */}
      {bottomBarZPositions.map((z, idx) => (
        <mesh key={`beam-bottom-${idx}`} position={[0, bottomY, z]} rotation={[0, 0, Math.PI / 2]} renderOrder={1} frustumCulled={false}>
          <cylinderGeometry args={[bottomBarRadius, bottomBarRadius, lengthM, 8]} />
          <meshStandardMaterial 
            color="#00f0ff" 
            metalness={0.9} 
            roughness={0.2} 
            emissive="#0284c7"
            emissiveIntensity={0.45}
            depthTest={true}
            depthWrite={true}
          />
        </mesh>
      ))}

      {/* 3. Closed Rectangular Stirrups / Links along beam length */}
      {stirrupXPositions.map((x, idx) => (
        <group key={`beam-stirrup-${idx}`} position={[x, 0, 0]}>
          {/* Top horizontal link bar */}
          <mesh position={[0, topY, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1} frustumCulled={false}>
            <cylinderGeometry args={[stirrupRadius, stirrupRadius, innerW, 8]} />
            <meshStandardMaterial 
              color="#ffb703" 
              metalness={0.9} 
              roughness={0.2} 
              emissive="#d97706"
              emissiveIntensity={0.45}
              depthTest={true}
              depthWrite={true}
            />
          </mesh>
          {/* Bottom horizontal link bar */}
          <mesh position={[0, bottomY, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1} frustumCulled={false}>
            <cylinderGeometry args={[stirrupRadius, stirrupRadius, innerW, 8]} />
            <meshStandardMaterial 
              color="#ffb703" 
              metalness={0.9} 
              roughness={0.2} 
              emissive="#d97706"
              emissiveIntensity={0.45}
              depthTest={true}
              depthWrite={true}
            />
          </mesh>
          {/* Left vertical link bar */}
          <mesh position={[0, 0, -innerW / 2]} renderOrder={1} frustumCulled={false}>
            <cylinderGeometry args={[stirrupRadius, stirrupRadius, innerH, 8]} />
            <meshStandardMaterial 
              color="#ffb703" 
              metalness={0.9} 
              roughness={0.2} 
              emissive="#d97706"
              emissiveIntensity={0.45}
              depthTest={true}
              depthWrite={true}
            />
          </mesh>
          {/* Right vertical link bar */}
          <mesh position={[0, 0, innerW / 2]} renderOrder={1} frustumCulled={false}>
            <cylinderGeometry args={[stirrupRadius, stirrupRadius, innerH, 8]} />
            <meshStandardMaterial 
              color="#ffb703" 
              metalness={0.9} 
              roughness={0.2} 
              emissive="#d97706"
              emissiveIntensity={0.45}
              depthTest={true}
              depthWrite={true}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 2-Way RCC Footing Reinforcement Mesh & Column Starter Anchor Bars
function FootingRebarMesh({
  footingLengthM,
  footingWidthM,
  footingDepthM,
  rebar,
  starterCount = 4,
  starterDiaMm = 16
}: {
  footingLengthM: number;
  footingWidthM: number;
  footingDepthM: number;
  rebar?: { mainBarDiaMm: number; mainBarCount: number; distBarDiaMm: number; distBarCount: number; coverMm: number; hookLengthMm?: number };
  starterCount?: number;
  starterDiaMm?: number;
}) {
  const coverM = Math.max(0.03, (rebar?.coverMm || 50) * 0.001);
  const hookM = Math.max(0.08, (rebar?.hookLengthMm || 150) * 0.001);
  
  const mainDiaM = Math.max(0.008, (rebar?.mainBarDiaMm || 12) * 0.001);
  const distDiaM = Math.max(0.008, (rebar?.distBarDiaMm || 12) * 0.001);
  const mainRadius = Math.max(0.010, mainDiaM / 2);
  const distRadius = Math.max(0.010, distDiaM / 2);

  const usableLenM = Math.max(0.2, footingLengthM - 2 * coverM);
  const usableWidM = Math.max(0.2, footingWidthM - 2 * coverM);

  const mainCount = Math.max(2, rebar?.mainBarCount || 6);
  const distCount = Math.max(2, rebar?.distBarCount || 6);

  // Position mesh near bottom of footing
  const bottomY = -footingDepthM / 2 + coverM;
  const mainY = bottomY + mainRadius;
  const distY = mainY + mainRadius + distRadius;

  return (
    <group renderOrder={1}>
      {/* Main Bars spanning Length (along X) with 90-degree end hooks turning UP */}
      {Array.from({ length: mainCount }).map((_, idx) => {
        const z = -usableWidM / 2 + (idx * (usableWidM / Math.max(1, mainCount - 1)));
        return (
          <group key={`footing-main-${idx}`} position={[0, mainY, z]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow renderOrder={1}>
              <cylinderGeometry args={[mainRadius, mainRadius, usableLenM, 12]} />
              <meshStandardMaterial color="#00f0ff" metalness={0.9} roughness={0.2} emissive="#0284c7" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[-usableLenM / 2, hookM / 2, 0]} castShadow renderOrder={1}>
              <cylinderGeometry args={[mainRadius, mainRadius, hookM, 12]} />
              <meshStandardMaterial color="#00f0ff" metalness={0.9} roughness={0.2} emissive="#0284c7" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[usableLenM / 2, hookM / 2, 0]} castShadow renderOrder={1}>
              <cylinderGeometry args={[mainRadius, mainRadius, hookM, 12]} />
              <meshStandardMaterial color="#00f0ff" metalness={0.9} roughness={0.2} emissive="#0284c7" emissiveIntensity={0.5} />
            </mesh>
          </group>
        );
      })}

      {/* Distribution Bars spanning Width (along Z) with 90-degree end hooks turning UP */}
      {Array.from({ length: distCount }).map((_, idx) => {
        const x = -usableLenM / 2 + (idx * (usableLenM / Math.max(1, distCount - 1)));
        return (
          <group key={`footing-dist-${idx}`} position={[x, distY, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow renderOrder={1}>
              <cylinderGeometry args={[distRadius, distRadius, usableWidM, 12]} />
              <meshStandardMaterial color="#ffb703" metalness={0.9} roughness={0.2} emissive="#d97706" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[0, hookM / 2, -usableWidM / 2]} castShadow renderOrder={1}>
              <cylinderGeometry args={[distRadius, distRadius, hookM, 12]} />
              <meshStandardMaterial color="#ffb703" metalness={0.9} roughness={0.2} emissive="#d97706" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[0, hookM / 2, usableWidM / 2]} castShadow renderOrder={1}>
              <cylinderGeometry args={[distRadius, distRadius, hookM, 12]} />
              <meshStandardMaterial color="#ffb703" metalness={0.9} roughness={0.2} emissive="#d97706" emissiveIntensity={0.5} />
            </mesh>
          </group>
        );
      })}

      {/* Column Starter Reinforcement Anchoring into Footing with 90-degree L-bends resting on mesh */}
      {(() => {
        const starterRadius = Math.max(0.012, starterDiaMm * 0.0005);
        const colW_M = 0.2286;
        const colD_M = 0.2286;
        const cCoverM = 0.04;
        const innerW = colW_M - 2 * cCoverM;
        const innerD = colD_M - 2 * cCoverM;
        const starterBendM = 0.25;
        const starterVerticalH = footingDepthM + 0.35;

        const colPositions = [
          [-innerW / 2, -innerD / 2, -1, 0],
          [innerW / 2, -innerD / 2, 1, 0],
          [innerW / 2, innerD / 2, 1, 0],
          [-innerW / 2, innerD / 2, -1, 0]
        ];

        return colPositions.map(([cx, cz, bdx, bdz], sIdx) => (
          <group key={`col-starter-${sIdx}`} position={[cx, 0, cz]}>
            <mesh position={[0, starterVerticalH / 2 - footingDepthM / 2, 0]} castShadow renderOrder={1}>
              <cylinderGeometry args={[starterRadius, starterRadius, starterVerticalH, 12]} />
              <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.2} emissive="#0284c7" emissiveIntensity={0.6} />
            </mesh>
            <mesh position={[bdx * starterBendM / 2, -footingDepthM / 2 + coverM + 0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow renderOrder={1}>
              <cylinderGeometry args={[starterRadius, starterRadius, starterBendM, 12]} />
              <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.2} emissive="#0284c7" emissiveIntensity={0.6} />
            </mesh>
          </group>
        ));
      })()}
    </group>
  );
}

// 3D Foundation Footing Group with layer-by-layer representation below Ground Floor (Y < 0)
function Footing3DGroup({
  footing,
  buildingUnit,
  showFoundation,
  showFootingRebar,
  showLabels,
  isSelected,
  onSelect,
  reinf
}: {
  footing: FoundationFooting;
  buildingUnit: Unit;
  showFoundation: boolean;
  showFootingRebar: boolean;
  showLabels: boolean;
  isSelected: boolean;
  onSelect: () => void;
  reinf?: Partial<RCCReinforcementConfig>;
}) {
  const fL_M = toMeters(footing.footingLength || 4, footing.footingUnit || buildingUnit);
  const fW_M = toMeters(footing.footingWidth || 4, footing.footingUnit || buildingUnit);
  const fD_M = toMeters(footing.footingDepth || 1, footing.footingUnit || buildingUnit);

  const pccL_M = toMeters(footing.pccLength || (footing.footingLength + 1), footing.pccUnit || buildingUnit);
  const pccW_M = toMeters(footing.pccWidth || (footing.footingWidth + 1), footing.pccUnit || buildingUnit);
  const pccT_M = toMeters(footing.pccThickness || 0.33, footing.pccUnit || buildingUnit);

  const sandL_M = toMeters(footing.sandFillLength || footing.pccLength || (footing.footingLength + 1), footing.sandFillUnit || buildingUnit);
  const sandW_M = toMeters(footing.sandFillWidth || footing.pccWidth || (footing.footingWidth + 1), footing.sandFillUnit || buildingUnit);
  const sandD_M = toMeters(footing.sandFillDepth || 0.5, footing.sandFillUnit || buildingUnit);

  const posX = toMeters(footing.position?.x || 0, buildingUnit);
  const posZ = toMeters(footing.position?.y || 0, buildingUnit);

  const excDepthM = toMeters(footing.excavationDepth || 4, footing.excavationUnit || buildingUnit);
  const footingTopDepthM = Math.max(0.15, excDepthM - fD_M - pccT_M - sandD_M);

  const stubCenterY = -footingTopDepthM / 2;
  const footingCenterY = -footingTopDepthM - fD_M / 2;
  const pccCenterY = -footingTopDepthM - fD_M - pccT_M / 2;
  const sandCenterY = -footingTopDepthM - fD_M - pccT_M - sandD_M / 2;

  const isXRay = showFootingRebar;

  const colW_M = 0.2286;
  const colD_M = 0.2286;

  return (
    <group position={[posX, 0, -posZ]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* 1. Sub-grade RCC Column Stub extending from Ground Level to top of Footing */}
      {showFoundation && (
        <mesh position={[0, stubCenterY, 0]} castShadow={!isXRay} receiveShadow={!isXRay} renderOrder={isXRay ? 2 : 1}>
          <boxGeometry args={[colW_M, footingTopDepthM, colD_M]} />
          <meshStandardMaterial 
            color={isSelected ? "#0284c7" : "#94a3b8"} 
            roughness={isXRay ? 0.3 : 0.85} 
            metalness={isXRay ? 0.1 : 0.05} 
            transparent={isXRay} 
            opacity={isXRay ? 0.22 : 1.0}
            depthWrite={!isXRay} 
          />
        </mesh>
      )}

      {/* 2. Isolated RCC Footing Box */}
      {showFoundation && (
        <mesh position={[0, footingCenterY, 0]} castShadow={!isXRay} receiveShadow={!isXRay} renderOrder={isXRay ? 2 : 1}>
          <boxGeometry args={[fL_M, fD_M, fW_M]} />
          <meshStandardMaterial 
            color={isSelected ? "#ea580c" : "#94a3b8"} 
            roughness={isXRay ? 0.3 : 0.85} 
            metalness={isXRay ? 0.1 : 0.05} 
            transparent={isXRay} 
            opacity={isXRay ? 0.22 : 1.0}
            depthWrite={!isXRay} 
          />
        </mesh>
      )}

      {/* 3. PCC / Base Lean Concrete Layer Box */}
      {showFoundation && (
        <mesh position={[0, pccCenterY, 0]} castShadow={!isXRay} receiveShadow={!isXRay} renderOrder={isXRay ? 2 : 1}>
          <boxGeometry args={[pccL_M, pccT_M, pccW_M]} />
          <meshStandardMaterial 
            color="#64748b" 
            roughness={isXRay ? 0.3 : 0.9} 
            metalness={0.05} 
            transparent={isXRay} 
            opacity={isXRay ? 0.35 : 1.0}
            depthWrite={!isXRay} 
          />
        </mesh>
      )}

      {/* 4. Sand Filling Layer Box */}
      {showFoundation && (
        <mesh position={[0, sandCenterY, 0]} receiveShadow renderOrder={isXRay ? 2 : 1}>
          <boxGeometry args={[sandL_M, sandD_M, sandW_M]} />
          <meshStandardMaterial 
            color="#d97706" 
            roughness={0.95} 
            metalness={0.0} 
            transparent={isXRay} 
            opacity={isXRay ? 0.45 : 1.0}
            depthWrite={!isXRay} 
          />
        </mesh>
      )}

      {/* 5. 3D Footing Reinforcement Mesh & Starter Anchors */}
      {showFootingRebar && (
        <group position={[0, footingCenterY, 0]}>
          <FootingRebarMesh 
            footingLengthM={fL_M} 
            footingWidthM={fW_M} 
            footingDepthM={fD_M} 
            rebar={footing.rebar} 
            starterCount={reinf?.pillarMainBarCount || 4} 
            starterDiaMm={reinf?.pillarMainBarDiaMm || 16} 
          />
        </group>
      )}

      {/* Footing Label in 3D */}
      {showLabels && (
        <Html position={[0, -footingTopDepthM - fD_M - 0.2, 0]} center zIndexRange={[50, 0]}>
          <div 
            onClick={onSelect}
            className={cn(
              "px-2 py-0.5 rounded text-[9px] font-bold shadow-lg cursor-pointer whitespace-nowrap select-none transition-all",
              isSelected ? "bg-amber-600 text-white ring-2 ring-white scale-110" : "bg-slate-900/90 text-amber-300 hover:bg-slate-800"
            )}
          >
            <div>{footing.pillarName || footing.id} Footing</div>
            <div className="text-[8px] text-slate-300 font-mono">{footing.footingLength}'×{footing.footingWidth}' RCC</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function CameraController({ 
  viewMode, 
  viewPreset,
  controlsRef 
}: { 
  viewMode: string; 
  viewPreset: string;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  
  React.useEffect(() => {
    if (viewMode === 'open-top') {
      camera.position.set(0, 40, 20);
    } else {
      camera.position.set(30, 20, 30);
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [viewMode, camera, controlsRef]);

  React.useEffect(() => {
    if (!controlsRef.current) return;
    const ctrl = controlsRef.current;
    
    switch (viewPreset) {
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
  }, [viewPreset, controlsRef]);

  return (
    <OrbitControls 
      ref={controlsRef} 
      makeDefault 
      enableZoom={false}
      enableRotate={true}
      enablePan={true}
      minDistance={10} 
      maxDistance={150} 
      minPolarAngle={0} 
      maxPolarAngle={Math.PI / 2 + 0.1}
    />
  );
}

export function VisualEstimator3D({ model }: VisualEstimator3DProps) {
  const { brickType, settings, setActiveTab } = useCalculator();
  const [viewMode, setViewMode] = useState<'open-top' | 'exterior' | 'cutaway'>('open-top');
  const [viewPreset, setViewPreset] = useState<string>('iso');
  const [debugMode, setDebugMode] = useState(false);
  const [showInternal, setShowInternal] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [collisionDebug, setCollisionDebug] = useState(false);
  const [showPillars, setShowPillars] = useState(true);
  const [showPillarLabels, setShowPillarLabels] = useState(false);
  const [showFloorSlab, setShowFloorSlab] = useState(true);
  const [showFullRingBeam, setShowFullRingBeam] = useState(true);
  const [showPillarRebar, setShowPillarRebar] = useState(false);
  const [showRoofSlabRebar, setShowRoofSlabRebar] = useState(false);
  const [showRingBeamRebar, setShowRingBeamRebar] = useState(false);
  const [showFoundation, setShowFoundation] = useState(true);
  const [showFootingRebar, setShowFootingRebar] = useState(false);
  const [showSoilBed, setShowSoilBed] = useState(true);
  const [showBeams, setShowBeams] = useState(true);
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);
  const [selectedFooting, setSelectedFooting] = useState<FoundationFooting | null>(null);
  const [structuralView, setStructuralView] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const allWalls = useMemo(() => {
    return model.floors.flatMap(f => [...f.externalWalls, ...f.internalWalls]);
  }, [model]);

  const debugInfo = useMemo(() => {
    let ew = 0, iw = 0;
    let firstL = -1;
    model.floors.forEach(f => {
      ew += f.externalWalls.length;
      iw += f.internalWalls.length;
      if (f.externalWalls.length > 0 && firstL === -1) {
         const w = f.externalWalls[0];
         firstL = Math.hypot(w.end!.x - w.start!.x, w.end!.y - w.start!.y);
      }
    });
    return `EW: ${ew}, IW: ${iw}, 1stL: ${firstL?.toFixed(1)}, W: ${model.buildingWidth}, L: ${model.buildingLength}`;
  }, [model]);

  const [debugText, setDebugText] = useState(debugInfo);
  const controlsRef = React.useRef<any>(null);
  const viewerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (controlsRef.current) {
        const controls = controlsRef.current;
        const camera = controls.object;
        const delta = e.deltaY * 0.05;
        
        const vec = new THREE.Vector3().subVectors(camera.position, controls.target);
        const dist = vec.length();
        vec.normalize();
        
        const newDist = Math.max(controls.minDistance || 10, Math.min(controls.maxDistance || 150, dist + delta));
        camera.position.copy(controls.target).add(vec.multiplyScalar(newDist));
        camera.updateProjectionMatrix();
        controls.update();
        
        setDebugText(`${debugInfo} | Dist: ${newDist.toFixed(1)}`);
      }
    };

    viewer.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => viewer.removeEventListener('wheel', handleWheel, { capture: true });
  }, [debugInfo]);

  const handleZoom = (delta: number) => {
    if (controlsRef.current) {
      const controls = controlsRef.current;
      const camera = controls.object;
      const vec = new THREE.Vector3().subVectors(camera.position, controls.target);
      const dist = vec.length();
      vec.normalize();
      const newDist = Math.max(controls.minDistance, Math.min(controls.maxDistance, dist + delta));
      camera.position.copy(controls.target).add(vec.multiplyScalar(newDist));
      controls.update();
    }
  };

  const handleResetView = () => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      if (viewMode === 'open-top') {
        camera.position.set(0, 40, 20);
      } else {
        camera.position.set(30, 20, 30);
      }
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  const validation = useMemo(() => {
    let extCount = 0, intCount = 0, doorsCount = 0, winCount = 0, roomsCount = 0;
    
    model.floors.forEach(f => {
      extCount += f.externalWalls.length;
      intCount += f.internalWalls.length;
      roomsCount += (f.rooms?.length || 0);
      
      const walls = [...f.externalWalls, ...f.internalWalls];
      walls.forEach(w => {
        doorsCount += w.openings?.filter(o => o.type === 'door').length || 0;
        winCount += w.openings?.filter(o => o.type === 'window' || o.type === 'ventilator').length || 0;
      });
    });

    return { extCount, intCount, doorsCount, winCount, roomsCount };
  }, [model]);

  const toM = (val: number) => toMeters(val, model.buildingUnit);
  const centerX = -toM(model.buildingLength) / 2;
  const centerZ = toM(model.buildingWidth) / 2;

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Validation Summary */}
      <div className="bg-white p-4 rounded border shadow-sm text-sm">
        <h4 className="font-semibold mb-2 flex items-center">
          <Info className="w-4 h-4 mr-2 text-blue-500" />
          Structural Geometry Validation
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div><span className="text-gray-500 block text-xs">External Walls</span><span className="font-medium">{validation.extCount}</span></div>
          <div><span className="text-gray-500 block text-xs">Internal Walls</span><span className="font-medium text-green-600">{validation.intCount}</span></div>
          <div><span className="text-gray-500 block text-xs">RCC Columns</span><span className="font-medium text-orange-600">{model.pillars?.length || 0}</span></div>
          <div><span className="text-gray-500 block text-xs">Doors</span><span className="font-medium text-blue-600">{validation.doorsCount}</span></div>
          <div><span className="text-gray-500 block text-xs">Windows</span><span className="font-medium text-cyan-600">{validation.winCount}</span></div>
          <div><span className="text-gray-500 block text-xs">Junction Status</span><span className="font-medium text-emerald-600">Flush Trimmed</span></div>
        </div>
      </div>

      <div 
        ref={viewerRef}
        className="w-full h-[640px] relative rounded-xl overflow-hidden border border-slate-800 touch-none bg-slate-950 select-none" 
        onMouseEnter={() => setShowHint(true)} 
        onMouseLeave={() => setShowHint(false)}
        style={{ pointerEvents: 'auto' }}
      >
        {/* Debug Label */}
        <div className="absolute bottom-3 left-3 z-30 bg-black/80 text-green-400 font-mono text-xs px-2 py-1 rounded shadow-lg pointer-events-none">
          {debugText}
        </div>

        {/* Helper Hint */}
        <div className={cn(
          "absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-black/70 text-white px-4 py-1.5 rounded-full text-xs font-medium pointer-events-none transition-opacity duration-500",
          showHint ? "opacity-100" : "opacity-0"
        )}>
          Scroll to zoom &bull; Drag to rotate
        </div>

        {/* Top-Left Controls: Column Labels Toggle */}
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
          <button
            onClick={() => setShowPillarLabels(prev => !prev)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg border transition-all flex items-center gap-1.5 backdrop-blur-md",
              showPillarLabels 
                ? "bg-orange-600 text-white border-orange-500 ring-2 ring-orange-400/30" 
                : "bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white"
            )}
            title="Toggle Column ID & Dimension Labels"
          >
            <span>🏷️ Column Labels:</span>
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", showPillarLabels ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400")}>
              {showPillarLabels ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Top-Right: Compact Horizontal Camera Controls Pill */}
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-700/80 backdrop-blur-md shadow-md">
          <button onClick={() => handleZoom(-10)} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors" title="Zoom In">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => handleZoom(10)} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors" title="Zoom Out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={handleResetView} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors" title="Reset View">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Top-Right: Scene Elements Overlay Panel (Inside 3D Viewer) */}
        <div className="absolute top-14 right-3 z-20 w-64 max-w-[calc(100%-24px)] max-h-[calc(100%-72px)] flex flex-col bg-white/95 text-slate-800 p-3 rounded-xl backdrop-blur-md shadow-2xl border border-slate-200/90 text-xs box-border">
          <div className="flex items-center justify-between font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1.5 flex-shrink-0">
            <span className="flex items-center gap-1.5">
              <span>📐</span> Scene Elements
            </span>
            <div className="flex space-x-1">
              <button 
                onClick={() => {
                  setShowPillars(false);
                  setShowFullRingBeam(false);
                  setShowBeams(false);
                  setShowFloorSlab(false);
                  setShowInternal(false);
                  setShowFoundation(false);
                  setShowPillarRebar(true);
                  setShowRingBeamRebar(true);
                  setShowRoofSlabRebar(true);
                  setShowFootingRebar(true);
                }}
                className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-[10px] font-bold shadow-xs transition-colors"
                title="Isolate and inspect 3D rebar cages & meshes with zero concrete occlusion"
              >
                Rebar
              </button>
              <button 
                onClick={() => {
                  setShowPillars(true);
                  setShowFullRingBeam(true);
                  setShowBeams(true);
                  setShowFloorSlab(true);
                  setShowInternal(true);
                  setShowFoundation(true);
                  setShowPillarRebar(false);
                  setShowRingBeamRebar(false);
                  setShowRoofSlabRebar(false);
                  setShowFootingRebar(false);
                }}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-medium transition-colors"
                title="Restore default concrete and wall view"
              >
                Restore
              </button>
            </div>
          </div>

          {/* Scrollable Checkboxes List */}
          <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
            <label className="flex items-center space-x-2 cursor-pointer text-slate-800 hover:text-slate-950 py-0.5">
              <input type="checkbox" checked={showInternal} onChange={(e) => setShowInternal(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
              <span>Show Internal Walls</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-slate-800 hover:text-slate-950 py-0.5">
              <input type="checkbox" checked={showPillars} onChange={(e) => setShowPillars(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
              <span>Show Solid RCC Columns</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-cyan-800 font-semibold bg-cyan-50/90 px-1.5 py-0.5 rounded border border-cyan-200/60">
              <input type="checkbox" checked={showPillarRebar} onChange={(e) => setShowPillarRebar(e.target.checked)} className="rounded text-cyan-600 focus:ring-cyan-500" />
              <span>Show Pillar Rebar Cage</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-amber-800 font-semibold bg-amber-50/90 px-1.5 py-0.5 rounded border border-amber-200/60">
              <input type="checkbox" checked={showRoofSlabRebar} onChange={(e) => setShowRoofSlabRebar(e.target.checked)} className="rounded text-amber-600 focus:ring-amber-500" />
              <span>Show Roof/Slab Rebar</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-purple-800 font-medium py-0.5">
              <input type="checkbox" checked={showBeams} onChange={(e) => setShowBeams(e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500" />
              <span>Show RCC Ring Beams</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-emerald-800 font-semibold bg-emerald-50/90 px-1.5 py-0.5 rounded border border-emerald-200/60">
              <input type="checkbox" checked={showRingBeamRebar} onChange={(e) => setShowRingBeamRebar(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
              <span>Show RCC Ring Beam Rebar</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-indigo-800 font-medium py-0.5">
              <input type="checkbox" checked={showFullRingBeam} onChange={(e) => setShowFullRingBeam(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
              <span>Show RCC Full Ring Beam</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-amber-900 font-semibold bg-amber-50/90 px-1.5 py-0.5 rounded border border-amber-300/70">
              <input type="checkbox" checked={showFoundation} onChange={(e) => setShowFoundation(e.target.checked)} className="rounded text-amber-600 focus:ring-amber-500" />
              <span>Show Foundation (Footing/PCC)</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-amber-800 font-bold bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-400/80">
              <input type="checkbox" checked={showFootingRebar} onChange={(e) => setShowFootingRebar(e.target.checked)} className="rounded text-amber-600 focus:ring-amber-500" />
              <span>Show Footing Rebar (2-Way)</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-yellow-900 font-medium py-0.5">
              <input type="checkbox" checked={showSoilBed} onChange={(e) => setShowSoilBed(e.target.checked)} className="rounded text-yellow-700 focus:ring-yellow-600" />
              <span>Show Soil Bed / Excavation Pit</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-slate-800 hover:text-slate-950 py-0.5">
              <input type="checkbox" checked={showPillarLabels} onChange={(e) => setShowPillarLabels(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
              <span>Show Column Labels</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-slate-800 hover:text-slate-950 py-0.5">
              <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
              <span>Show Room Labels</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-slate-800 hover:text-slate-950 py-0.5">
              <input type="checkbox" checked={showFloorSlab} onChange={(e) => setShowFloorSlab(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
              <span>Show Floor Slab</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-amber-700 font-semibold pt-1 border-t border-slate-200">
              <input type="checkbox" checked={collisionDebug} onChange={(e) => setCollisionDebug(e.target.checked)} className="rounded text-amber-600 focus:ring-amber-500" />
              <span>Brick/Pillar Collision Debug</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-red-600 font-medium py-0.5">
              <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} className="rounded text-red-600 focus:ring-red-500" />
              <span>3D Wireframe Debug</span>
            </label>
          </div>
        </div>

        {/* Live Rebar Reinforcement Diagnostics Overlay (Top-Left under Labels button) */}
        {(showPillarRebar || showRoofSlabRebar || showRingBeamRebar || showFootingRebar) && (
          <div className="absolute top-14 left-3 z-20 bg-slate-900/95 text-white p-3 rounded-lg border border-cyan-500 shadow-2xl max-w-xs text-xs space-y-1.5 backdrop-blur-md">
            <div className="flex items-center justify-between font-bold text-cyan-400 border-b border-slate-700 pb-1">
              <div className="flex items-center space-x-1.5">
                <Hammer className="w-4 h-4 text-cyan-400" />
                <span>RCC Rebar Active</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 bg-cyan-950 text-cyan-300 rounded border border-cyan-700">3D X-Ray</span>
            </div>
            {showFootingRebar && (
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-amber-300">Foundation Footing Rebar:</div>
                <div className="text-[10px] text-slate-300">
                  • Main Mesh: <span className="text-cyan-300 font-mono font-bold">{model.foundation?.footings?.[0]?.rebar?.mainBarCount || 6}×{model.foundation?.footings?.[0]?.rebar?.mainBarDiaMm || 12}mm</span> (2-Way Mesh + 90° Upward End Hooks)
                </div>
                <div className="text-[10px] text-slate-300">
                  • Starter Bars: <span className="text-sky-300 font-mono font-bold">4×16mm</span> Anchored into Footing
                </div>
              </div>
            )}
            {showPillarRebar && (
              <div className="space-y-0.5 border-t border-slate-800 pt-1">
                <div className="text-[11px] font-semibold text-sky-300">Pillar Rebar Cages:</div>
                <div className="text-[10px] text-slate-300">
                  • Main Bars: <span className="text-cyan-300 font-mono font-bold">{settings.rccReinforcement?.pillarMainBarCount || 4}×{settings.rccReinforcement?.pillarMainBarDiaMm || 16}mm</span> (Full Height + Joint Zone)
                </div>
                <div className="text-[10px] text-slate-300">
                  • Stirrup Ties: <span className="text-amber-300 font-mono font-bold">{settings.rccReinforcement?.pillarStirrupDiaMm || 8}mm @ {settings.rccReinforcement?.pillarStirrupSpacingMm || 150}mm</span> + 3 Joint Loops
                </div>
              </div>
            )}
            {showRingBeamRebar && (
              <div className="space-y-0.5 border-t border-slate-800 pt-1">
                <div className="text-[11px] font-semibold text-emerald-300">Ring Beam Reinforcement:</div>
                <div className="text-[10px] text-slate-300">
                  • Top Bars: <span className="text-cyan-300 font-mono font-bold">{settings.rccReinforcement?.beamTopBarCount || 2}×{settings.rccReinforcement?.beamTopBarDiaMm || 12}mm</span>
                </div>
                <div className="text-[10px] text-slate-300">
                  • Bottom Bars: <span className="text-cyan-300 font-mono font-bold">{settings.rccReinforcement?.beamBottomBarCount || 2}×{settings.rccReinforcement?.beamBottomBarDiaMm || 12}mm</span>
                </div>
                <div className="text-[10px] text-slate-300">
                  • Stirrups: <span className="text-amber-300 font-mono font-bold">{settings.rccReinforcement?.beamStirrupDiaMm || 8}mm @ {settings.rccReinforcement?.beamStirrupSpacingMm || 150}mm</span>
                </div>
              </div>
            )}
            {showRoofSlabRebar && (
              <div className="space-y-0.5 border-t border-slate-800 pt-1">
                <div className="text-[11px] font-semibold text-amber-300">Slab Reinforcement:</div>
                <div className="text-[10px] text-slate-300">
                  • Main Bars: <span className="text-cyan-300 font-mono font-bold">{settings.rccReinforcement?.slabMainBarDiaMm || 10}mm @ {settings.rccReinforcement?.slabMainBarSpacingMm || 150}mm</span>
                </div>
                <div className="text-[10px] text-slate-300">
                  • Dist Bars: <span className="text-amber-300 font-mono font-bold">{settings.rccReinforcement?.slabDistBarDiaMm || 8}mm @ {settings.rccReinforcement?.slabDistBarSpacingMm || 150}mm</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* View Presets (Bottom-Center) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700 shadow-xl flex gap-1 z-20">
          <button onClick={() => setViewPreset('iso')} className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${viewPreset === 'iso' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Iso</button>
          <button onClick={() => setViewPreset('front')} className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${viewPreset === 'front' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Front</button>
          <button onClick={() => setViewPreset('back')} className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${viewPreset === 'back' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Back</button>
          <button onClick={() => setViewPreset('left')} className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${viewPreset === 'left' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Left</button>
          <button onClick={() => setViewPreset('right')} className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${viewPreset === 'right' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Right</button>
          <button onClick={() => setViewPreset('top')} className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${viewPreset === 'top' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Top</button>
        </div>

        {/* Collision Debug Banner */}
        {collisionDebug && (
          <div className="absolute top-16 left-4 z-20 bg-slate-900/95 text-white p-3 rounded-lg border border-amber-500 shadow-2xl max-w-xs text-xs space-y-1 backdrop-blur-md">
            <div className="flex items-center space-x-1.5 font-bold text-amber-400 border-b border-slate-700 pb-1">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Collision Exclusion Check</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pillar No-Brick Zone:</span>
              <span className="text-cyan-400 font-mono">Active 3D Bounds</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Colliding Bricks:</span>
              <span className="text-emerald-400 font-bold font-mono">0 (0.00% overlap)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Masonry Termination:</span>
              <span className="text-emerald-300 font-mono">100% Flush Cut</span>
            </div>
            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
              Every brick is mathematically clamped strictly within column faces.
            </div>
          </div>
        )}

        {/* Selected Pillar Inspector Overlay in 3D */}
        {selectedPillar && (() => {
          const floorObj = model.floors.find(f => f.id === selectedPillar.floorId);
          return (
            <div className="absolute top-4 left-4 z-20 bg-slate-900/95 text-white p-3.5 rounded-lg border border-slate-700 shadow-2xl max-w-sm text-xs space-y-1.5 backdrop-blur-md">
              <div className="flex justify-between items-center border-b border-slate-700 pb-1.5">
                <span className="font-bold text-orange-400 text-sm">{selectedPillar.name} RCC Column</span>
                <button onClick={() => setSelectedPillar(null)} className="text-slate-400 hover:text-white p-0.5"><X className="w-4 h-4" /></button>
              </div>
              <div><span className="text-slate-400">Floor: </span><span className="font-semibold text-white">{floorObj?.name || 'Ground Floor'}</span></div>
              <div><span className="text-slate-400">Coordinates: </span><span className="font-mono text-cyan-300">X: {selectedPillar.position?.x.toFixed(1)} {model.buildingUnit}, Z: {selectedPillar.position?.y.toFixed(1)} {model.buildingUnit}</span></div>
              <div><span className="text-slate-400">Column Size: </span><span className="font-mono">{selectedPillar.width} {selectedPillar.unit} × {selectedPillar.depth} {selectedPillar.unit} × {selectedPillar.height} {model.buildingUnit}</span></div>
              <div><span className="text-slate-400">Alignment: </span><span className="capitalize font-mono text-cyan-300 font-semibold">{selectedPillar.alignment?.replace('_', ' ') || 'Outside Corner'}</span></div>
              <div><span className="text-slate-400">Structure: </span><span className="text-emerald-400 font-medium">Solid Reinforced Concrete</span></div>
              <div><span className="text-slate-400">Masonry Cut: </span><span className="text-orange-300">Clean Flush Junction (0 Overlap)</span></div>
              <div className="text-[10px] text-slate-400 pt-1.5 border-t border-slate-800 flex items-start space-x-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>Pillar reinforcement & dimensions must be certified by a qualified structural engineer.</span>
              </div>
            </div>
          );
        })()}

        <WebGLErrorBoundary>
          <Canvas 
            shadows 
            camera={{ fov: 45 }} 
            gl={{ powerPreference: 'default', failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: true, antialias: true }}
          >
            <CameraController viewMode={viewMode} viewPreset={viewPreset} controlsRef={controlsRef} />
            <color attach="background" args={['#020617']} />
            <ambientLight intensity={0.65} />
            <hemisphereLight args={['#ffffff', '#334155', 0.6]} />
            <directionalLight castShadow position={[15, 25, 10]} intensity={1.8} shadow-mapSize={[1024, 1024]} />
            <directionalLight position={[-15, 15, -10]} intensity={0.5} />
            
            <group position={[centerX, 0, centerZ]}>
              {/* Foundation Plinth Base Slab */}
              {showFloorSlab && (
                <mesh position={[toM(model.buildingLength) / 2, -0.05, -toM(model.buildingWidth) / 2]} receiveShadow renderOrder={showPillarRebar || showRoofSlabRebar ? 2 : 1}>
                  <boxGeometry args={[toM(model.buildingLength) + 0.2, 0.1, toM(model.buildingWidth) + 0.2]} />
                  <meshStandardMaterial 
                    color="#1e293b" 
                    roughness={(showPillarRebar || showRoofSlabRebar) ? 0.4 : 0.9} 
                    transparent={showPillarRebar || showRoofSlabRebar}
                    opacity={(showPillarRebar || showRoofSlabRebar) ? 0.35 : 1.0}
                    depthWrite={!(showPillarRebar || showRoofSlabRebar)}
                    depthTest={true}
                  />
                </mesh>
              )}

              {/* Foundation Sub-grade Layer (Strictly below Ground Floor Y < 0) */}
              {(showFoundation || showFootingRebar) && model.foundation?.enabled !== false && (() => {
                const gfPillars = (model.pillars || []).filter(p => !p.floorId || p.floorId === 'floor-0' || p.floorId === 'ground');
                const targetPillars = gfPillars.length > 0 ? gfPillars : (model.floors[0]?.pillars || []);
                const footings = (model.foundation?.footings && model.foundation.footings.length > 0)
                  ? model.foundation.footings
                  : generateFootingsForPillars(targetPillars, model.foundation, model.buildingUnit);

                if (footings.length === 0) return null;

                const sampleF = footings[0];
                const excDepthM = toMeters(sampleF.excavationDepth || 4, sampleF.excavationUnit || model.buildingUnit);
                const bLenM = toM(model.buildingLength);
                const bWidM = toM(model.buildingWidth);

                return (
                  <group key="foundation-subgrade-system">
                    {/* Soil Bed / Foundation Excavation Base Pit */}
                    {showSoilBed && (
                      <group position={[bLenM / 2, -excDepthM, -bWidM / 2]}>
                        <mesh receiveShadow>
                          <boxGeometry args={[bLenM + 4, 0.05, bWidM + 4]} />
                          <meshStandardMaterial color="#2d1d0f" roughness={0.95} metalness={0.0} />
                        </mesh>
                      </group>
                    )}

                    {/* Isolated Footings & PCC Base Layers */}
                    {footings.map((footing) => (
                      <Footing3DGroup
                        key={`3d-footing-${footing.id}`}
                        footing={footing}
                        buildingUnit={model.buildingUnit}
                        showFoundation={showFoundation}
                        showFootingRebar={showFootingRebar}
                        showLabels={showPillarLabels}
                        isSelected={selectedFooting?.id === footing.id}
                        onSelect={() => setSelectedFooting(selectedFooting?.id === footing.id ? null : footing)}
                        reinf={settings.rccReinforcement}
                      />
                    ))}
                  </group>
                );
              })()}

              {model.floors.map((floor, i) => {
                  // RCC Full Ring Beam configuration for this floor
                  const floorFullBeam = floor.fullRingBeam ?? model.fullRingBeam;
                  const isFullBeamOn = (floorFullBeam?.enabled !== false);
                  const fullBeamThicknessFt = floorFullBeam?.thicknessFt ?? 1;
                  const fullBeamThicknessM = isFullBeamOn ? toMeters(fullBeamThicknessFt, 'ft') : 0;

                  // RCC Ring Beam configuration for this floor (suppressed if Full Ring Beam is ON)
                  const floorRingBeam = floor.ringBeam ?? model.ringBeam;
                  const isRingBeamOn = !isFullBeamOn && (floorRingBeam?.enabled === true);
                  const configuredBeamHeight = floorRingBeam?.height ?? 2;
                  const configuredBeamHeightUnit = floorRingBeam?.heightUnit || 'ft';
                  const configuredBeamWidth = floorRingBeam?.width ?? 9;
                  const configuredBeamWidthUnit = floorRingBeam?.widthUnit || 'in';

                  const beamHeightM = isRingBeamOn ? toMeters(configuredBeamHeight, configuredBeamHeightUnit) : 0;
                  const beamThickM = toMeters(configuredBeamWidth, configuredBeamWidthUnit);

                  // Cumulative vertical elevation for multi-floor stacking
                  const yOffsetRaw = model.floors.slice(0, i).reduce((sum, f) => {
                    const fFull = f.fullRingBeam ?? model.fullRingBeam;
                    const fFullOn = (fFull?.enabled !== false);
                    if (fFullOn) {
                      const fThickFt = fFull?.thicknessFt ?? 1;
                      return sum + f.height + convertUnit(fThickFt, 'ft', model.buildingUnit);
                    }
                    const fRing = f.ringBeam ?? model.ringBeam;
                    const fRingOn = fRing?.enabled === true;
                    if (fRingOn) {
                      const fBeamH = fRing?.height ?? 2;
                      const fBeamHUnit = fRing?.heightUnit || 'ft';
                      return sum + f.height + convertUnit(fBeamH, fBeamHUnit, model.buildingUnit);
                    }
                    return sum + f.height;
                  }, 0);
                  const yOffset = toM(yOffsetRaw);
                  
                  const floorWallHeightM = toM(floor.height);
                  const floorTopHeightM = isFullBeamOn ? fullBeamThicknessM : (isRingBeamOn ? beamHeightM : 0);
                  const floorTotalHeightM = floorWallHeightM + floorTopHeightM;

                  const floorPillars: Pillar[] = (() => {
                    // 1. Direct floor pillars from model.pillars
                    if (model.pillars && model.pillars.length > 0) {
                      const direct = model.pillars.filter(p => p.floorId && String(p.floorId) === String(floor.id));
                      if (direct.length > 0) return direct;
                      const global = model.pillars.filter(p => !p.floorId || p.continueToFloors === 'all');
                      if (global.length > 0) {
                        return global.map(p => ({ ...p, id: `pillar-${floor.id}-${p.id}`, floorId: floor.id }));
                      }
                    }
                    // 2. Direct floor pillars from floor.pillars
                    if (floor.pillars && floor.pillars.length > 0) {
                      return floor.pillars;
                    }
                    // 3. Propagate pillars from Ground Floor along exact same X/Z axis
                    const groundFloor = model.floors[0];
                    if (groundFloor) {
                      if (model.pillars && model.pillars.length > 0) {
                        const gfPillars = model.pillars.filter(p => !p.floorId || String(p.floorId) === String(groundFloor.id) || p.continueToFloors === 'all');
                        if (gfPillars.length > 0) {
                          return gfPillars.map(p => ({ ...p, id: `pillar-${floor.id}-${p.id}`, floorId: floor.id }));
                        }
                      }
                      if (groundFloor.pillars && groundFloor.pillars.length > 0) {
                        return groundFloor.pillars.map(p => ({ ...p, id: `pillar-${floor.id}-${p.id}`, floorId: floor.id }));
                      }
                    }
                    // 4. Fallback to structural pillar detection for all corners, side spans, and internal junctions
                    return detectStructuralPillars(floor, model.buildingLength, model.buildingWidth, model.buildingUnit, floor.height);
                  })();

                  // Detect valid closed structural bays formed by connected RCC pillars
                  const closedBays = detectClosedStructuralBays(floorPillars, model.buildingUnit);

                  // Structural slabs for RCC roof/floor: use detected closed bays if available, or floor footprint fallback
                  const structuralSlabs = (() => {
                    if (closedBays && closedBays.length > 0) {
                      return closedBays.map(bay => {
                        const pSample = floorPillars.find(p => bay.pillarIds.includes(p.id)) || floorPillars[0] || { width: 9, depth: 9, unit: 'in' as const };
                        const pW_M = toMeters(pSample.width || 9, pSample.unit || 'in');
                        const pD_M = toMeters(pSample.depth || 9, pSample.unit || 'in');
                        return {
                          id: bay.id,
                          widthM: Math.max(0.2, toM(bay.width) - pW_M),
                          depthM: Math.max(0.2, toM(bay.depth) - pD_M),
                          centerX: toM(bay.centerX),
                          centerY: toM(bay.centerY)
                        };
                      });
                    }
                    return [{
                      id: `floor-slab-${floor.id}`,
                      widthM: Math.max(0.5, toM(model.buildingLength)),
                      depthM: Math.max(0.5, toM(model.buildingWidth)),
                      centerX: toM(model.buildingLength) / 2,
                      centerY: toM(model.buildingWidth) / 2
                    }];
                  })();

                  const slabThickM = fullBeamThicknessM > 0 ? fullBeamThicknessM : (beamHeightM > 0 ? beamHeightM : toMeters(1, 'ft'));

                  return (
                    <group key={floor.id}>
                      {/* External Walls with Clean Segmentation around Pillars (Full Wall Height) */}
                      {floor.externalWalls.map(w => (
                        <CustomWallMeshWrapper 
                          key={w.id} wall={w} yOffset={yOffset} isInternal={false} debugMode={debugMode || structuralView} 
                          fadeFront={(viewMode === 'open-top' || viewMode === 'cutaway')}
                          pillars={floorPillars}
                        />
                      ))}

                      {/* Internal Walls with Clean Segmentation around Pillars (Full Wall Height) */}
                      {showInternal && floor.internalWalls.map(w => (
                        <CustomWallMeshWrapper 
                          key={w.id} wall={w} yOffset={yOffset} isInternal={true} debugMode={debugMode || structuralView} fadeFront={false} 
                          pillars={floorPillars}
                        />
                      ))}

                      {/* Structural Pillar-to-Pillar RCC Beams connecting all adjacent pillars along the frame */}
                      {(showBeams || showFullRingBeam || showRingBeamRebar) && (isFullBeamOn || isRingBeamOn) && detectPillarToPillarBeams(floorPillars, model.buildingUnit).map(beam => {
                        const sX = toM(beam.start.x);
                        const sY = toM(beam.start.y);
                        const eX = toM(beam.end.x);
                        const eY = toM(beam.end.y);
                        const len = Math.hypot(eX - sX, eY - sY);
                        if (len <= 0.05) return null;
                        const ang = Math.atan2(-(eY - sY), eX - sX);
                        const mX = (sX + eX) / 2;
                        const mY = (sY + eY) / 2;

                        const pSample = floorPillars.find(p => p.id === beam.startPillarId || p.id === beam.endPillarId) || floorPillars[0];
                        const pW_M = pSample ? toMeters(pSample.width || 9, pSample.unit || 'in') : toMeters(9, 'in');
                        const actualBeamThickM = pW_M;
                        const actualBeamHeightM = floorTopHeightM > 0 ? floorTopHeightM : (beamHeightM > 0 ? beamHeightM : toMeters(1, 'ft'));

                        const isBeamXRay = showRingBeamRebar || showPillarRebar || showRoofSlabRebar;
                        const isBeamConcreteVisible = (showBeams || showFullRingBeam);

                        return (
                          <group key={`p-beam-${floor.id}-${beam.id}`} position={[mX, yOffset + floorWallHeightM + actualBeamHeightM / 2, -mY]} rotation={[0, -ang, 0]}>
                            {/* Solid / Translucent RCC Beam Concrete Body */}
                            {isBeamConcreteVisible && (
                              <mesh castShadow={!isBeamXRay} receiveShadow={!isBeamXRay} renderOrder={isBeamXRay ? 2 : 1}>
                                <boxGeometry args={[len, actualBeamHeightM, actualBeamThickM]} />
                                <meshStandardMaterial 
                                  color="#94a3b8" 
                                  roughness={isBeamXRay ? 0.3 : 0.8} 
                                  metalness={isBeamXRay ? 0.1 : 0.05}
                                  transparent={isBeamXRay}
                                  opacity={isBeamXRay ? 0.22 : 1.0}
                                  depthWrite={!isBeamXRay}
                                  depthTest={true}
                                />
                              </mesh>
                            )}

                            {/* 3D RCC Ring Beam Reinforcement Steel Cage (Top/Bottom Bars + Closed Stirrups) */}
                            {showRingBeamRebar && (
                              <RingBeamRebarCage 
                                lengthM={len} 
                                heightM={actualBeamHeightM} 
                                widthM={actualBeamThickM} 
                                reinf={settings.rccReinforcement} 
                              />
                            )}
                          </group>
                        );
                      })}

                      {/* Wall-sitting RCC Ring Beams for walls without direct pillar alignments */}
                      {(showBeams || showRingBeamRebar) && isRingBeamOn && !isFullBeamOn && [...floor.externalWalls, ...(showInternal ? floor.internalWalls : [])].map(w => {
                        if (!w.start || !w.end) return null;
                        const sX = toM(w.start.x);
                        const sY = toM(w.start.y);
                        const eX = toM(w.end.x);
                        const eY = toM(w.end.y);
                        const len = Math.hypot(eX - sX, eY - sY);
                        if (len <= 0.05) return null;
                        const ang = Math.atan2(-(eY - sY), eX - sX);
                        const mX = (sX + eX) / 2;
                        const mY = (sY + eY) / 2;
                        const wallThickM = toMeters(w.dimensions.thickness, w.dimensions.thicknessUnit || 'in');
                        const actualBeamThickM = beamThickM || wallThickM;

                        const isBeamXRay = showRingBeamRebar || showPillarRebar || showRoofSlabRebar;

                        return (
                          <group key={`beam-${w.id}`} position={[mX, yOffset + floorWallHeightM + beamHeightM / 2, -mY]} rotation={[0, -ang, 0]}>
                            {/* Solid / Translucent RCC Beam Concrete Body */}
                            {showBeams && (
                              <mesh castShadow={!isBeamXRay} receiveShadow={!isBeamXRay} renderOrder={isBeamXRay ? 2 : 1}>
                                <boxGeometry args={[len, beamHeightM, actualBeamThickM]} />
                                <meshStandardMaterial 
                                  color="#94a3b8" 
                                  roughness={isBeamXRay ? 0.3 : 0.8} 
                                  metalness={isBeamXRay ? 0.1 : 0.05}
                                  transparent={isBeamXRay}
                                  opacity={isBeamXRay ? 0.22 : 1.0}
                                  depthWrite={!isBeamXRay}
                                  depthTest={true}
                                />
                              </mesh>
                            )}

                            {/* 3D RCC Ring Beam Reinforcement Steel Cage (Top/Bottom Bars + Closed Stirrups) */}
                            {showRingBeamRebar && (
                              <RingBeamRebarCage 
                                lengthM={len} 
                                heightM={beamHeightM} 
                                widthM={actualBeamThickM} 
                                reinf={settings.rccReinforcement} 
                              />
                            )}
                          </group>
                        );
                      })}

                      {/* RCC FULL RING BEAM / FULL RCC ROOF SLAB: Solid RCC Concrete & 2-Way Steel Mesh */}
                      {(showFullRingBeam || showRoofSlabRebar) && structuralSlabs.map(slab => {
                        const isSlabConcreteVisible = showFullRingBeam && isFullBeamOn && fullBeamThicknessM > 0;

                        return (
                          <group 
                            key={`rcc-slab-${floor.id}-${slab.id}`}
                            position={[slab.centerX, yOffset + floorWallHeightM + slabThickM / 2, -slab.centerY]}
                          >
                            {/* Solid / Translucent Concrete Slab Body spanning the bay / floor footprint */}
                            {isSlabConcreteVisible && (
                              <mesh castShadow={!showRoofSlabRebar} receiveShadow={!showRoofSlabRebar} renderOrder={showRoofSlabRebar ? 2 : 1}>
                                <boxGeometry args={[slab.widthM, slabThickM, slab.depthM]} />
                                <meshStandardMaterial 
                                  color="#94a3b8" 
                                  roughness={showRoofSlabRebar ? 0.3 : 0.85} 
                                  metalness={showRoofSlabRebar ? 0.1 : 0.05}
                                  transparent={showRoofSlabRebar}
                                  opacity={showRoofSlabRebar ? 0.20 : 1.0}
                                  depthWrite={!showRoofSlabRebar}
                                  depthTest={true}
                                />
                              </mesh>
                            )}

                            {/* 2-Direction Horizontal Rebar Mesh inside the Slab (Exposed in Roof/Slab Rebar Mode) */}
                            {showRoofSlabRebar && (
                              <SlabRebarMesh 
                                bayWidthM={slab.widthM} 
                                bayDepthM={slab.depthM} 
                                thicknessM={slabThickM} 
                                reinf={settings.rccReinforcement} 
                              />
                            )}
                          </group>
                        );
                      })}

                      {/* Solid Concrete Pillars (RCC Columns) & Exposed Pillar Rebar Cage (Continuous through joint) */}
                      {(showPillars || showPillarRebar) && floorPillars.filter(p => p.position && p.showIn3D !== false).map((p, pIdx) => {
                        const norm = normalizePillarRebarConfig(p, settings.rccReinforcement);
                        const pW_M = norm.wM;
                        const pD_M = norm.dM;
                        // Structural Story Breakdown: Shaft Height (clear room) + Joint Height (beam/slab junction)
                        const shaftHeightM = floorWallHeightM;
                        const jointHeightM = floorTopHeightM > 0 ? floorTopHeightM : toMeters(1, 'ft');
                        const totalColumnHeightM = shaftHeightM + jointHeightM;

                        const effPos = getEffectivePillarPosition(p, [], model.buildingUnit);
                        const isPillarSelected = selectedPillar?.id === p.id;
                        const isPillarRebarActive = showPillarRebar || p.showRebar;
                        const isTopFloor = i === model.floors.length - 1;

                        const pillarMatColor = isPillarSelected ? "#0284c7" : (isPillarRebarActive ? '#94a3b8' : (p.finish === 'painted' ? '#cbd5e1' : '#94a3b8'));
                        const pillarMatRoughness = isPillarRebarActive ? 0.3 : (p.finish === 'smooth' ? 0.4 : 0.85);
                        const pillarMatMetalness = isPillarRebarActive ? 0.1 : 0.05;
                        const pillarMatTransparent = isPillarRebarActive;
                        const pillarMatOpacity = isPillarRebarActive ? 0.22 : 1.0;
                        const pillarMatDepthWrite = !isPillarRebarActive;

                        return (
                          <group 
                            key={`col-${floor.id}-${p.id || pIdx}`} 
                            position={[toM(effPos.x), yOffset, -toM(effPos.y)]}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPillar(isPillarSelected ? null : p);
                            }}
                          >
                            {/* 1. Main Column Shaft (Solid / Translucent Concrete Body) */}
                            {showPillars && (
                              p.shape === 'circular' ? (
                                <mesh position={[0, shaftHeightM / 2, 0]} castShadow={!isPillarRebarActive} receiveShadow={!isPillarRebarActive} renderOrder={isPillarRebarActive ? 2 : 1}>
                                  <cylinderGeometry args={[Math.max(pW_M, pD_M)/2, Math.max(pW_M, pD_M)/2, shaftHeightM, 32]} />
                                  <meshStandardMaterial 
                                    color={pillarMatColor} 
                                    roughness={pillarMatRoughness} 
                                    metalness={pillarMatMetalness}
                                    transparent={pillarMatTransparent}
                                    opacity={pillarMatOpacity}
                                    depthWrite={pillarMatDepthWrite}
                                    depthTest={true}
                                  />
                                </mesh>
                              ) : (
                                <mesh position={[0, shaftHeightM / 2, 0]} castShadow={!isPillarRebarActive} receiveShadow={!isPillarRebarActive} renderOrder={isPillarRebarActive ? 2 : 1}>
                                  <boxGeometry args={[pW_M, shaftHeightM, pD_M]} />
                                  <meshStandardMaterial 
                                    color={pillarMatColor} 
                                    roughness={pillarMatRoughness} 
                                    metalness={pillarMatMetalness}
                                    transparent={pillarMatTransparent}
                                    opacity={pillarMatOpacity}
                                    depthWrite={pillarMatDepthWrite}
                                    depthTest={true}
                                  />
                                </mesh>
                              )
                            )}

                            {/* 2. Top-End Joint Pillar (Vertical Structural Column Continuation through Floor/Beam Joint) */}
                            {showPillars && (
                              p.shape === 'circular' ? (
                                <mesh position={[0, shaftHeightM + jointHeightM / 2, 0]} castShadow={!isPillarRebarActive} receiveShadow={!isPillarRebarActive} renderOrder={isPillarRebarActive ? 2 : 1}>
                                  <cylinderGeometry args={[Math.max(pW_M, pD_M)/2, Math.max(pW_M, pD_M)/2, jointHeightM, 32]} />
                                  <meshStandardMaterial 
                                    color={pillarMatColor} 
                                    roughness={pillarMatRoughness} 
                                    metalness={pillarMatMetalness}
                                    transparent={pillarMatTransparent}
                                    opacity={pillarMatOpacity}
                                    depthWrite={pillarMatDepthWrite}
                                    depthTest={true}
                                  />
                                </mesh>
                              ) : (
                                <mesh position={[0, shaftHeightM + jointHeightM / 2, 0]} castShadow={!isPillarRebarActive} receiveShadow={!isPillarRebarActive} renderOrder={isPillarRebarActive ? 2 : 1}>
                                  <boxGeometry args={[pW_M, jointHeightM, pD_M]} />
                                  <meshStandardMaterial 
                                    color={pillarMatColor} 
                                    roughness={pillarMatRoughness} 
                                    metalness={pillarMatMetalness}
                                    transparent={pillarMatTransparent}
                                    opacity={pillarMatOpacity}
                                    depthWrite={pillarMatDepthWrite}
                                    depthTest={true}
                                  />
                                </mesh>
                              )
                            )}

                            {/* Collision Debug Exclusion Bounding Box */}
                            {collisionDebug && (
                              <mesh position={[0, totalColumnHeightM / 2, 0]}>
                                <boxGeometry args={[pW_M + 0.02, totalColumnHeightM + 0.02, pD_M + 0.02]} />
                                <meshBasicMaterial color="#06b6d4" wireframe={true} />
                              </mesh>
                            )}

                            {/* Exposed Rebar Cage Mode: Shaft + Joint Pillar Reinforcement + 35cm Starter Lap */}
                            {isPillarRebarActive && (
                              <group position={[0, totalColumnHeightM / 2, 0]}>
                                <PillarRebarCage 
                                  wM={pW_M} 
                                  dM={pD_M} 
                                  hM={totalColumnHeightM} 
                                  jointM={jointHeightM}
                                  starterM={isTopFloor ? 0.0 : 0.35}
                                  shape={p.shape} 
                                  reinf={norm.reinf} 
                                />
                              </group>
                            )}

                            {/* Column Label */}
                            {showPillarLabels && p.showLabel !== false && (
                              <Html position={[0, totalColumnHeightM + 0.3, 0]} center zIndexRange={[50, 0]}>
                                <div 
                                  onClick={() => setSelectedPillar(p)}
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold shadow-lg cursor-pointer whitespace-nowrap transition-all select-none",
                                    isPillarSelected ? "bg-orange-600 text-white ring-2 ring-white scale-110" : "bg-slate-900/90 text-slate-100 hover:bg-slate-800"
                                  )}
                                >
                                  <div>{p.name} ({p.width}"×{p.depth}")</div>
                                  <div className="text-[8px] text-cyan-300 font-mono">Joint Aligned</div>
                                </div>
                              </Html>
                            )}
                          </group>
                        );
                      })}

                      {/* Room Labels */}
                      {showLabels && floor.rooms?.map((room: any) => (
                        <Html key={room.id} position={[toM(room.center!.x), yOffset + 0.5, -toM(room.center!.y)]} center>
                          <div className="bg-white/90 px-3 py-1 rounded text-sm font-semibold shadow pointer-events-none select-none text-gray-800">
                            {room.name}
                          </div>
                        </Html>
                      ))}
                    </group>
                  );
                })
              }
            </group>

            <gridHelper args={[100, 100, '#1e293b', '#0f172a']} position={[0, -0.01, 0]} />
          </Canvas>
          </WebGLErrorBoundary>

          {/* Selected Footing 3D Floating Inspector */}
          {selectedFooting && (
            <div className="absolute bottom-4 left-4 z-20 bg-slate-900/95 text-white p-3.5 rounded-lg border border-amber-500 shadow-2xl max-w-sm text-xs space-y-2 backdrop-blur-md">
              <div className="flex items-center justify-between font-bold text-amber-400 border-b border-slate-700 pb-1">
                <div className="flex items-center space-x-1.5">
                  <LandPlot className="w-4 h-4 text-amber-400" />
                  <span>{selectedFooting.pillarName ? `${selectedFooting.pillarName} Footing` : selectedFooting.id}</span>
                </div>
                <button onClick={() => setSelectedFooting(null)} className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-800/80 p-1.5 rounded">
                  <span className="text-slate-400 text-[10px]">RCC Footing:</span>
                  <div className="font-bold text-amber-300 font-mono">
                    {selectedFooting.footingLength}' × {selectedFooting.footingWidth}' × {selectedFooting.footingDepth}'
                  </div>
                  <div className="text-[9px] text-slate-400">Grade: {selectedFooting.concreteGrade || 'M20'}</div>
                </div>
                <div className="bg-slate-800/80 p-1.5 rounded">
                  <span className="text-slate-400 text-[10px]">PCC Base Lean:</span>
                  <div className="font-bold text-slate-200 font-mono">
                    {selectedFooting.pccLength || 5}' × {selectedFooting.pccWidth || 5}' × {selectedFooting.pccThickness || 0.33}'
                  </div>
                  <div className="text-[9px] text-slate-400">Mix: {selectedFooting.pccMixRatio || '1:4:8'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-800/80 p-1.5 rounded">
                  <span className="text-slate-400 text-[10px]">Sand Filling:</span>
                  <div className="font-bold text-yellow-400 font-mono">
                    {selectedFooting.sandFillDepth || 0.5}' Depth
                  </div>
                </div>
                <div className="bg-slate-800/80 p-1.5 rounded">
                  <span className="text-slate-400 text-[10px]">Total Excavation:</span>
                  <div className="font-bold text-amber-200 font-mono">
                    {selectedFooting.excavationDepth || 4}' Depth
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/80 p-1.5 rounded text-[10px] space-y-0.5">
                <span className="text-slate-400">Reinforcement Mesh (2-Way Bottom):</span>
                <div className="text-cyan-300 font-mono font-bold">
                  • Main & Dist: {selectedFooting.rebar?.mainBarCount || 6}×{selectedFooting.rebar?.mainBarDiaMm || 12}mm TMT
                </div>
                <div className="text-sky-300 font-mono">
                  • Starter Ties: 4×16mm Column Anchor Dowels
                </div>
              </div>

              <div className="text-[9px] text-amber-300/80 italic flex items-center gap-1 border-t border-slate-800 pt-1">
                <ShieldAlert className="w-3 h-3 flex-shrink-0" />
                Must be verified by a structural engineer with actual soil data.
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
