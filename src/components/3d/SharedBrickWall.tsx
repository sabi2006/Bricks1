import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { toMeters, Wall, BrickSpecification, CalculatorSettings } from '@/lib/brickCalculator';

// Reusable brick material
export const brickMaterial = new THREE.MeshStandardMaterial({
  roughness: 0.85,
  metalness: 0.05,
});

export const brickColors = [
  new THREE.Color('#a5402d'), // Darker
  new THREE.Color('#c15438'), // Standard
  new THREE.Color('#8a3324'), // Burnt
  new THREE.Color('#d66a4f'), // Lighter
  new THREE.Color('#b3452b'), // Medium
];

export const wireframeMaterial = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  wireframe: true,
  transparent: true,
  opacity: 0.2
});

interface SharedBrickWallProps {
  wall: Wall;
  brickType: BrickSpecification;
  settings: CalculatorSettings;
  position?: [number, number, number];
  rotation?: [number, number, number];
  wireframe?: boolean;
  infillRecess?: boolean;
}

export function SharedBrickWall({ 
  wall, 
  brickType, 
  settings, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0], 
  wireframe = false,
  infillRecess = true
}: SharedBrickWallProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  // Memoize brick positions to avoid recalculating on every render
  const { matrices, colors, brickCount, geometryArgs, totalLength, totalHeight, totalThickness, processedOpenings } = useMemo(() => {
    const l = toMeters(wall.dimensions.length, wall.dimensions.unit);
    const h = Math.min(20, toMeters(wall.dimensions.height, wall.dimensions.unit)); // Cap at 20m for sanity
    const tUnit = wall.dimensions.thicknessUnit || (wall.dimensions.unit === 'ft' ? 'in' : 'mm');
    const rawT = Math.min(2, toMeters(wall.dimensions.thickness, tUnit)); // Cap at 2m
    // Infill Recess: Inset brick infill slightly (~16mm on each face) so the RCC columns & beams project proudly in front of the masonry
    const recess = infillRecess !== false ? 0.016 : 0;
    const t = Math.max(0.08, rawT - recess * 2);
    
    const bL = (brickType.length || 230) * 0.001;
    const bW = (brickType.width || 110) * 0.001;
    const bH = (brickType.height || 75) * 0.001;
    
    const mH = (settings.mortarJointHorizontal || 10) * 0.001;
    const mV = (settings.mortarJointVertical || 10) * 0.001;
    
    const effL = bL + mV;
    const effH = bH + mH;
    const effW = bW + mV;
    
    const courses = Math.ceil(h / effH);
    const bricksPerCourse = Math.ceil(l / effL);
    const depthLayers = Math.ceil(t / effW);
    
    // Safety limit: if over 50k bricks, we need to simplify (LOD/Decimation)
    let scaleFactor = 1;
    if (courses * bricksPerCourse * depthLayers > 50000) {
      scaleFactor = Math.cbrt((courses * bricksPerCourse * depthLayers) / 25000);
    }
    
    const actEffL = effL * scaleFactor;
    const actEffH = effH * scaleFactor;
    const actEffW = effW * scaleFactor;
    
    const actBL = bL * scaleFactor;
    const actBW = bW * scaleFactor;
    const actBH = bH * scaleFactor;
    
    const actCourses = Math.ceil(h / actEffH);
    const actBricksPerCourse = Math.ceil(l / actEffL);
    const actDepthLayers = Math.ceil(t / actEffW);

    // Calculate virtual opening positions
    const flatOpenings: any[] = [];
    (wall.openings || []).forEach(op => {
      for (let i=0; i < op.count; i++) flatOpenings.push(op);
    });
    
    // Sort doors first
    flatOpenings.sort((a, b) => (a.type === 'door' ? -1 : 1));
    
    const posOffsets: Record<string, number> = {
      'Left': 0.3,
      'Right': 0.3,
      'Center': 0
    };

    const centerOpenings = flatOpenings.filter(o => o.position === 'Center' || !o.position);
    const totalCenterWidth = centerOpenings.reduce((sum, op) => sum + toMeters(op.width, op.unit || wall.dimensions.unit) + 0.2, 0) - 0.2;
    posOffsets['Center'] = l / 2 - Math.max(0, totalCenterWidth) / 2;

    const processedOpenings = flatOpenings.map((op, index) => {
      const opW = toMeters(op.width, op.unit || wall.dimensions.unit);
      const opH = toMeters(op.height, op.unit || wall.dimensions.unit);
      const pos = op.position || 'Center';
      
      let cx = 0;
      if (op.distanceFromStart !== undefined) {
        cx = toMeters(op.distanceFromStart, op.unit || wall.dimensions.unit) + opW / 2;
      } else if (pos === 'Left') {
        cx = posOffsets['Left'] + opW / 2;
        posOffsets['Left'] += opW + 0.2; 
      } else if (pos === 'Right') {
        cx = l - (posOffsets['Right'] + opW / 2);
        posOffsets['Right'] += opW + 0.2;
      } else if (pos === 'Center') {
        cx = posOffsets['Center'] + opW / 2;
        posOffsets['Center'] += opW + 0.2;
      } else if (pos === 'Custom Offset') {
        const customOffset = toMeters(op.customOffset || 0, op.unit || wall.dimensions.unit);
        if (posOffsets[`Custom_${customOffset}`] === undefined) posOffsets[`Custom_${customOffset}`] = 0;
        cx = customOffset + opW / 2 + posOffsets[`Custom_${customOffset}`];
        posOffsets[`Custom_${customOffset}`] += opW + 0.2;
      }
      
      let cy = 0;
      if (op.sillHeight !== undefined) {
        cy = toMeters(op.sillHeight, op.unit || wall.dimensions.unit);
      } else if (op.type === 'window' || op.type === 'ventilator') {
        cy = Math.max(0.9, h / 2 - opH / 2); 
      }
      
      return {
        ...op,
        xMin: cx - opW / 2, xMax: cx + opW / 2,
        yMin: cy, yMax: cy + opH,
        renderX: cx - l/2,
        renderY: cy + opH / 2,
        w: op.width,
        h: op.height
      };
    });

    const tempMatrices: THREE.Matrix4[] = [];
    const maxPossibleBricks = actCourses * (actBricksPerCourse + 4) * actDepthLayers;
    const tempColors: Float32Array = new Float32Array(maxPossibleBricks * 3);
    let colorIndex = 0;
    let actualCount = 0;
    const dummy = new THREE.Object3D();
    
    // Center the wall horizontally at origin with clean bay clearance so bricks never bleed over column faces
    const clearance = infillRecess !== false ? 0.004 : 0;
    const startX = -l / 2 + clearance;
    const endX = l / 2 - clearance;
    const startZ = -t / 2;
    
    for (let c = 0; c < actCourses; c++) {
      const y = c * actEffH + (actBH / 2);
      
      for (let d = 0; d < actDepthLayers; d++) {
        const z = startZ + d * actEffW + (actBW / 2);
        
        // Stagger alternate courses
        const stagger = (c % 2 === 0) ? 0 : (actEffL / 2);
        
        // Iterate from -1 to actBricksPerCourse + 1 to ensure complete coverage on staggered rows
        for (let b = -1; b <= actBricksPerCourse + 1; b++) {
          const nominalCenter = startX + b * actEffL + (actEffL / 2) - stagger;
          const origLeft = nominalCenter - (actBL / 2);
          const origRight = nominalCenter + (actBL / 2);
          
          // Strict Wall Boundary Clamping
          // Bricks must NEVER extend before startX or beyond endX (the concrete column boundaries)
          if (origRight <= startX + 0.001 || origLeft >= endX - 0.001) {
            // Completely outside wall span
            continue;
          }
          
          // Compute clamped brick boundaries strictly inside [startX, endX]
          const clampedLeft = Math.max(startX, origLeft);
          const clampedRight = Math.min(endX, origRight);
          const clampedLength = clampedRight - clampedLeft;
          
          if (clampedLength < 0.005) {
            continue;
          }
          
          // Precisely trim/cut bricks around doors, windows, and ventilators
          let intervals: { left: number; right: number }[] = [{ left: clampedLeft, right: clampedRight }];
          
          for (let op of processedOpenings) {
            const opLeft = startX + op.xMin;
            const opRight = startX + op.xMax;
            const isWithinHeight = y >= op.yMin && y <= op.yMax;
            
            if (isWithinHeight) {
              const nextIntervals: { left: number; right: number }[] = [];
              for (const seg of intervals) {
                if (seg.right <= opLeft || seg.left >= opRight) {
                  // Completely outside opening
                  nextIntervals.push(seg);
                } else {
                  // Segment crosses opening: trim cleanly to left and right jambs
                  if (opLeft - seg.left >= 0.01) {
                    nextIntervals.push({ left: seg.left, right: opLeft });
                  }
                  if (seg.right - opRight >= 0.01) {
                    nextIntervals.push({ left: opRight, right: seg.right });
                  }
                }
              }
              intervals = nextIntervals;
            }
          }
          
          // Render each trimmed brick segment
          for (const seg of intervals) {
            const segLen = seg.right - seg.left;
            if (segLen < 0.005) continue;
            
            const posX = (seg.left + seg.right) / 2;
            const scaleX = segLen / actBL;
            
            dummy.position.set(posX, y, z);
            dummy.scale.set(scaleX, 1, 1);
            dummy.updateMatrix();
            tempMatrices.push(dummy.matrix.clone());

            // Assign brick color
            const randomColor = brickColors[Math.floor(Math.random() * brickColors.length)];
            tempColors[colorIndex++] = randomColor.r;
            tempColors[colorIndex++] = randomColor.g;
            tempColors[colorIndex++] = randomColor.b;
            actualCount++;
          }
        }
      }
    }
    
    // Trim colors array
    const finalColors = new Float32Array(tempColors.buffer, 0, actualCount * 3);
    
    return {
      matrices: tempMatrices,
      colors: finalColors,
      brickCount: tempMatrices.length,
      geometryArgs: [actBL, actBH, actBW] as [number, number, number],
      totalLength: l,
      totalHeight: h,
      totalThickness: t,
      processedOpenings
    };
  }, [wall, brickType, settings]);

  useEffect(() => {
    if (meshRef.current) {
      matrices.forEach((mat, i) => {
        meshRef.current!.setMatrixAt(i, mat);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      
      if (!wireframe && colors && colors.length > 0) {
        meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, [matrices, colors, wireframe]);

  return (
    <group position={new THREE.Vector3(...position)} rotation={new THREE.Euler(...rotation)}>
      
      {/* Mortar Joint Fill */}
      {!wireframe && (
        <mesh position={[0, totalHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[Math.max(0.001, totalLength - 0.01), Math.max(0.001, totalHeight - 0.01), Math.max(0.001, totalThickness - 0.01)]} />
          <meshStandardMaterial color="#8a8d91" roughness={1} metalness={0} />
        </mesh>
      )}

      {brickCount > 0 && (
        <instancedMesh ref={meshRef} args={[undefined, undefined, brickCount]} castShadow receiveShadow>
          <boxGeometry args={geometryArgs}>
            {/* Edges are extremely expensive for thousands of instances, so we remove them for performance */}
          </boxGeometry>
          {wireframe ? (
            <meshBasicMaterial color="#E85D04" wireframe={true} />
          ) : (
            <meshStandardMaterial roughness={0.9} metalness={0.05} />
          )}
        </instancedMesh>
      )}
      
      {/* Ghost Box for overall dimensions reference if needed */}
      {wireframe && (
        <mesh position={[0, totalHeight / 2, 0]}>
          <boxGeometry args={[Math.max(0.001, totalLength), Math.max(0.001, totalHeight), Math.max(0.001, totalThickness)]} />
          <meshBasicMaterial color="#ffffff" wireframe={true} transparent opacity={0.1} />
        </mesh>
      )}

      {/* Development / Debug Labels for Openings */}
      {wireframe && processedOpenings.map((op: any, i: number) => (
        <Html key={`op-lbl-${i}`} position={[op.renderX, op.renderY, totalThickness / 2 + 0.1]} center zIndexRange={[100, 0]}>
          <div className="bg-slate-900/90 text-white border border-slate-600 rounded p-1 text-[8px] sm:text-[10px] flex flex-col items-center gap-0.5 whitespace-nowrap shadow-lg cursor-default pointer-events-none">
            <span className="font-bold text-primary capitalize">{op.type}</span>
            <span className="text-slate-300">{op.wallSide || wall.name} — {op.position || 'Center'}</span>
            <span className="text-slate-400 font-mono">{op.w} × {op.h} {op.unit || wall.dimensions.unit}</span>
          </div>
        </Html>
      ))}
    </group>
  );
}
