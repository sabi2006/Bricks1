export type Unit = 'mm' | 'cm' | 'm' | 'in' | 'ft';

export interface Dimensions {
  length: number;
  height: number;
  thickness: number;
  unit: Unit;
  thicknessUnit: Unit;
}

export interface Coordinate {
  x: number;
  y: number;
}

export interface Opening {
  id: string;
  floorId?: string;
  wallId?: string;
  type: 'door' | 'window' | 'ventilator' | 'gate' | 'custom';
  width: number;
  height: number;
  count: number;
  unit: Unit;
  wallSide?: 'Front Wall' | 'Back Wall' | 'Left Wall' | 'Right Wall';
  position?: 'Left' | 'Center' | 'Right' | 'Custom Offset';
  customOffset?: number;
  distanceFromStart?: number;
  sillHeight?: number;
}

export interface Wall {
  id: string;
  floorId?: string;
  name: string;
  dimensions: Dimensions;
  openings: Opening[];
  start?: Coordinate;
  end?: Coordinate;
}

export const DEFAULT_RCC_PILLAR = {
  width: 9, // 9 inches
  depth: 9, // 9 inches
  unit: 'in' as Unit,
};

export interface Pillar {
  id: string;
  name?: string;
  floorId?: string;
  width: number;
  depth: number;
  height: number;
  count: number;
  unit: Unit;
  position?: Coordinate;
  placementType?: 'corner' | 'wall_joint' | 'wall_end' | 'wall' | 'custom' | 'central';
  alignment?: 'centre' | 'outside_corner' | 'inside_corner' | 'flush_exterior' | 'flush_interior' | 'custom_offset';
  shape?: 'square' | 'rectangle' | 'circular';
  finish?: 'raw' | 'smooth' | 'painted';
  showIn3D?: boolean;
  showLabel?: boolean;
  showRebar?: boolean;
  showBeam?: boolean;
  includeInEstimate?: boolean;
  notes?: string;
  continueToFloors?: 'current' | 'ground_first' | 'all' | 'custom';
  customFloorIds?: string[];
  customOffsetX?: number;
  customOffsetY?: number;
  connectedWallIds?: string[];
}

// Convert arbitrary unit to target unit
export const convertUnit = (val: number, fromUnit: Unit, toUnit: Unit): number => {
  return toMeters(val, fromUnit) / toMeters(1, toUnit);
};

// Check if a pillar at candidate coordinate overlaps with any door/window in the given walls
export const checkPillarOpeningCollision = (
  pos: Coordinate,
  pillarWidth: number,
  pillarUnit: Unit,
  walls: Wall[],
  buildingUnit: Unit = 'ft'
): { hasConflict: boolean; opening?: Opening; wall?: Wall; message?: string } => {
  const pWInBuildingUnit = convertUnit(pillarWidth, pillarUnit, buildingUnit);
  const halfPillar = pWInBuildingUnit / 2;

  for (const wall of walls) {
    if (!wall.start || !wall.end || !wall.openings || wall.openings.length === 0) continue;

    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const wallLen = Math.hypot(dx, dy);
    if (wallLen === 0) continue;

    const nx = dx / wallLen;
    const ny = dy / wallLen;

    // Check projection of pos onto wall segment
    const vx = pos.x - wall.start.x;
    const vy = pos.y - wall.start.y;
    const projAlong = vx * nx + vy * ny;
    const distToLine = Math.abs(vx * -ny + vy * nx);

    // If pillar is in close proximity to the wall line
    if (distToLine <= pWInBuildingUnit * 1.2 && projAlong >= -halfPillar && projAlong <= wallLen + halfPillar) {
      for (const op of wall.openings) {
        const opStart = op.distanceFromStart !== undefined ? op.distanceFromStart : 0;
        const opWidth = convertUnit(op.width, op.unit || buildingUnit, buildingUnit);
        const opEnd = opStart + opWidth;

        // Pillar span along wall
        const pillarStart = projAlong - halfPillar;
        const pillarEnd = projAlong + halfPillar;

        // Check 1D overlap along the wall
        if (pillarEnd > opStart + 0.1 && pillarStart < opEnd - 0.1) {
          return {
            hasConflict: true,
            opening: op,
            wall: wall,
            message: `Conflict: Pillar at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) overlaps with ${op.type} on ${wall.name}`
          };
        }
      }
    }
  }

  return { hasConflict: false };
};

// Calculate effective pillar position based on alignment mode and connected walls
export const getEffectivePillarPosition = (
  pillar: Pillar,
  walls: Wall[] = [],
  targetUnit: Unit = 'ft'
): Coordinate => {
  if (!pillar.position) return { x: 0, y: 0 };
  const basePos = { ...pillar.position };
  if (pillar.alignment === 'custom_offset' && (pillar.customOffsetX || pillar.customOffsetY)) {
    const ox = convertUnit(pillar.customOffsetX || 0, pillar.unit, targetUnit);
    const oy = convertUnit(pillar.customOffsetY || 0, pillar.unit, targetUnit);
    return { x: basePos.x + ox, y: basePos.y + oy };
  }
  return basePos;
};

// Detect structurally sound pillar positions for a floor (corners, major junctions, intermediate spans, center)
export const detectStructuralPillars = (
  floor: Floor,
  buildingLength: number,
  buildingWidth: number,
  buildingUnit: Unit = 'ft',
  defaultHeight: number = 10
): Pillar[] => {
  const allWalls = [...floor.externalWalls, ...floor.internalWalls];
  const candidatePoints: Array<{ coord: Coordinate; type: 'corner' | 'wall_joint' | 'wall_end' | 'central'; alignment: Pillar['alignment'] }> = [];

  const addPoint = (coord: Coordinate, type: 'corner' | 'wall_joint' | 'wall_end' | 'central', alignment: Pillar['alignment'] = 'outside_corner') => {
    const exists = candidatePoints.some(cp => Math.hypot(cp.coord.x - coord.x, cp.coord.y - coord.y) < 1.0);
    if (!exists) {
      candidatePoints.push({ coord, type, alignment });
    }
  };

  // 1. Four exterior corners
  if (floor.externalWalls.length > 0) {
    floor.externalWalls.forEach(w => {
      if (w.start) addPoint(w.start, 'corner', 'outside_corner');
      if (w.end) addPoint(w.end, 'corner', 'outside_corner');
    });
  } else {
    // Default building rectangle corners
    addPoint({ x: 0, y: 0 }, 'corner', 'outside_corner');
    addPoint({ x: buildingLength, y: 0 }, 'corner', 'outside_corner');
    addPoint({ x: buildingLength, y: buildingWidth }, 'corner', 'outside_corner');
    addPoint({ x: 0, y: buildingWidth }, 'corner', 'outside_corner');
  }

  // 2. Intermediate spans on long walls (if span >= 18ft, place midpoint)
  allWalls.forEach(w => {
    if (!w.start || !w.end) return;
    const len = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
    if (len >= 18) {
      const mid: Coordinate = {
        x: (w.start.x + w.end.x) / 2,
        y: (w.start.y + w.end.y) / 2
      };
      addPoint(mid, 'wall_joint', 'centre');
    }
  });

  // 3. Internal wall junctions
  floor.internalWalls.forEach(w => {
    if (w.start) addPoint(w.start, 'wall_joint', 'centre');
    if (w.end) addPoint(w.end, 'wall_joint', 'centre');
  });

  // 4. Central structural support position
  const midX = buildingLength / 2;
  const midY = buildingWidth / 2;
  addPoint({ x: midX, y: midY }, 'central', 'centre');

  // Filter out any candidates that conflict with door or window openings
  const defaultPillarWidth = DEFAULT_RCC_PILLAR.width;
  const defaultPillarUnit = DEFAULT_RCC_PILLAR.unit;

  const validPoints = candidatePoints.filter(cp => {
    const collision = checkPillarOpeningCollision(cp.coord, defaultPillarWidth, defaultPillarUnit, allWalls, buildingUnit);
    return !collision.hasConflict;
  });

  return validPoints.map((pt, idx) => ({
    id: `pillar-${floor.id}-${idx + 1}`,
    name: `P${idx + 1}`,
    floorId: floor.id,
    width: defaultPillarWidth,
    depth: DEFAULT_RCC_PILLAR.depth,
    height: defaultHeight,
    count: 1,
    unit: defaultPillarUnit,
    position: pt.coord,
    placementType: pt.type,
    alignment: pt.alignment,
    shape: 'square',
    finish: 'raw',
    includeInEstimate: true,
    showIn3D: true
  }));
};

export interface StructuralBay {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  depth: number;
  centerX: number;
  centerY: number;
  pillarIds: string[];
  corners: Coordinate[];
}

/**
 * Detect all closed structural bays formed by connected RCC pillars.
 * Only returns valid closed polygons/rectangles where all bounding pillars exist.
 * Open areas, isolated pillars, or unclosed lines of pillars produce NO fill.
 */
export const detectClosedStructuralBays = (
  pillars: Pillar[] = [],
  buildingUnit: Unit = 'ft'
): StructuralBay[] => {
  const validPillars = pillars.filter(p => p.position && p.showIn3D !== false);
  if (validPillars.length < 4) {
    return [];
  }

  const tol = 1.0; // 1 ft clustering tolerance
  const pts = validPillars.map(p => ({
    id: p.id,
    x: p.position!.x,
    y: p.position!.y
  }));

  const clusterCoords = (vals: number[]): number[] => {
    const sorted = [...vals].sort((a, b) => a - b);
    const clusters: number[] = [];
    for (const v of sorted) {
      const matchIdx = clusters.findIndex(c => Math.abs(c - v) <= tol);
      if (matchIdx >= 0) {
        clusters[matchIdx] = (clusters[matchIdx] + v) / 2;
      } else {
        clusters.push(v);
      }
    }
    return clusters.sort((a, b) => a - b);
  };

  const uniqueXs = clusterCoords(pts.map(p => p.x));
  const uniqueYs = clusterCoords(pts.map(p => p.y));

  const bays: StructuralBay[] = [];

  const findPillarNear = (x: number, y: number): { id: string; x: number; y: number } | undefined => {
    return pts.find(p => Math.abs(p.x - x) <= tol && Math.abs(p.y - y) <= tol);
  };

  // Check every candidate grid cell [X_i, X_{i+1}] x [Y_j, Y_{j+1}]
  for (let i = 0; i < uniqueXs.length - 1; i++) {
    for (let j = 0; j < uniqueYs.length - 1; j++) {
      const x1 = uniqueXs[i];
      const x2 = uniqueXs[i + 1];
      const y1 = uniqueYs[j];
      const y2 = uniqueYs[j + 1];

      if (x2 - x1 < 1.0 || y2 - y1 < 1.0) continue;

      const pTL = findPillarNear(x1, y1);
      const pTR = findPillarNear(x2, y1);
      const pBR = findPillarNear(x2, y2);
      const pBL = findPillarNear(x1, y2);

      // A valid closed structural bay requires all 4 corner pillars to be present
      if (pTL && pTR && pBR && pBL) {
        const bayId = `bay-${pTL.id}-${pTR.id}-${pBR.id}-${pBL.id}`;
        const minX = Math.min(pTL.x, pBL.x);
        const maxX = Math.max(pTR.x, pBR.x);
        const minY = Math.min(pTL.y, pTR.y);
        const maxY = Math.max(pBL.y, pBR.y);

        bays.push({
          id: bayId,
          minX,
          maxX,
          minY,
          maxY,
          width: maxX - minX,
          depth: maxY - minY,
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
          pillarIds: [pTL.id, pTR.id, pBR.id, pBL.id],
          corners: [
            { x: pTL.x, y: pTL.y },
            { x: pTR.x, y: pTR.y },
            { x: pBR.x, y: pBR.y },
            { x: pBL.x, y: pBL.y }
          ]
        });
      }
    }
  }

  // Fallback for single convex quad if exactly 4 pillars exist
  if (bays.length === 0 && validPillars.length === 4) {
    const sortedByAngle = [...pts].sort((a, b) => {
      const cX = pts.reduce((s, p) => s + p.x, 0) / 4;
      const cY = pts.reduce((s, p) => s + p.y, 0) / 4;
      return Math.atan2(a.y - cY, a.x - cX) - Math.atan2(b.y - cY, b.x - cX);
    });
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));

    if (maxX - minX >= 1.0 && maxY - minY >= 1.0) {
      bays.push({
        id: `bay-${pts.map(p => p.id).join('-')}`,
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX,
        depth: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        pillarIds: pts.map(p => p.id),
        corners: sortedByAngle
      });
    }
  }

  return bays;
};

export interface StructuralBeam {
  id: string;
  startPillarId: string;
  endPillarId: string;
  start: Coordinate;
  end: Coordinate;
  length: number;
}

/**
 * Detect all adjacent pillar-to-pillar structural beams along rows and columns of pillars.
 */
export const detectPillarToPillarBeams = (
  pillars: Pillar[] = [],
  buildingUnit: Unit = 'ft'
): StructuralBeam[] => {
  const validPillars = pillars.filter(p => p.position && p.showIn3D !== false);
  if (validPillars.length < 2) return [];

  const tol = 1.0; // 1 ft clustering tolerance
  const beams: StructuralBeam[] = [];
  const beamKeys = new Set<string>();

  const addBeam = (p1: Pillar, p2: Pillar) => {
    if (!p1.position || !p2.position || p1.id === p2.id) return;
    const key = [p1.id, p2.id].sort().join('--');
    if (beamKeys.has(key)) return;
    beamKeys.add(key);

    const len = Math.hypot(p2.position.x - p1.position.x, p2.position.y - p1.position.y);
    if (len <= 0.1) return;

    beams.push({
      id: `beam-${p1.id}-${p2.id}`,
      startPillarId: p1.id,
      endPillarId: p2.id,
      start: { x: p1.position.x, y: p1.position.y },
      end: { x: p2.position.x, y: p2.position.y },
      length: len
    });
  };

  const clusterByCoord = (items: Pillar[], getCoord: (p: Pillar) => number): Pillar[][] => {
    const sorted = [...items].sort((a, b) => getCoord(a) - getCoord(b));
    const groups: Pillar[][] = [];
    for (const p of sorted) {
      const v = getCoord(p);
      const group = groups.find(g => Math.abs(getCoord(g[0]) - v) <= tol);
      if (group) {
        group.push(p);
      } else {
        groups.push([p]);
      }
    }
    return groups;
  };

  // Horizontal structural lines (same Y, connect consecutive sorted by X)
  const yGroups = clusterByCoord(validPillars, p => p.position!.y);
  for (const group of yGroups) {
    group.sort((a, b) => a.position!.x - b.position!.x);
    for (let i = 0; i < group.length - 1; i++) {
      addBeam(group[i], group[i + 1]);
    }
  }

  // Vertical structural lines (same X, connect consecutive sorted by Y)
  const xGroups = clusterByCoord(validPillars, p => p.position!.x);
  for (const group of xGroups) {
    group.sort((a, b) => a.position!.y - b.position!.y);
    for (let i = 0; i < group.length - 1; i++) {
      addBeam(group[i], group[i + 1]);
    }
  }

  return beams;
};


export interface WallSegment {
  id: string;
  wallId: string;
  start: Coordinate;
  end: Coordinate;
  length: number;
  openings: Opening[];
  spanStart: number;
  spanEnd: number;
}

// Split a wall into clean brick sub-segments around all intersecting RCC pillars
export const splitWallByPillars = (
  wall: Wall,
  pillars: Pillar[] = [],
  buildingUnit: Unit = 'ft'
): WallSegment[] => {
  if (!wall.start || !wall.end) return [];

  const s = { ...wall.start };
  const e = { ...wall.end };
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const origLen = Math.hypot(dx, dy);

  if (origLen <= 0.01) return [];

  const dirX = dx / origLen;
  const dirY = dy / origLen;
  const normX = -dirY;
  const normY = dirX;

  const tUnit = wall.dimensions.thicknessUnit || (wall.dimensions.unit === 'ft' ? 'in' : 'mm');
  const wallThick = convertUnit(wall.dimensions.thickness, tUnit, buildingUnit);

  // Collect cut intervals [cStart, cEnd] along wall span [0, origLen]
  const rawCutIntervals: Array<{ start: number; end: number }> = [];

  pillars.forEach(p => {
    if (!p.position || p.showIn3D === false) return;
    const pPos = getEffectivePillarPosition(p, [wall], buildingUnit);
    const pW = convertUnit(p.width, p.unit, buildingUnit);
    const pD = p.shape === 'circular' ? pW : convertUnit(p.depth, p.unit, buildingUnit);

    // Vector from wall start to pillar position
    const vx = pPos.x - s.x;
    const vy = pPos.y - s.y;

    // Projection along wall direction and perpendicular distance
    const projAlong = vx * dirX + vy * dirY;
    const distToLine = Math.abs(vx * normX + vy * normY);

    // Extents of pillar footprint along and perpendicular to wall
    const extentAlong = (Math.abs(dirX) * pW + Math.abs(dirY) * pD) / 2;
    const extentPerp = (Math.abs(normX) * pW + Math.abs(normY) * pD) / 2;

    // Check if pillar intersects or touches the wall's thickness corridor
    if (distToLine <= extentPerp + wallThick / 2 + 0.1) {
      const cStart = Math.max(0, projAlong - extentAlong);
      const cEnd = Math.min(origLen, projAlong + extentAlong);

      if (cEnd - cStart >= 0.02) {
        rawCutIntervals.push({ start: cStart, end: cEnd });
      }
    }
  });

  // Sort intervals by start
  rawCutIntervals.sort((a, b) => a.start - b.start);

  // Merge overlapping / contiguous cut intervals
  const mergedCuts: Array<{ start: number; end: number }> = [];
  rawCutIntervals.forEach(interval => {
    if (mergedCuts.length === 0) {
      mergedCuts.push({ ...interval });
    } else {
      const last = mergedCuts[mergedCuts.length - 1];
      if (interval.start <= last.end + 0.01) {
        last.end = Math.max(last.end, interval.end);
      } else {
        mergedCuts.push({ ...interval });
      }
    }
  });

  // Compute remaining masonry spans between cuts
  const segments: WallSegment[] = [];
  let currentPos = 0;

  mergedCuts.forEach(cut => {
    if (cut.start - currentPos >= 0.05) {
      const segLen = cut.start - currentPos;
      const segStart: Coordinate = {
        x: s.x + dirX * currentPos,
        y: s.y + dirY * currentPos
      };
      const segEnd: Coordinate = {
        x: s.x + dirX * cut.start,
        y: s.y + dirY * cut.start
      };

      // Filter and adjust openings belonging to this segment
      const segOpenings: Opening[] = [];
      (wall.openings || []).forEach(op => {
        const opStart = op.distanceFromStart !== undefined ? op.distanceFromStart : 0;
        const opW = convertUnit(op.width, op.unit || wall.dimensions.unit, buildingUnit);
        const opEnd = opStart + opW;

        if (opEnd > currentPos + 0.01 && opStart < cut.start - 0.01) {
          segOpenings.push({
            ...op,
            distanceFromStart: Math.max(0, opStart - currentPos)
          });
        }
      });

      segments.push({
        id: `${wall.id}-seg-${segments.length + 1}`,
        wallId: wall.id,
        start: segStart,
        end: segEnd,
        length: segLen,
        openings: segOpenings,
        spanStart: currentPos,
        spanEnd: cut.start
      });
    }
    currentPos = Math.max(currentPos, cut.end);
  });

  // Final span from last cut to end of wall
  if (origLen - currentPos >= 0.05) {
    const segLen = origLen - currentPos;
    const segStart: Coordinate = {
      x: s.x + dirX * currentPos,
      y: s.y + dirY * currentPos
    };
    const segEnd: Coordinate = {
      x: s.x + dirX * origLen,
      y: s.y + dirY * origLen
    };

    const segOpenings: Opening[] = [];
    (wall.openings || []).forEach(op => {
      const opStart = op.distanceFromStart !== undefined ? op.distanceFromStart : 0;
      const opW = convertUnit(op.width, op.unit || wall.dimensions.unit, buildingUnit);
      const opEnd = opStart + opW;

      if (opEnd > currentPos + 0.01 && opStart < origLen - 0.01) {
        segOpenings.push({
          ...op,
          distanceFromStart: Math.max(0, opStart - currentPos)
        });
      }
    });

    segments.push({
      id: `${wall.id}-seg-${segments.length + 1}`,
      wallId: wall.id,
      start: segStart,
      end: segEnd,
      length: segLen,
      openings: segOpenings,
      spanStart: currentPos,
      spanEnd: origLen
    });
  }

  return segments;
};

// Geometrically trim a wall by cutting off the spans occupied by pillars
export const trimWallByPillars = (
  wall: Wall,
  pillars: Pillar[] = [],
  buildingUnit: Unit = 'ft'
): { start: Coordinate; end: Coordinate; length: number; trimStart: number; trimEnd: number } => {
  const segments = splitWallByPillars(wall, pillars, buildingUnit);
  if (segments.length === 0) {
    return { start: wall.start || { x: 0, y: 0 }, end: wall.end || { x: 0, y: 0 }, length: 0, trimStart: 0, trimEnd: 0 };
  }
  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];
  const origLen = Math.hypot((wall.end?.x || 0) - (wall.start?.x || 0), (wall.end?.y || 0) - (wall.start?.y || 0));
  const trimStart = firstSeg.spanStart;
  const trimEnd = origLen - lastSeg.spanEnd;
  return {
    start: firstSeg.start,
    end: lastSeg.end,
    length: segments.reduce((sum, seg) => sum + seg.length, 0),
    trimStart,
    trimEnd
  };
};

export interface BrickSizeConfig {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

// Single Source of Truth for Standard TN Red Brick size (230 x 115 x 75 mm)
export const DEFAULT_BRICK_SIZE: BrickSizeConfig = {
  lengthMm: 230,
  widthMm: 115,
  heightMm: 75
};

export interface BrickSpecification {
  productId: string;
  brickType?: string;
  name: string; // Keeping for compatibility or maps to brickName
  length: number; // in mm (maps to brickLength)
  width: number;  // in mm (maps to brickWidth)
  height: number; // in mm (maps to brickHeight)
  brickUnit?: string;
  brickDesign?: string;
  brickTexture?: string;
  brickColor?: string;
  supplierBrand?: string;
}

export const DEFAULT_TN_RED_BRICK: BrickSpecification = {
  productId: 'standard-red',
  name: 'Standard TN Red Brick',
  brickType: 'Standard Red Brick',
  length: DEFAULT_BRICK_SIZE.lengthMm,
  width: DEFAULT_BRICK_SIZE.widthMm,
  height: DEFAULT_BRICK_SIZE.heightMm,
  brickUnit: 'mm',
  brickDesign: 'Standard Solid',
  brickColor: 'Natural Terracotta',
  supplierBrand: 'A V M Bricks'
};

export interface FloorMasonryEstimate {
  floorId: string;
  floorName: string;
  floorLevel: number;
  grossWallArea: number; // m²
  openingArea: number;   // m²
  netWallArea: number;   // m²
  netWallVolume: number; // m³
  brickVolume: number;   // m³
  effectiveBrickVolume: number; // m³
  baseBrickQuantityExact: number;
  baseBrickQuantity: number;
  wastagePercentage: number;
  wastageBricks: number;
  finalBrickQuantityExact: number;
  purchaseBrickQuantity: number;
  brickPrice: number;
  brickCost: number;
  wetMortarVolume: number;
  dryMortarVolume: number;
  cementBags: number;
  sandVolume: number;
  sandCft: number;
}

// Alias for backwards compatibility where needed
export interface RCCReinforcementConfig {
  pillarMainBarDiaMm: number;        // e.g. 16 mm (default: 16)
  pillarMainBarCount: number;        // e.g. 4 bars (default: 4)
  pillarStirrupDiaMm: number;        // e.g. 8 mm (default: 8)
  pillarStirrupSpacingMm: number;    // e.g. 150 mm (default: 150)
  pillarCoverMm: number;             // e.g. 40 mm (default: 40)
  pillarLapAllowancePercent: number; // e.g. 10% (default: 10)

  beamTopBarDiaMm: number;           // e.g. 12 mm (default: 12)
  beamTopBarCount: number;           // e.g. 2 bars (default: 2)
  beamBottomBarDiaMm: number;        // e.g. 12 mm (default: 12)
  beamBottomBarCount: number;        // e.g. 2 bars (default: 2)
  beamStirrupDiaMm: number;          // e.g. 8 mm (default: 8)
  beamStirrupSpacingMm: number;      // e.g. 150 mm (default: 150)
  beamCoverMm: number;               // e.g. 25 mm (default: 25)

  slabMainBarDiaMm: number;          // e.g. 10 mm (default: 10)
  slabMainBarSpacingMm: number;      // e.g. 150 mm (default: 150)
  slabDistBarDiaMm: number;          // e.g. 8 mm (default: 8)
  slabDistBarSpacingMm: number;      // e.g. 150 mm (default: 150)
  slabCoverMm: number;               // e.g. 20 mm (default: 20)

  waterCementRatio: number;          // e.g. 0.50 (default: 0.50)
  bindingWireKgPerTonneSteel: number;// e.g. 10 kg/tonne (default: 10)
  coverBlockSpacingMm: number;       // e.g. 1000 mm (default: 1000)
}

export const DEFAULT_RCC_REINFORCEMENT: RCCReinforcementConfig = {
  pillarMainBarDiaMm: 16,
  pillarMainBarCount: 4,
  pillarStirrupDiaMm: 8,
  pillarStirrupSpacingMm: 150,
  pillarCoverMm: 40,
  pillarLapAllowancePercent: 10,

  beamTopBarDiaMm: 12,
  beamTopBarCount: 2,
  beamBottomBarDiaMm: 12,
  beamBottomBarCount: 2,
  beamStirrupDiaMm: 8,
  beamStirrupSpacingMm: 150,
  beamCoverMm: 25,

  slabMainBarDiaMm: 10,
  slabMainBarSpacingMm: 150,
  slabDistBarDiaMm: 8,
  slabDistBarSpacingMm: 150,
  slabCoverMm: 20,

  waterCementRatio: 0.50,
  bindingWireKgPerTonneSteel: 10,
  coverBlockSpacingMm: 1000
};

export interface RCCElementBreakdown {
  elementType: 'pillar' | 'ringBeam' | 'fullRccTop';
  elementName: string;
  count: number;
  concreteVolumeM3: number;
  concreteVolumeCft: number;
  steelKg: number;
  cementBags: number;
  sandCft: number;
  aggregateCft: number;
  waterLitres: number;
  bindingWireKg: number;
  coverBlocks: number;
  cost: number;
}

export interface RCCFloorEstimate {
  floorId: string;
  floorName: string;
  floorLevel: number;
  concreteVolumeM3: number;
  concreteVolumeCft: number;
  dryVolumeM3: number;
  cementBags: number;
  cementExactBags: number;
  sandM3: number;
  sandCft: number;
  aggregateM3: number;
  aggregateCft: number;
  steelKg: number;
  steelTonnes: number;
  waterLitres: number;
  bindingWireKg: number;
  coverBlocks: number;
  costs: {
    cement: number;
    sand: number;
    aggregate: number;
    steel: number;
    bindingWire: number;
    coverBlocks: number;
    labour: number;
    total: number;
  };
  elements: {
    pillars: RCCElementBreakdown;
    ringBeams: RCCElementBreakdown;
    fullRccTop: RCCElementBreakdown;
  };
}

export interface RCCProjectEstimate {
  totalConcreteVolumeM3: number;
  totalConcreteVolumeCft: number;
  totalDryVolumeM3: number;
  totalCementBags: number;
  totalCementExactBags: number;
  totalSandM3: number;
  totalSandCft: number;
  totalAggregateM3: number;
  totalAggregateCft: number;
  totalSteelKg: number;
  totalSteelTonnes: number;
  totalWaterLitres: number;
  totalBindingWireKg: number;
  totalCoverBlocks: number;
  recommendedPurchase: {
    cementBags: number;
    sandCft: number;
    aggregateCft: number;
    steelKg: number;
    bindingWireKg: number;
    coverBlocks: number;
  };
  costs: {
    cement: number;
    sand: number;
    aggregate: number;
    steel: number;
    bindingWire: number;
    coverBlocks: number;
    labour: number;
    total: number;
  };
  floors: RCCFloorEstimate[];
}

export interface FootingRebarConfig {
  mainBarDiaMm: number;
  mainBarCount: number;
  distBarDiaMm: number;
  distBarCount: number;
  coverMm: number;
  hookLengthMm?: number;
}

export interface FoundationFooting {
  id: string;
  floorId: string; // 'floor-0' / 'ground'
  pillarId?: string;
  pillarName?: string;
  position?: Coordinate;
  
  // Excavation
  excavationLength: number;
  excavationWidth: number;
  excavationDepth: number;
  excavationUnit: Unit;
  
  // Sand Filling
  sandFillLength: number;
  sandFillWidth: number;
  sandFillDepth: number;
  sandFillUnit: Unit;
  sandCompactionFactor?: number;
  
  // PCC Base Concrete
  pccLength: number;
  pccWidth: number;
  pccThickness: number;
  pccUnit: Unit;
  pccMixRatio?: '1:3:6' | '1:4:8' | '1:2:4' | 'custom';
  
  // RCC Footing
  footingLength: number;
  footingWidth: number;
  footingDepth: number;
  footingUnit: Unit;
  concreteGrade?: 'M20' | 'M25' | 'M15' | 'custom';
  footingMixRatio?: '1:1.5:3' | '1:2:4' | 'custom';
  
  // Reinforcement
  rebar?: FootingRebarConfig;
  
  enabled?: boolean;
  notes?: string;
}

export interface FoundationConfig {
  enabled: boolean;
  foundationType: 'isolated' | 'combined' | 'strip' | 'raft';
  soilBearingCapacityKnM2: number;
  autoGenerateMode?: boolean;
  
  defaultExcavationDepth: number;
  defaultSandFillDepth: number;
  defaultPccThickness: number;
  defaultPccOffset: number;
  defaultFootingLength: number;
  defaultFootingWidth: number;
  defaultFootingDepth: number;
  defaultUnit: Unit;
  
  defaultMainBarDiaMm: number;
  defaultMainBarCount: number;
  defaultDistBarDiaMm: number;
  defaultDistBarCount: number;
  defaultCoverMm: number;
  
  defaultPccMixRatio: '1:3:6' | '1:4:8' | '1:2:4';
  defaultFootingMixRatio: '1:1.5:3' | '1:2:4';
  sandCompactionFactor: number;
  
  dpcThicknessMm: number;
  dpcWidthIn: number;
  
  footings: FoundationFooting[];
}

export const DEFAULT_FOUNDATION_CONFIG: FoundationConfig = {
  enabled: true,
  foundationType: 'isolated',
  soilBearingCapacityKnM2: 150,
  autoGenerateMode: true,
  
  defaultExcavationDepth: 4, // 4 ft
  defaultSandFillDepth: 0.5, // 6 in / 0.5 ft
  defaultPccThickness: 0.33, // 4 in / 0.33 ft
  defaultPccOffset: 0.5, // 6 in projection beyond footing
  defaultFootingLength: 4, // 4 ft
  defaultFootingWidth: 4, // 4 ft
  defaultFootingDepth: 1, // 1 ft
  defaultUnit: 'ft',
  
  defaultMainBarDiaMm: 12,
  defaultMainBarCount: 6,
  defaultDistBarDiaMm: 12,
  defaultDistBarCount: 6,
  defaultCoverMm: 50, // 50 mm cover for footing
  
  defaultPccMixRatio: '1:4:8',
  defaultFootingMixRatio: '1:1.5:3', // M20
  sandCompactionFactor: 1.15,
  
  dpcThicknessMm: 50,
  dpcWidthIn: 9,
  
  footings: []
};

export interface FootingItemEstimate {
  footingId: string;
  pillarId?: string;
  pillarName?: string;
  position?: Coordinate;
  excavationVolumeM3: number;
  sandFillVolumeM3: number;
  sandFillCft: number;
  pccVolumeM3: number;
  pccVolumeCft: number;
  pccCementBags: number;
  pccSandCft: number;
  pccAggregateCft: number;
  pccWaterLitres: number;
  rccFootingVolumeM3: number;
  rccFootingVolumeCft: number;
  rccCementBags: number;
  rccSandCft: number;
  rccAggregateCft: number;
  rccWaterLitres: number;
  mainSteelKg: number;
  distSteelKg: number;
  columnStarterSteelKg: number;
  totalSteelKg: number;
  bindingWireKg: number;
  coverBlocks: number;
  backfillVolumeM3: number;
  totalCost: number;
}

export interface FoundationEstimate {
  totalExcavationM3: number;
  totalSandFillM3: number;
  totalSandFillCft: number;
  totalPccVolumeM3: number;
  totalPccVolumeCft: number;
  totalRccFootingVolumeM3: number;
  totalRccFootingVolumeCft: number;
  
  // Materials
  cementBags: number;
  cementExactBags: number;
  sandM3: number;
  sandCft: number;
  aggregateM3: number;
  aggregateCft: number;
  waterLitres: number;
  steelKg: number;
  steelTonnes: number;
  bindingWireKg: number;
  coverBlocks: number;
  backfillVolumeM3: number;
  dpcAreaM2: number;
  dpcAreaSqFt: number;
  
  recommendedPurchase: {
    cementBags: number;
    sandCft: number;
    aggregateCft: number;
    steelKg: number;
    bindingWireKg: number;
    coverBlocks: number;
  };
  
  costs: {
    excavation: number;
    sandFill: number;
    pcc: number;
    rccFooting: number;
    cement: number;
    sand: number;
    aggregate: number;
    steel: number;
    bindingWire: number;
    coverBlocks: number;
    labour: {
      excavation: number;
      mason: number;
      steelFixer: number;
      concreteLabour: number;
      helper: number;
      totalLabour: number;
    };
    total: number;
  };
  
  footings: FootingItemEstimate[];
}

export interface CalculatorSettings {
  mortarJointHorizontal: number; // in mm
  mortarJointVertical: number;   // in mm
  wastagePercentage: number;     // 0-15
  dryVolumeFactor: number;       // 1.33 for mortar
  mixRatioCement: number;        // e.g., 1
  mixRatioSand: number;          // e.g., 5
  brickPrice: number;            // per brick
  cementPrice: number;           // per 50kg bag
  sandPrice: number;             // per m3
  labourCost: number;            // total
  transportCost: number;         // total
  
  // RCC Mix & Material Prices
  rccConcreteMixRatio?: '1:1.5:3' | '1:2:4' | '1:3:6' | 'custom';
  rccCementRatio?: number;
  rccSandRatio?: number;
  rccAggregateRatio?: number;
  sandPricePerCft?: number;      // per CFT (default: 60)
  aggregatePrice?: number;       // per m3
  aggregatePricePerCft?: number; // per CFT (default: 45)
  steelRate?: number;            // per kg (default: 65)
  bindingWireRate?: number;      // per kg (default: 85)
  coverBlockPrice?: number;      // per piece (default: 3)
  rccLabourRate?: number;        // per m3 (default: 3500)
  rccSteelKgPerM3?: number;

  // Foundation specific rates
  excavationRatePerM3?: number;  // per m3 (default: 250)
  sandFillRatePerCft?: number;   // per CFT (default: 40)
  pccLabourRatePerM3?: number;   // per m3 (default: 2500)
  footingLabourRatePerM3?: number; // per m3 (default: 3500)

  // RCC Reinforcement Configuration
  rccReinforcement?: Partial<RCCReinforcementConfig>;
}

export interface CalculationResult {
  grossWallArea: number; // m²
  openingArea: number;   // m²
  netWallArea: number;   // m²
  netWallVolume: number; // m³
  brickVolume: number;   // m³
  effectiveBrickVolume: number; // m³
  baseBrickQuantityExact: number;
  baseBrickQuantity: number;
  wastagePercentage: number;
  wastageBricks: number;
  finalBrickQuantityExact: number;
  purchaseBrickQuantity: number;
  totalBricks: number;
  brickPrice: number;
  wetMortarVolume: number; // m³
  dryMortarVolume: number; // m³
  cementBags: number;      // 50kg bags
  sandVolume: number;      // m³
  costs: {
    bricks: number;
    cement: number;
    sand: number;
    labour: number;
    transport: number;
    total: number;
  };
  floorMasonryEstimates?: FloorMasonryEstimate[];
  rccPillarEstimate?: {
    totalVolume: number;
    cementBags: number;
    sandVolume: number;
    aggregateVolume: number;
    steelKg: number;
    costs: {
      cement: number;
      sand: number;
      aggregate: number;
      steel: number;
      labour: number;
      total: number;
    };
  };
  rccProjectEstimate?: RCCProjectEstimate;
  foundationEstimate?: FoundationEstimate;
}

export const toMeters = (value: number, unit: Unit): number => {
  if (!value || isNaN(value)) return 0;
  const multipliers: Record<Unit, number> = {
    mm: 0.001,
    cm: 0.01,
    m: 1,
    in: 0.0254,
    ft: 0.3048
  };
  return value * multipliers[unit];
};

export const toSqMeters = (area: number, unit: Unit): number => {
  const m = toMeters(1, unit);
  return area * (m * m);
};

export const calculateWallMetrics = (wall: Wall) => {
  const { length, height, thickness, unit, thicknessUnit } = wall.dimensions;
  
  const l = toMeters(length, unit);
  const h = toMeters(height, unit);
  
  // If thicknessUnit is not set, default to inches if length is feet, or mm if length is m/cm/mm
  const tUnit = thicknessUnit || (unit === 'ft' ? 'in' : (unit === 'm' ? 'm' : unit));
  const t = toMeters(thickness, tUnit);
  
  const grossArea = l * h;
  
  let openingArea = 0;
  wall.openings.forEach(op => {
    const w = toMeters(op.width, op.unit || unit);
    const opH = toMeters(op.height, op.unit || unit);
    openingArea += (w * opH * (op.count || 1));
  });
  
  const netArea = Math.max(0, grossArea - openingArea);
  const netVolume = netArea * t;
  
  return { grossArea, openingArea, netArea, netVolume };
};

export const calculatePillarMetrics = (pillar: Pillar) => {
  const w = toMeters(pillar.width, pillar.unit);
  const d = toMeters(pillar.depth, pillar.unit);
  const h = toMeters(pillar.height, pillar.unit);
  
  // Volume based on shape
  let volume = 0;
  if (pillar.shape === 'circular') {
    const radius = Math.max(w, d) / 2;
    volume = Math.PI * radius * radius * h * (pillar.count || 1);
  } else {
    // Default to square/rectangle
    volume = w * d * h * (pillar.count || 1);
  }
  
  return { volume };
};

// Calculate steel weight per linear meter from diameter in mm (kg/m = D² / 162)
export const getSteelBarWeightPerMeter = (diameterMm: number): number => {
  if (!diameterMm || isNaN(diameterMm) || diameterMm <= 0) return 0;
  return (diameterMm * diameterMm) / 162;
};

// 1. Calculate Pillars RCC Concrete & Steel
export const calculatePillarsRcc = (
  pillars: Pillar[] = [],
  floorHeight: number = 10,
  buildingUnit: Unit = 'ft',
  reinf: RCCReinforcementConfig = DEFAULT_RCC_REINFORCEMENT
): {
  concreteVolumeM3: number;
  concreteVolumeCft: number;
  steelKg: number;
  coverBlocks: number;
  count: number;
} => {
  const activePillars = pillars.filter(p => p.includeInEstimate !== false && p.showIn3D !== false);
  if (activePillars.length === 0) {
    return { concreteVolumeM3: 0, concreteVolumeCft: 0, steelKg: 0, coverBlocks: 0, count: 0 };
  }

  let totalConcreteM3 = 0;
  let totalSteelKg = 0;
  let totalCoverBlocks = 0;

  const mainWeightPerM = getSteelBarWeightPerMeter(reinf.pillarMainBarDiaMm);
  const stirrupWeightPerM = getSteelBarWeightPerMeter(reinf.pillarStirrupDiaMm);
  const lapFactor = 1 + (reinf.pillarLapAllowancePercent || 0) / 100;
  const coverM = (reinf.pillarCoverMm || 40) * 0.001;
  const spacingM = Math.max(0.05, (reinf.pillarStirrupSpacingMm || 150) * 0.001);
  const coverBlockSpacingM = Math.max(0.5, (reinf.coverBlockSpacingMm || 1000) * 0.001);

  activePillars.forEach(p => {
    const pW_M = toMeters(p.width, p.unit || 'in');
    const pD_M = p.shape === 'circular' ? pW_M : toMeters(p.depth, p.unit || 'in');
    // Height is in p.heightUnit or buildingUnit (never default to p.unit which is in/inches for cross section)
    const hUnit = p.heightUnit || (p.unit === 'in' || p.unit === 'cm' || p.unit === 'mm' ? buildingUnit : p.unit) || 'ft';
    const pH_M = p.height ? toMeters(p.height, hUnit) : toMeters(floorHeight, buildingUnit || 'ft');
    const pCount = p.count || 1;

    // Concrete volume
    let volM3 = 0;
    if (p.shape === 'circular') {
      const r = Math.max(pW_M, pD_M) / 2;
      volM3 = Math.PI * r * r * pH_M * pCount;
    } else {
      volM3 = pW_M * pD_M * pH_M * pCount;
    }
    totalConcreteM3 += volM3;

    // Steel calculation
    // Main bars
    const mainBarCount = reinf.pillarMainBarCount || 4;
    const mainBarLengthM = pH_M * mainBarCount * lapFactor;
    const mainBarSteelKg = mainBarLengthM * mainWeightPerM * pCount;

    // Stirrups
    const stirrupCount = Math.max(1, Math.ceil(pH_M / spacingM) + 1);
    let stirrupCutLengthM = 0;
    if (p.shape === 'circular') {
      const coreR = Math.max(0.025, Math.max(pW_M, pD_M) / 2 - coverM);
      stirrupCutLengthM = (2 * Math.PI * coreR) + 0.15; // 15cm hook
    } else {
      const coreW = Math.max(0.05, pW_M - 2 * coverM);
      const coreD = Math.max(0.05, pD_M - 2 * coverM);
      stirrupCutLengthM = (2 * (coreW + coreD)) + 0.15; // 15cm hook
    }
    const stirrupSteelKg = stirrupCount * stirrupCutLengthM * stirrupWeightPerM * pCount;

    totalSteelKg += (mainBarSteelKg + stirrupSteelKg);

    // Cover blocks (4 corners per spacing interval)
    const blocksPerPillar = Math.max(4, Math.ceil(pH_M / coverBlockSpacingM) * 4);
    totalCoverBlocks += blocksPerPillar * pCount;
  });

  return {
    concreteVolumeM3: totalConcreteM3,
    concreteVolumeCft: totalConcreteM3 * 35.3147,
    steelKg: totalSteelKg,
    coverBlocks: totalCoverBlocks,
    count: activePillars.reduce((sum, p) => sum + (p.count || 1), 0)
  };
};

// 2. Calculate Ring Beams RCC Concrete & Steel
export const calculateRingBeamsRcc = (
  walls: Wall[] = [],
  ringBeamConfig?: RCCRingBeamConfig,
  buildingUnit: Unit = 'ft',
  reinf: RCCReinforcementConfig = DEFAULT_RCC_REINFORCEMENT
): {
  concreteVolumeM3: number;
  concreteVolumeCft: number;
  steelKg: number;
  coverBlocks: number;
  lengthM: number;
} => {
  if (!ringBeamConfig || ringBeamConfig.enabled === false || walls.length === 0) {
    return { concreteVolumeM3: 0, concreteVolumeCft: 0, steelKg: 0, coverBlocks: 0, lengthM: 0 };
  }

  const beamH_M = toMeters(ringBeamConfig.height ?? 2, ringBeamConfig.heightUnit || 'ft');
  const beamW_M = toMeters(ringBeamConfig.width ?? 9, ringBeamConfig.widthUnit || 'in');
  if (beamH_M <= 0 || beamW_M <= 0) {
    return { concreteVolumeM3: 0, concreteVolumeCft: 0, steelKg: 0, coverBlocks: 0, lengthM: 0 };
  }

  let totalLengthM = 0;
  walls.forEach(w => {
    if (w.start && w.end) {
      const sX = toMeters(w.start.x, w.dimensions.unit);
      const sY = toMeters(w.start.y, w.dimensions.unit);
      const eX = toMeters(w.end.x, w.dimensions.unit);
      const eY = toMeters(w.end.y, w.dimensions.unit);
      const len = Math.hypot(eX - sX, eY - sY);
      if (len > 0.05) {
        totalLengthM += len;
      }
    } else if (w.dimensions?.length) {
      totalLengthM += toMeters(w.dimensions.length, w.dimensions.unit);
    }
  });

  const concreteVolumeM3 = totalLengthM * beamW_M * beamH_M;

  // Steel calculation
  const topWeightPerM = getSteelBarWeightPerMeter(reinf.beamTopBarDiaMm);
  const bottomWeightPerM = getSteelBarWeightPerMeter(reinf.beamBottomBarDiaMm);
  const stirrupWeightPerM = getSteelBarWeightPerMeter(reinf.beamStirrupDiaMm);
  const lapFactor = 1.10; // 10% lap & hook
  const coverM = (reinf.beamCoverMm || 25) * 0.001;
  const spacingM = Math.max(0.05, (reinf.beamStirrupSpacingMm || 150) * 0.001);
  const coverBlockSpacingM = Math.max(0.5, (reinf.coverBlockSpacingMm || 1000) * 0.001);

  // Longitudinal Bars
  const topSteelKg = (reinf.beamTopBarCount || 2) * totalLengthM * lapFactor * topWeightPerM;
  const bottomSteelKg = (reinf.beamBottomBarCount || 2) * totalLengthM * lapFactor * bottomWeightPerM;

  // Stirrups
  const stirrupCount = Math.max(1, Math.ceil(totalLengthM / spacingM) + 1);
  const coreW = Math.max(0.05, beamW_M - 2 * coverM);
  const coreH = Math.max(0.05, beamH_M - 2 * coverM);
  const stirrupCutLengthM = (2 * (coreW + coreH)) + 0.15;
  const stirrupSteelKg = stirrupCount * stirrupCutLengthM * stirrupWeightPerM;

  const totalSteelKg = topSteelKg + bottomSteelKg + stirrupSteelKg;
  const coverBlocks = Math.max(2, Math.ceil(totalLengthM / coverBlockSpacingM) * 2);

  return {
    concreteVolumeM3,
    concreteVolumeCft: concreteVolumeM3 * 35.3147,
    steelKg: totalSteelKg,
    coverBlocks,
    lengthM: totalLengthM
  };
};

// 3. Calculate Full RCC Top / Roof Concrete & Steel (Strictly inside valid closed pillar bays)
export const calculateFullRccTopRcc = (
  pillars: Pillar[] = [],
  fullRingBeamConfig?: RCCFullRingBeamConfig,
  buildingUnit: Unit = 'ft',
  reinf: RCCReinforcementConfig = DEFAULT_RCC_REINFORCEMENT
): {
  concreteVolumeM3: number;
  concreteVolumeCft: number;
  steelKg: number;
  coverBlocks: number;
  areaM2: number;
  bayCount: number;
} => {
  if (!fullRingBeamConfig || fullRingBeamConfig.enabled === false || pillars.length < 4) {
    return { concreteVolumeM3: 0, concreteVolumeCft: 0, steelKg: 0, coverBlocks: 0, areaM2: 0, bayCount: 0 };
  }

  const thickFt = fullRingBeamConfig.thicknessFt || 1;
  const thickM = toMeters(thickFt, 'ft');
  if (thickM <= 0) {
    return { concreteVolumeM3: 0, concreteVolumeCft: 0, steelKg: 0, coverBlocks: 0, areaM2: 0, bayCount: 0 };
  }

  const bays = detectClosedStructuralBays(pillars, buildingUnit);
  if (bays.length === 0) {
    return { concreteVolumeM3: 0, concreteVolumeCft: 0, steelKg: 0, coverBlocks: 0, areaM2: 0, bayCount: 0 };
  }

  let totalAreaM2 = 0;
  let totalSteelKg = 0;
  let totalCoverBlocks = 0;

  const mainWeightPerM = getSteelBarWeightPerMeter(reinf.slabMainBarDiaMm);
  const distWeightPerM = getSteelBarWeightPerMeter(reinf.slabDistBarDiaMm);
  const mainSpacingM = Math.max(0.05, (reinf.slabMainBarSpacingMm || 150) * 0.001);
  const distSpacingM = Math.max(0.05, (reinf.slabDistBarSpacingMm || 150) * 0.001);

  const pSample = pillars[0] || DEFAULT_RCC_PILLAR;
  const pW_M = toMeters(pSample.width || 9, pSample.unit || 'in');
  const pD_M = toMeters(pSample.depth || 9, pSample.unit || 'in');

  bays.forEach(bay => {
    const bayWidthM = toMeters(bay.width, buildingUnit) + pW_M;
    const bayDepthM = toMeters(bay.depth, buildingUnit) + pD_M;
    const bayAreaM2 = bayWidthM * bayDepthM;
    totalAreaM2 += bayAreaM2;

    // Main reinforcement (spanning width)
    const mainBarsCount = Math.max(2, Math.ceil(bayDepthM / mainSpacingM) + 1);
    const mainBarLen = bayWidthM + 0.20; // 20cm anchorage/bends
    const mainSteelKg = mainBarsCount * mainBarLen * mainWeightPerM;

    // Distribution reinforcement (spanning depth)
    const distBarsCount = Math.max(2, Math.ceil(bayWidthM / distSpacingM) + 1);
    const distBarLen = bayDepthM + 0.20;
    const distSteelKg = distBarsCount * distBarLen * distWeightPerM;

    totalSteelKg += (mainSteelKg + distSteelKg);

    // Cover blocks (approx 4 per m2)
    totalCoverBlocks += Math.max(4, Math.ceil(bayAreaM2 * 4));
  });

  const concreteVolumeM3 = totalAreaM2 * thickM;

  return {
    concreteVolumeM3,
    concreteVolumeCft: concreteVolumeM3 * 35.3147,
    steelKg: totalSteelKg,
    coverBlocks: totalCoverBlocks,
    areaM2: totalAreaM2,
    bayCount: bays.length
  };
};

// 4. Convert Concrete Volume & Steel into Itemized Materials and Costs
export const calculateRccMaterialsFromVolume = (
  concreteVolumeM3: number,
  steelKg: number,
  coverBlocks: number,
  settings: CalculatorSettings,
  reinf: RCCReinforcementConfig = DEFAULT_RCC_REINFORCEMENT
) => {
  const dryVolumeM3 = concreteVolumeM3 * 1.54;

  const rC = settings.rccCementRatio ?? 1;
  const rS = settings.rccSandRatio ?? 1.5;
  const rA = settings.rccAggregateRatio ?? 3;
  const rSum = Math.max(1, rC + rS + rA);

  const cementVolumeM3 = dryVolumeM3 * (rC / rSum);
  const sandVolumeM3 = dryVolumeM3 * (rS / rSum);
  const aggregateVolumeM3 = dryVolumeM3 * (rA / rSum);

  const sandCft = sandVolumeM3 * 35.3147;
  const aggregateCft = aggregateVolumeM3 * 35.3147;

  // 1 bag = 0.0347 m3 (50 kg)
  const cementExactBags = cementVolumeM3 / 0.0347;
  const cementBags = Math.ceil(cementExactBags);
  const cementWeightKg = cementExactBags * 50;

  const waterLitres = Math.round(cementWeightKg * (reinf.waterCementRatio || 0.50));

  const steelTonnes = steelKg / 1000;
  const bindingWireKg = steelTonnes * (reinf.bindingWireKgPerTonneSteel || 10);

  // Pricing (with strict unit consistency)
  const cementPrice = settings.cementPrice !== undefined ? settings.cementPrice : 400; // per bag
  const sandPricePerCft = settings.sandPricePerCft !== undefined 
    ? settings.sandPricePerCft 
    : (settings.sandPrice ? (settings.sandPrice > 200 ? settings.sandPrice / 35.3147 : settings.sandPrice) : 60);
  const aggregatePricePerCft = settings.aggregatePricePerCft !== undefined
    ? settings.aggregatePricePerCft
    : (settings.aggregatePrice !== undefined ? (settings.aggregatePrice > 200 ? settings.aggregatePrice / 35.3147 : settings.aggregatePrice) : 45);
  const steelRate = settings.steelRate !== undefined ? settings.steelRate : 65; // per kg
  const bindingWireRate = settings.bindingWireRate !== undefined ? settings.bindingWireRate : 85; // per kg
  const coverBlockPrice = settings.coverBlockPrice !== undefined ? settings.coverBlockPrice : 3; // per piece
  const labourRate = settings.rccLabourRate !== undefined ? settings.rccLabourRate : 4000; // per m3

  // Direct line-item amount = quantity in rate unit * unit rate
  const costCement = cementExactBags * cementPrice;
  const costSand = sandCft * sandPricePerCft;
  const costAggregate = aggregateCft * aggregatePricePerCft;
  const costSteel = steelKg * steelRate;
  const costBindingWire = bindingWireKg * bindingWireRate;
  const costCoverBlocks = coverBlocks * coverBlockPrice;
  const costLabour = concreteVolumeM3 * labourRate;

  const totalCost = costCement + costSand + costAggregate + costSteel + costBindingWire + costCoverBlocks + costLabour;

  return {
    concreteVolumeM3,
    concreteVolumeCft: concreteVolumeM3 * 35.3147,
    dryVolumeM3,
    cementBags,
    cementExactBags,
    sandM3: sandVolumeM3,
    sandCft,
    aggregateM3: aggregateVolumeM3,
    aggregateCft,
    waterLitres,
    steelKg,
    steelTonnes,
    bindingWireKg,
    coverBlocks,
    costs: {
      cement: costCement,
      sand: costSand,
      aggregate: costAggregate,
      steel: costSteel,
      bindingWire: costBindingWire,
      coverBlocks: costCoverBlocks,
      labour: costLabour,
      total: totalCost
    }
  };
};

// 5. Calculate Floor RCC Estimate
export const calculateFloorRccEstimate = (
  floor: Floor,
  modelPillars: Pillar[] = [],
  buildingUnit: Unit = 'ft',
  settings: CalculatorSettings
): RCCFloorEstimate => {
  const reinf: RCCReinforcementConfig = {
    ...DEFAULT_RCC_REINFORCEMENT,
    ...(settings.rccReinforcement || {})
  };

  const floorPillars = (modelPillars && modelPillars.length > 0)
    ? modelPillars.filter(p => p.floorId === floor.id)
    : (floor.pillars || []);

  const allWalls = [...floor.externalWalls, ...floor.internalWalls];

  // Structural mode exclusivity
  const isFullBeamOn = (floor.fullRingBeam?.enabled !== false);
  const isRingBeamOn = !isFullBeamOn && (floor.ringBeam?.enabled === true);

  // A. Pillars
  const pillarRes = calculatePillarsRcc(floorPillars, floor.height, buildingUnit, reinf);
  const pillarMats = calculateRccMaterialsFromVolume(pillarRes.concreteVolumeM3, pillarRes.steelKg, pillarRes.coverBlocks, settings, reinf);

  // B. Ring Beams (only if ring beam is ON and full beam is OFF)
  const ringBeamRes = isRingBeamOn 
    ? calculateRingBeamsRcc(allWalls, floor.ringBeam, buildingUnit, reinf)
    : { concreteVolumeM3: 0, concreteVolumeCft: 0, steelKg: 0, coverBlocks: 0, lengthM: 0 };
  const ringBeamMats = calculateRccMaterialsFromVolume(ringBeamRes.concreteVolumeM3, ringBeamRes.steelKg, ringBeamRes.coverBlocks, settings, reinf);

  // C. Full RCC Top (only if full beam is ON)
  const fullRccRes = isFullBeamOn
    ? calculateFullRccTopRcc(floorPillars, floor.fullRingBeam, buildingUnit, reinf)
    : { concreteVolumeM3: 0, concreteVolumeCft: 0, steelKg: 0, coverBlocks: 0, areaM2: 0, bayCount: 0 };
  const fullRccMats = calculateRccMaterialsFromVolume(fullRccRes.concreteVolumeM3, fullRccRes.steelKg, fullRccRes.coverBlocks, settings, reinf);

  // Floor Cumulative Total
  const totalFloorConcreteM3 = pillarRes.concreteVolumeM3 + ringBeamRes.concreteVolumeM3 + fullRccRes.concreteVolumeM3;
  const totalFloorSteelKg = pillarRes.steelKg + ringBeamRes.steelKg + fullRccRes.steelKg;
  const totalFloorCoverBlocks = pillarRes.coverBlocks + ringBeamRes.coverBlocks + fullRccRes.coverBlocks;

  const floorMats = calculateRccMaterialsFromVolume(totalFloorConcreteM3, totalFloorSteelKg, totalFloorCoverBlocks, settings, reinf);

  return {
    floorId: floor.id,
    floorName: floor.name || `Floor ${floor.level}`,
    floorLevel: floor.level,
    ...floorMats,
    elements: {
      pillars: {
        elementType: 'pillar',
        elementName: 'RCC Pillars / Columns',
        count: pillarRes.count,
        concreteVolumeM3: pillarRes.concreteVolumeM3,
        concreteVolumeCft: pillarRes.concreteVolumeCft,
        steelKg: pillarRes.steelKg,
        cementBags: pillarMats.cementBags,
        sandCft: pillarMats.sandCft,
        aggregateCft: pillarMats.aggregateCft,
        waterLitres: pillarMats.waterLitres,
        bindingWireKg: pillarMats.bindingWireKg,
        coverBlocks: pillarRes.coverBlocks,
        cost: pillarMats.costs.total
      },
      ringBeams: {
        elementType: 'ringBeam',
        elementName: 'RCC Ring Beams',
        count: allWalls.length,
        concreteVolumeM3: ringBeamRes.concreteVolumeM3,
        concreteVolumeCft: ringBeamRes.concreteVolumeCft,
        steelKg: ringBeamRes.steelKg,
        cementBags: ringBeamMats.cementBags,
        sandCft: ringBeamMats.sandCft,
        aggregateCft: ringBeamMats.aggregateCft,
        waterLitres: ringBeamMats.waterLitres,
        bindingWireKg: ringBeamMats.bindingWireKg,
        coverBlocks: ringBeamRes.coverBlocks,
        cost: ringBeamMats.costs.total
      },
      fullRccTop: {
        elementType: 'fullRccTop',
        elementName: 'Full RCC Top / Roof',
        count: fullRccRes.bayCount,
        concreteVolumeM3: fullRccRes.concreteVolumeM3,
        concreteVolumeCft: fullRccRes.concreteVolumeCft,
        steelKg: fullRccRes.steelKg,
        cementBags: fullRccMats.cementBags,
        sandCft: fullRccMats.sandCft,
        aggregateCft: fullRccMats.aggregateCft,
        waterLitres: fullRccMats.waterLitres,
        bindingWireKg: fullRccMats.bindingWireKg,
        coverBlocks: fullRccRes.coverBlocks,
        cost: fullRccMats.costs.total
      }
    }
  };
};

// 6. Calculate Entire Project RCC Estimate (Cumulative Multi-Floor)
export const calculateProjectRccEstimate = (
  floors: Floor[] = [],
  modelPillars: Pillar[] = [],
  buildingUnit: Unit = 'ft',
  settings: CalculatorSettings
): RCCProjectEstimate => {
  const floorEstimates = floors.map(floor => calculateFloorRccEstimate(floor, modelPillars, buildingUnit, settings));

  const totalConcreteVolumeM3 = floorEstimates.reduce((sum, f) => sum + f.concreteVolumeM3, 0);
  const totalConcreteVolumeCft = totalConcreteVolumeM3 * 35.3147;
  const totalDryVolumeM3 = totalConcreteVolumeM3 * 1.54;
  const totalCementExactBags = floorEstimates.reduce((sum, f) => sum + f.cementExactBags, 0);
  const totalCementBags = Math.ceil(totalCementExactBags);
  const totalSandM3 = floorEstimates.reduce((sum, f) => sum + f.sandM3, 0);
  const totalSandCft = totalSandM3 * 35.3147;
  const totalAggregateM3 = floorEstimates.reduce((sum, f) => sum + f.aggregateM3, 0);
  const totalAggregateCft = totalAggregateM3 * 35.3147;
  const totalSteelKg = floorEstimates.reduce((sum, f) => sum + f.steelKg, 0);
  const totalSteelTonnes = totalSteelKg / 1000;
  const totalWaterLitres = floorEstimates.reduce((sum, f) => sum + f.waterLitres, 0);
  const totalBindingWireKg = floorEstimates.reduce((sum, f) => sum + f.bindingWireKg, 0);
  const totalCoverBlocks = floorEstimates.reduce((sum, f) => sum + f.coverBlocks, 0);

  // Recommended purchase with standard 3-5% wastage allowances
  const recommendedPurchase = {
    cementBags: Math.ceil(totalCementExactBags * 1.03),
    sandCft: Math.ceil(totalSandCft * 1.05),
    aggregateCft: Math.ceil(totalAggregateCft * 1.05),
    steelKg: Math.ceil(totalSteelKg * 1.03),
    bindingWireKg: Math.ceil(totalBindingWireKg * 1.05),
    coverBlocks: Math.ceil(totalCoverBlocks * 1.05)
  };

  const costs = {
    cement: floorEstimates.reduce((sum, f) => sum + f.costs.cement, 0),
    sand: floorEstimates.reduce((sum, f) => sum + f.costs.sand, 0),
    aggregate: floorEstimates.reduce((sum, f) => sum + f.costs.aggregate, 0),
    steel: floorEstimates.reduce((sum, f) => sum + f.costs.steel, 0),
    bindingWire: floorEstimates.reduce((sum, f) => sum + f.costs.bindingWire, 0),
    coverBlocks: floorEstimates.reduce((sum, f) => sum + f.costs.coverBlocks, 0),
    labour: floorEstimates.reduce((sum, f) => sum + f.costs.labour, 0),
    total: 0
  };
  costs.total = costs.cement + costs.sand + costs.aggregate + costs.steel + costs.bindingWire + costs.coverBlocks + costs.labour;

  return {
    totalConcreteVolumeM3,
    totalConcreteVolumeCft,
    totalDryVolumeM3,
    totalCementBags,
    totalCementExactBags,
    totalSandM3,
    totalSandCft,
    totalAggregateM3,
    totalAggregateCft,
    totalSteelKg,
    totalSteelTonnes,
    totalWaterLitres,
    totalBindingWireKg,
    totalCoverBlocks,
    recommendedPurchase,
    costs,
    floors: floorEstimates
  };
};

// 7. Calculate Single RCC Footing & Foundation Sub-grade Materials
export const calculateFootingRcc = (
  footing: FoundationFooting,
  settings: CalculatorSettings,
  reinf: RCCReinforcementConfig = DEFAULT_RCC_REINFORCEMENT
): FootingItemEstimate => {
  const fL_M = toMeters(footing.footingLength || 4, footing.footingUnit || 'ft');
  const fW_M = toMeters(footing.footingWidth || 4, footing.footingUnit || 'ft');
  const fD_M = toMeters(footing.footingDepth || 1, footing.footingUnit || 'ft');

  const pccL_M = toMeters(footing.pccLength || (footing.footingLength + 1), footing.pccUnit || 'ft');
  const pccW_M = toMeters(footing.pccWidth || (footing.footingWidth + 1), footing.pccUnit || 'ft');
  const pccT_M = toMeters(footing.pccThickness || 0.33, footing.pccUnit || 'ft');

  const excL_M = toMeters(footing.excavationLength || (footing.pccLength + 1), footing.excavationUnit || 'ft');
  const excW_M = toMeters(footing.excavationWidth || (footing.pccWidth + 1), footing.excavationUnit || 'ft');
  const excD_M = toMeters(footing.excavationDepth || 4, footing.excavationUnit || 'ft');

  const sandL_M = toMeters(footing.sandFillLength || footing.pccLength, footing.sandFillUnit || 'ft');
  const sandW_M = toMeters(footing.sandFillWidth || footing.pccWidth, footing.sandFillUnit || 'ft');
  const sandD_M = toMeters(footing.sandFillDepth || 0.5, footing.sandFillUnit || 'ft');
  const sandCompaction = footing.sandCompactionFactor || 1.15;

  // Volumes
  const excavationVolumeM3 = excL_M * excW_M * excD_M;
  const sandFillVolumeM3 = sandL_M * sandW_M * sandD_M * sandCompaction;
  const sandFillCft = sandFillVolumeM3 * 35.3147;

  const pccVolumeM3 = pccL_M * pccW_M * pccT_M;
  const pccVolumeCft = pccVolumeM3 * 35.3147;

  const rccFootingVolumeM3 = fL_M * fW_M * fD_M;
  const rccFootingVolumeCft = rccFootingVolumeM3 * 35.3147;

  // PCC Materials (Lean concrete, plain concrete without steel)
  const pccRatioStr = footing.pccMixRatio || '1:4:8';
  const pccParts = pccRatioStr.split(':').map(Number);
  const pC = pccParts[0] || 1;
  const pS = pccParts[1] || 4;
  const pA = pccParts[2] || 8;
  const pSum = pC + pS + pA;
  const pccDryVol = pccVolumeM3 * 1.54;
  const pccCementExact = (pccDryVol * (pC / pSum)) / 0.0347;
  const pccCementBags = Math.ceil(pccCementExact);
  const pccSandCft = (pccDryVol * (pS / pSum)) * 35.3147;
  const pccAggregateCft = (pccDryVol * (pA / pSum)) * 35.3147;
  const pccWaterLitres = Math.round(pccCementExact * 50 * 0.55);

  // RCC Footing Materials
  const rccRatioStr = footing.footingMixRatio || settings.rccConcreteMixRatio || '1:1.5:3';
  const rccParts = rccRatioStr.split(':').map(Number);
  const rC = rccParts[0] || 1;
  const rS = rccParts[1] || 1.5;
  const rA = rccParts[2] || 3;
  const rSum = rC + rS + rA;
  const rccDryVol = rccFootingVolumeM3 * 1.54;
  const rccCementExact = (rccDryVol * (rC / rSum)) / 0.0347;
  const rccCementBags = Math.ceil(rccCementExact);
  const rccSandCft = (rccDryVol * (rS / rSum)) * 35.3147;
  const rccAggregateCft = (rccDryVol * (rA / rSum)) * 35.3147;
  const rccWaterLitres = Math.round(rccCementExact * 50 * 0.50);

  // Footing Steel Calculations (D² / 162)
  const coverM = (footing.rebar?.coverMm ?? 50) * 0.001;
  const hookM = (footing.rebar?.hookLengthMm ?? 150) * 0.001;
  
  // Main reinforcement (spanning length)
  const mainCount = footing.rebar?.mainBarCount ?? 6;
  const mainDia = footing.rebar?.mainBarDiaMm ?? 12;
  const mainLenM = Math.max(0.1, fL_M - 2 * coverM) + 2 * hookM;
  const mainWeightPerM = getSteelBarWeightPerMeter(mainDia);
  const mainSteelKg = mainCount * mainLenM * mainWeightPerM;

  // Distribution reinforcement (spanning width)
  const distCount = footing.rebar?.distBarCount ?? 6;
  const distDia = footing.rebar?.distBarDiaMm ?? 12;
  const distLenM = Math.max(0.1, fW_M - 2 * coverM) + 2 * hookM;
  const distWeightPerM = getSteelBarWeightPerMeter(distDia);
  const distSteelKg = distCount * distLenM * distWeightPerM;

  // Column Starter Bars extending into footing
  const starterCount = reinf.pillarMainBarCount || 4;
  const starterDia = reinf.pillarMainBarDiaMm || 16;
  const starterAnchorageLenM = fD_M + 0.30; // depth + 30cm standard 90-degree bend
  const starterSteelKg = starterCount * starterAnchorageLenM * getSteelBarWeightPerMeter(starterDia);

  const totalSteelKg = mainSteelKg + distSteelKg + starterSteelKg;
  const bindingWireKg = (totalSteelKg / 1000) * (reinf.bindingWireKgPerTonneSteel || 10);
  const coverBlocks = Math.max(4, Math.ceil(fL_M * fW_M * 4));

  // Backfill Volume (Excavation Volume minus Substructure Volume)
  const occupiedM3 = pccVolumeM3 + rccFootingVolumeM3 + (sandL_M * sandW_M * sandD_M);
  const backfillVolumeM3 = Math.max(0, excavationVolumeM3 - occupiedM3);

  // Line Item Costs
  const excRate = settings.excavationRatePerM3 ?? 250;
  const sandRate = settings.sandPricePerCft ?? 60;
  const sandFillRate = settings.sandFillRatePerCft ?? 40;
  const cementPrice = settings.cementPrice ?? 400;
  const aggPrice = settings.aggregatePricePerCft ?? 45;
  const steelRate = settings.steelRate ?? 65;
  const wireRate = settings.bindingWireRate ?? 85;
  const coverPrice = settings.coverBlockPrice ?? 3;
  const pccLabourRate = settings.pccLabourRatePerM3 ?? 2500;
  const footingLabourRate = settings.footingLabourRatePerM3 ?? 3500;

  const costExc = excavationVolumeM3 * excRate;
  const costSandFill = sandFillCft * sandFillRate;
  const costPcc = (pccCementExact * cementPrice) + (pccSandCft * sandRate) + (pccAggregateCft * aggPrice) + (pccVolumeM3 * pccLabourRate);
  const costFooting = (rccCementExact * cementPrice) + (rccSandCft * sandRate) + (rccAggregateCft * aggPrice) + 
                      (totalSteelKg * steelRate) + (bindingWireKg * wireRate) + (coverBlocks * coverPrice) + 
                      (rccFootingVolumeM3 * footingLabourRate);

  const totalCost = costExc + costSandFill + costPcc + costFooting;

  return {
    footingId: footing.id,
    pillarId: footing.pillarId,
    pillarName: footing.pillarName,
    position: footing.position,
    excavationVolumeM3,
    sandFillVolumeM3,
    sandFillCft,
    pccVolumeM3,
    pccVolumeCft,
    pccCementBags,
    pccSandCft,
    pccAggregateCft,
    pccWaterLitres,
    rccFootingVolumeM3,
    rccFootingVolumeCft,
    rccCementBags,
    rccSandCft,
    rccAggregateCft,
    rccWaterLitres,
    mainSteelKg,
    distSteelKg,
    columnStarterSteelKg: starterSteelKg,
    totalSteelKg,
    bindingWireKg,
    coverBlocks,
    backfillVolumeM3,
    totalCost
  };
};

// 8. Auto-generate Aligned Footings for Ground Floor RCC Pillars
export const generateFootingsForPillars = (
  pillars: Pillar[] = [],
  config?: Partial<FoundationConfig>,
  buildingUnit: Unit = 'ft'
): FoundationFooting[] => {
  const groundFloorPillars = pillars.filter(p => !p.floorId || p.floorId === 'floor-0' || p.floorId === 'ground');
  const targetPillars = groundFloorPillars.length > 0 ? groundFloorPillars : pillars;

  const footings: FoundationFooting[] = [];
  const cfg = { ...DEFAULT_FOUNDATION_CONFIG, ...(config || {}) };

  targetPillars.forEach((pillar, idx) => {
    if (pillar.includeInEstimate === false) return;
    const fId = `footing-${pillar.id || idx + 1}`;
    const pPos = pillar.position || { x: 0, y: 0 };
    
    const fLen = cfg.defaultFootingLength || 4;
    const fWid = cfg.defaultFootingWidth || 4;
    const fDep = cfg.defaultFootingDepth || 1;
    const pccOffset = cfg.defaultPccOffset || 0.5;

    const pccLen = fLen + 2 * pccOffset;
    const pccWid = fWid + 2 * pccOffset;
    const pccThick = cfg.defaultPccThickness || 0.33;

    const excLen = pccLen + 1.0; // 0.5 ft margin around PCC
    const excWid = pccWid + 1.0;
    const excDep = cfg.defaultExcavationDepth || 4;

    footings.push({
      id: fId,
      floorId: 'floor-0',
      pillarId: pillar.id,
      pillarName: pillar.name || `P${idx + 1}`,
      position: { x: pPos.x, y: pPos.y },
      excavationLength: excLen,
      excavationWidth: excWid,
      excavationDepth: excDep,
      excavationUnit: cfg.defaultUnit || buildingUnit,
      sandFillLength: pccLen,
      sandFillWidth: pccWid,
      sandFillDepth: cfg.defaultSandFillDepth || 0.5,
      sandFillUnit: cfg.defaultUnit || buildingUnit,
      sandCompactionFactor: cfg.sandCompactionFactor || 1.15,
      pccLength: pccLen,
      pccWidth: pccWid,
      pccThickness: pccThick,
      pccUnit: cfg.defaultUnit || buildingUnit,
      pccMixRatio: cfg.defaultPccMixRatio || '1:4:8',
      footingLength: fLen,
      footingWidth: fWid,
      footingDepth: fDep,
      footingUnit: cfg.defaultUnit || buildingUnit,
      concreteGrade: 'M20',
      footingMixRatio: cfg.defaultFootingMixRatio || '1:1.5:3',
      rebar: {
        mainBarDiaMm: cfg.defaultMainBarDiaMm || 12,
        mainBarCount: cfg.defaultMainBarCount || 6,
        distBarDiaMm: cfg.defaultDistBarDiaMm || 12,
        distBarCount: cfg.defaultDistBarCount || 6,
        coverMm: cfg.defaultCoverMm || 50,
        hookLengthMm: 150
      },
      enabled: true
    });
  });

  return footings;
};

// 9. Calculate Complete Foundation & Base Construction Estimate
export const calculateFoundationEstimate = (
  foundationConfig?: FoundationConfig,
  groundWalls: Wall[] = [],
  groundPillars: Pillar[] = [],
  settings: CalculatorSettings = {} as CalculatorSettings,
  buildingUnit: Unit = 'ft'
): FoundationEstimate => {
  const reinf: RCCReinforcementConfig = {
    ...DEFAULT_RCC_REINFORCEMENT,
    ...(settings.rccReinforcement || {})
  };

  const activeFootings = (foundationConfig?.footings && foundationConfig.footings.length > 0)
    ? foundationConfig.footings.filter(f => f.enabled !== false)
    : (foundationConfig?.enabled !== false && groundPillars.length > 0
        ? generateFootingsForPillars(groundPillars, foundationConfig, buildingUnit)
        : []);

  const footingEstimates = activeFootings.map(f => calculateFootingRcc(f, settings, reinf));

  const totalExcavationM3 = footingEstimates.reduce((sum, f) => sum + f.excavationVolumeM3, 0);
  const totalSandFillM3 = footingEstimates.reduce((sum, f) => sum + f.sandFillVolumeM3, 0);
  const totalSandFillCft = totalSandFillM3 * 35.3147;
  const totalPccVolumeM3 = footingEstimates.reduce((sum, f) => sum + f.pccVolumeM3, 0);
  const totalPccVolumeCft = totalPccVolumeM3 * 35.3147;
  const totalRccFootingVolumeM3 = footingEstimates.reduce((sum, f) => sum + f.rccFootingVolumeM3, 0);
  const totalRccFootingVolumeCft = totalRccFootingVolumeM3 * 35.3147;

  const cementExactBags = footingEstimates.reduce((sum, f) => sum + (f.pccCementBags + f.rccCementBags), 0);
  const cementBags = Math.ceil(cementExactBags);
  const sandCft = footingEstimates.reduce((sum, f) => sum + (f.pccSandCft + f.rccSandCft), 0);
  const sandM3 = sandCft / 35.3147;
  const aggregateCft = footingEstimates.reduce((sum, f) => sum + (f.pccAggregateCft + f.rccAggregateCft), 0);
  const aggregateM3 = aggregateCft / 35.3147;
  const waterLitres = footingEstimates.reduce((sum, f) => sum + (f.pccWaterLitres + f.rccWaterLitres), 0);
  const steelKg = footingEstimates.reduce((sum, f) => sum + f.totalSteelKg, 0);
  const steelTonnes = steelKg / 1000;
  const bindingWireKg = footingEstimates.reduce((sum, f) => sum + f.bindingWireKg, 0);
  const coverBlocks = footingEstimates.reduce((sum, f) => sum + f.coverBlocks, 0);
  const backfillVolumeM3 = footingEstimates.reduce((sum, f) => sum + f.backfillVolumeM3, 0);

  // Plinth Damp Proof Course (DPC) Area for Ground Floor Walls
  let totalWallLengthM = 0;
  groundWalls.forEach(w => {
    if (w.start && w.end) {
      const sX = toMeters(w.start.x, w.dimensions.unit);
      const sY = toMeters(w.start.y, w.dimensions.unit);
      const eX = toMeters(w.end.x, w.dimensions.unit);
      const eY = toMeters(w.end.y, w.dimensions.unit);
      totalWallLengthM += Math.hypot(eX - sX, eY - sY);
    } else if (w.dimensions?.length) {
      totalWallLengthM += toMeters(w.dimensions.length, w.dimensions.unit);
    }
  });
  const dpcWidthM = toMeters(foundationConfig?.dpcWidthIn || 9, 'in');
  const dpcAreaM2 = totalWallLengthM * dpcWidthM;
  const dpcAreaSqFt = dpcAreaM2 * 10.7639;

  // Purchase recommendations with standard 5% wastage
  const recommendedPurchase = {
    cementBags: Math.ceil(cementBags * 1.03),
    sandCft: Math.ceil(sandCft * 1.05),
    aggregateCft: Math.ceil(aggregateCft * 1.05),
    steelKg: Math.ceil(steelKg * 1.03),
    bindingWireKg: Math.ceil(bindingWireKg * 1.05),
    coverBlocks: Math.ceil(coverBlocks * 1.05)
  };

  // Cost Aggregations
  const excRate = settings.excavationRatePerM3 ?? 250;
  const sandRate = settings.sandPricePerCft ?? 60;
  const sandFillRate = settings.sandFillRatePerCft ?? 40;
  const cementPrice = settings.cementPrice ?? 400;
  const aggPrice = settings.aggregatePricePerCft ?? 45;
  const steelRate = settings.steelRate ?? 65;
  const wireRate = settings.bindingWireRate ?? 85;
  const coverPrice = settings.coverBlockPrice ?? 3;
  const pccLabourRate = settings.pccLabourRatePerM3 ?? 2500;
  const footingLabourRate = settings.footingLabourRatePerM3 ?? 3500;

  const costExc = totalExcavationM3 * excRate;
  const costSandFill = totalSandFillCft * sandFillRate;
  const costCement = cementBags * cementPrice;
  const costSand = sandCft * sandRate;
  const costAgg = aggregateCft * aggPrice;
  const costSteel = steelKg * steelRate;
  const costWire = bindingWireKg * wireRate;
  const costCover = coverBlocks * coverPrice;
  const costPccLabour = totalPccVolumeM3 * pccLabourRate;
  const costFootingLabour = totalRccFootingVolumeM3 * footingLabourRate;
  const totalLabour = costPccLabour + costFootingLabour;

  // Breakdown of labour categories for estimation transparency
  const labourBreakdown = {
    excavation: costExc * 0.70,
    mason: totalLabour * 0.35,
    steelFixer: (steelKg / 1000) * 4500,
    concreteLabour: totalLabour * 0.40,
    helper: totalLabour * 0.25,
    totalLabour
  };

  const totalCost = costExc + costSandFill + costCement + costSand + costAgg + costSteel + costWire + costCover + totalLabour;

  return {
    totalExcavationM3,
    totalSandFillM3,
    totalSandFillCft,
    totalPccVolumeM3,
    totalPccVolumeCft,
    totalRccFootingVolumeM3,
    totalRccFootingVolumeCft,
    cementBags,
    cementExactBags,
    sandM3,
    sandCft,
    aggregateM3,
    aggregateCft,
    waterLitres,
    steelKg,
    steelTonnes,
    bindingWireKg,
    coverBlocks,
    backfillVolumeM3,
    dpcAreaM2,
    dpcAreaSqFt,
    recommendedPurchase,
    costs: {
      excavation: costExc,
      sandFill: costSandFill,
      pcc: (totalPccVolumeM3 * 1.54 * 0.08 * cementPrice) + (totalPccVolumeM3 * 1.54 * 0.33 * 35.3147 * sandRate) + (totalPccVolumeM3 * 1.54 * 0.67 * 35.3147 * aggPrice) + costPccLabour,
      rccFooting: costCement + costSand + costAgg + costSteel + costWire + costCover + costFootingLabour,
      cement: costCement,
      sand: costSand,
      aggregate: costAgg,
      steel: costSteel,
      bindingWire: costWire,
      coverBlocks: costCover,
      labour: labourBreakdown,
      total: totalCost
    },
    footings: footingEstimates
  };
};

export const calculateProject = (
  project: { walls: Wall[]; pillars?: Pillar[]; buildingModel?: BuildingModel },
  brick: BrickSpecification,
  settings: CalculatorSettings
): CalculationResult => {
  let totalGrossArea = 0;
  let totalOpeningArea = 0;
  let totalNetArea = 0;
  let totalNetVolume = 0;

  // Standard walls
  project.walls.forEach(wall => {
    const metrics = calculateWallMetrics(wall);
    totalGrossArea += metrics.grossArea;
    totalOpeningArea += metrics.openingArea;
    totalNetArea += metrics.netArea;
    totalNetVolume += metrics.netVolume;
  });

  // Pillars (separated from masonry)
  let totalPillarVolume = 0;
  let deductedMasonryVolume = 0;
  const bUnit = project.buildingModel?.buildingUnit || 'ft';
  const effectivePillars = project.pillars && project.pillars.length > 0 
    ? project.pillars 
    : (project.buildingModel?.pillars && project.buildingModel.pillars.length > 0
        ? project.buildingModel.pillars
        : project.buildingModel?.floors.flatMap(f => f.pillars || []) || []);

  // Visual Estimator Building Model (Single Source of Truth synchronization)
  let allModelWalls: Wall[] = [];
  let groundFloorWalls: Wall[] = [];
  if (project.buildingModel) {
    project.buildingModel.floors.forEach((floor, idx) => {
      const isGround = idx === 0 || floor.level === 0;
      [...floor.externalWalls, ...floor.internalWalls].forEach(wall => {
        if (isGround) groundFloorWalls.push(wall);
        // Geometrically trim wall by pillar footprints for exact physical masonry volume
        const floorPillars = effectivePillars.filter(p => !p.floorId || p.floorId === floor.id || p.continueToFloors === 'all');
        const trimmed = trimWallByPillars(wall, floorPillars.length > 0 ? floorPillars : effectivePillars, wall.dimensions.unit);
        if (trimmed.length <= 0.01) return;
        
        const effectiveWall: Wall = {
          ...wall,
          start: trimmed.start,
          end: trimmed.end,
          dimensions: {
            ...wall.dimensions,
            length: trimmed.length
          }
        };
        allModelWalls.push(effectiveWall);
        const metrics = calculateWallMetrics(effectiveWall);
        totalGrossArea += metrics.grossArea;
        totalOpeningArea += metrics.openingArea;
        totalNetArea += metrics.netArea;
        totalNetVolume += metrics.netVolume;
      });
    });
  }

  // Polygons utility for precise cutouts for standalone walls
  const getRectPolygon = (cx: number, cy: number, w: number, h: number, angle: number): Coordinate[] => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const pts = [{ x: -w/2, y: -h/2 }, { x: w/2, y: -h/2 }, { x: w/2, y: h/2 }, { x: -w/2, y: h/2 }];
    return pts.map(p => ({ x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos }));
  };

  const clipPolygon = (subjectPolygon: Coordinate[], clipPolygon: Coordinate[]): Coordinate[] => {
    let outputList = subjectPolygon;
    for (let i = 0; i < clipPolygon.length; i++) {
      const cp1 = clipPolygon[i];
      const cp2 = clipPolygon[(i + 1) % clipPolygon.length];
      const inside = (p: Coordinate) => (cp2.x - cp1.x) * (p.y - cp1.y) - (cp2.y - cp1.y) * (p.x - cp1.x) >= 0;
      const computeIntersection = (s: Coordinate, e: Coordinate) => {
        const dcx = cp1.x - cp2.x, dcy = cp1.y - cp2.y, dpx = s.x - e.x, dpy = s.y - e.y;
        const n1 = cp1.x * cp2.y - cp1.y * cp2.x, n2 = s.x * e.y - s.y * e.x;
        const n3 = 1.0 / (dcx * dpy - dcy * dpx);
        return { x: (n1 * dpx - n2 * dcx) * n3, y: (n1 * dpy - n2 * dcy) * n3 };
      };
      const inputList = outputList;
      outputList = [];
      if (inputList.length === 0) break;
      let s = inputList[inputList.length - 1];
      for (let j = 0; j < inputList.length; j++) {
        const e = inputList[j];
        if (inside(e)) {
          if (!inside(s)) outputList.push(computeIntersection(s, e));
          outputList.push(e);
        } else if (inside(s)) {
          outputList.push(computeIntersection(s, e));
        }
        s = e;
      }
    }
    return outputList;
  };

  const polygonArea = (polygon: Coordinate[]): number => {
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      area += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
    }
    return Math.abs(area) / 2;
  };

  if (effectivePillars.length > 0) {
    effectivePillars.forEach(pillar => {
       const pMetrics = calculatePillarMetrics(pillar);
       if (pillar.includeInEstimate !== false) {
         totalPillarVolume += pMetrics.volume;
       }
       
       // Deduct from standalone project.walls if not using buildingModel
       if (!project.buildingModel && pillar.position && pillar.placementType !== 'custom') {
         const pxM = toMeters(pillar.position.x, bUnit);
         const pyM = toMeters(pillar.position.y, bUnit);
         
         const pwM = toMeters(pillar.width, pillar.unit);
         const pdM = pillar.shape === 'circular' ? pwM : toMeters(pillar.depth, pillar.unit);
         
         const pillarPoly = getRectPolygon(pxM, pyM, pwM, pdM, 0); // Assuming orthogonal pillars for now
         
         const wallsToCheck = project.buildingModel ? allModelWalls : project.walls;
         wallsToCheck.forEach(wall => {
            if (!wall.start || !wall.end) return;
            const startXM = toMeters(wall.start.x, wall.dimensions.unit);
            const startYM = toMeters(wall.start.y, wall.dimensions.unit);
            const endXM = toMeters(wall.end.x, wall.dimensions.unit);
            const endYM = toMeters(wall.end.y, wall.dimensions.unit);
            
            const wallLenM = Math.hypot(endXM - startXM, endYM - startYM);
            if (wallLenM === 0) return;
            
            const angle = Math.atan2(endYM - startYM, endXM - startXM);
            const cx = (startXM + endXM) / 2;
            const cy = (startYM + endYM) / 2;
            
            const tUnit = wall.dimensions.thicknessUnit || (wall.dimensions.unit === 'ft' ? 'in' : (wall.dimensions.unit === 'm' ? 'm' : wall.dimensions.unit));
            const tM = toMeters(wall.dimensions.thickness, tUnit);
            
            const wallPoly = getRectPolygon(cx, cy, wallLenM, tM, angle);
            
            const overlapPoly = clipPolygon(wallPoly, pillarPoly);
            const overlapAreaM2 = polygonArea(overlapPoly);
            
            if (overlapAreaM2 > 0) {
              const hM = toMeters(wall.dimensions.height, wall.dimensions.unit);
              const deductVol = overlapAreaM2 * hM * (pillar.count || 1);
              deductedMasonryVolume += deductVol;
            }
         });
       }
    });
  }
  
  // Apply the deduction to totalNetVolume
  totalNetVolume = Math.max(0, totalNetVolume - deductedMasonryVolume);

  // Brick dimensions in meters (Single Source of Truth: Standard TN Red Brick 230 x 115 x 75 mm)
  const bL = (brick.length || DEFAULT_BRICK_SIZE.lengthMm) * 0.001;
  const bW = (brick.width || DEFAULT_BRICK_SIZE.widthMm) * 0.001;
  const bH = (brick.height || DEFAULT_BRICK_SIZE.heightMm) * 0.001;
  
  const brickVolume = bL * bW * bH;

  // Effective brick dimensions including mortar joints (in meters)
  const mH = (settings.mortarJointHorizontal || 10) * 0.001;
  const mV = (settings.mortarJointVertical || 10) * 0.001;
  
  const effL = bL + mV;
  const effH = bH + mH;
  const effW = bW + mV; // including mortar for thickness calculation
  
  const effectiveBrickVolume = effL * effH * effW;

  // Base quantity of bricks needed for the net wall volume
  const baseBrickQuantityExact = totalNetVolume > 0 && effectiveBrickVolume > 0 
    ? (totalNetVolume / effectiveBrickVolume) 
    : 0;
  const baseBrickQuantity = Math.ceil(baseBrickQuantityExact);
    
  const wastagePercentage = settings.wastagePercentage || 0;
  const finalBrickQuantityExact = baseBrickQuantityExact * (1 + wastagePercentage / 100);
  const purchaseBrickQuantity = Math.ceil(finalBrickQuantityExact);
  const wastageBricks = Math.max(0, purchaseBrickQuantity - baseBrickQuantity);
  const totalBricks = purchaseBrickQuantity;

  // Mortar Calculation
  const volumeOfBricksOnly = baseBrickQuantityExact * brickVolume;
  const wetMortarVolume = Math.max(0, totalNetVolume - volumeOfBricksOnly);
  const dryMortarVolume = wetMortarVolume * (settings.dryVolumeFactor || 1.33);

  // Cement and Sand Ratio
  const ratioCement = settings.mixRatioCement || 1;
  const ratioSand = settings.mixRatioSand || 5;
  const ratioSum = ratioCement + ratioSand;
  
  const cementVolume = ratioSum > 0 ? dryMortarVolume * (ratioCement / ratioSum) : 0;
  const sandVolume = ratioSum > 0 ? dryMortarVolume * (ratioSand / ratioSum) : 0;

  // 1 bag of cement (50kg) = 0.0347 m³ approx (density 1440 kg/m³)
  const cementBags = Math.ceil(cementVolume / 0.0347);

  // Costs
  const brickPrice = settings.brickPrice || 0;
  const brickCost = totalBricks * brickPrice;
  const cementCost = cementBags * (settings.cementPrice || 0);
  const sandCost = sandVolume * (settings.sandPrice || 0);
  
  const totalCost = brickCost + cementCost + sandCost + (settings.labourCost || 0) + (settings.transportCost || 0);

  // Multi-Floor Brick Masonry Breakdown
  const floorMasonryEstimates: FloorMasonryEstimate[] = [];
  if (project.buildingModel && project.buildingModel.floors.length > 0) {
    project.buildingModel.floors.forEach(floor => {
      let flGross = 0, flOpening = 0, flNetArea = 0, flNetVol = 0;
      [...floor.externalWalls, ...floor.internalWalls].forEach(wall => {
        const floorPillars = effectivePillars.filter(p => !p.floorId || p.floorId === floor.id || p.continueToFloors === 'all');
        const trimmed = trimWallByPillars(wall, floorPillars.length > 0 ? floorPillars : effectivePillars, wall.dimensions.unit);
        if (trimmed.length <= 0.01) return;
        const effectiveWall: Wall = {
          ...wall,
          start: trimmed.start,
          end: trimmed.end,
          dimensions: { ...wall.dimensions, length: trimmed.length }
        };
        const m = calculateWallMetrics(effectiveWall);
        flGross += m.grossArea;
        flOpening += m.openingArea;
        flNetArea += m.netArea;
        flNetVol += m.netVolume;
      });

      const flBaseExact = flNetVol > 0 && effectiveBrickVolume > 0 ? (flNetVol / effectiveBrickVolume) : 0;
      const flBase = Math.ceil(flBaseExact);
      const flFinalExact = flBaseExact * (1 + wastagePercentage / 100);
      const flPurchase = Math.ceil(flFinalExact);
      const flWastage = Math.max(0, flPurchase - flBase);
      const flBrickCost = flPurchase * brickPrice;

      const flBrickOnlyVol = flBaseExact * brickVolume;
      const flWetMortar = Math.max(0, flNetVol - flBrickOnlyVol);
      const flDryMortar = flWetMortar * (settings.dryVolumeFactor || 1.33);
      const flCementVol = ratioSum > 0 ? flDryMortar * (ratioCement / ratioSum) : 0;
      const flSandVol = ratioSum > 0 ? flDryMortar * (ratioSand / ratioSum) : 0;
      const flCementBags = Math.ceil(flCementVol / 0.0347);

      floorMasonryEstimates.push({
        floorId: floor.id,
        floorName: floor.name || `Floor ${floor.level}`,
        floorLevel: floor.level,
        grossWallArea: flGross,
        openingArea: flOpening,
        netWallArea: flNetArea,
        netWallVolume: flNetVol,
        brickVolume,
        effectiveBrickVolume,
        baseBrickQuantityExact: flBaseExact,
        baseBrickQuantity: flBase,
        wastagePercentage,
        wastageBricks: flWastage,
        finalBrickQuantityExact: flFinalExact,
        purchaseBrickQuantity: flPurchase,
        brickPrice,
        brickCost: flBrickCost,
        wetMortarVolume: flWetMortar,
        dryMortarVolume: flDryMortar,
        cementBags: flCementBags,
        sandVolume: flSandVol,
        sandCft: flSandVol * 35.3147
      });
    });
  }

  // RCC Pillar Calculation (Backwards compatibility)
  let rccPillarEstimate;
  if (totalPillarVolume > 0) {
    const dryConcreteVolume = totalPillarVolume * 1.54;
    const rC = settings.rccCementRatio || 1;
    const rS = settings.rccSandRatio || 1.5;
    const rA = settings.rccAggregateRatio || 3;
    const rSum = rC + rS + rA;
    
    const pillarCementVol = (rC / rSum) * dryConcreteVolume;
    const pillarSandVol = (rS / rSum) * dryConcreteVolume;
    const pillarAggVol = (rA / rSum) * dryConcreteVolume;
    
    const pillarCementBags = Math.ceil(pillarCementVol / 0.0347);
    const pillarSteelKg = totalPillarVolume * (settings.rccSteelKgPerM3 || 120);
    
    const costC = pillarCementBags * (settings.cementPrice || 0);
    const costS = pillarSandVol * (settings.sandPrice || 0);
    const costA = pillarAggVol * (settings.aggregatePrice || 0);
    const costSt = pillarSteelKg * (settings.steelRate || 0);
    const costL = totalPillarVolume * (settings.rccLabourRate || 0);
    
    rccPillarEstimate = {
      totalVolume: totalPillarVolume,
      cementBags: pillarCementBags,
      sandVolume: pillarSandVol,
      aggregateVolume: pillarAggVol,
      steelKg: pillarSteelKg,
      costs: {
        cement: costC,
        sand: costS,
        aggregate: costA,
        steel: costSt,
        labour: costL,
        total: costC + costS + costA + costSt + costL
      }
    };
  }

  // Full RCC Project Estimate (Multi-Floor Pillars + Ring Beams + Full RCC Top)
  let rccProjectEstimate: RCCProjectEstimate | undefined;
  if (project.buildingModel && project.buildingModel.floors.length > 0) {
    rccProjectEstimate = calculateProjectRccEstimate(
      project.buildingModel.floors,
      project.buildingModel.pillars || effectivePillars,
      bUnit,
      settings
    );
  } else if (effectivePillars.length > 0 || project.walls.length > 0) {
    const syntheticFloor: Floor = {
      id: 'floor-main',
      name: 'Main Structure',
      level: 0,
      height: 10,
      unit: bUnit,
      externalWalls: project.walls,
      internalWalls: [],
      pillars: effectivePillars
    };
    rccProjectEstimate = calculateProjectRccEstimate([syntheticFloor], effectivePillars, bUnit, settings);
  }

  // Foundation Estimate (Strictly Ground Floor / Sub-grade level)
  let foundationEstimate: FoundationEstimate | undefined;
  if (project.buildingModel?.foundation?.enabled !== false) {
    const gfPillars = effectivePillars.filter(p => !p.floorId || p.floorId === 'floor-0' || p.floorId === 'ground');
    const fConfig = project.buildingModel?.foundation || { ...DEFAULT_FOUNDATION_CONFIG, enabled: true };
    if ((fConfig.footings && fConfig.footings.length > 0) || gfPillars.length > 0) {
      foundationEstimate = calculateFoundationEstimate(
        fConfig,
        groundFloorWalls.length > 0 ? groundFloorWalls : (project.walls || []),
        gfPillars.length > 0 ? gfPillars : effectivePillars,
        settings,
        bUnit
      );
    }
  }

  return {
    grossWallArea: totalGrossArea,
    openingArea: totalOpeningArea,
    netWallArea: totalNetArea,
    netWallVolume: totalNetVolume,
    brickVolume,
    effectiveBrickVolume,
    baseBrickQuantityExact,
    baseBrickQuantity,
    wastagePercentage,
    wastageBricks,
    finalBrickQuantityExact,
    purchaseBrickQuantity,
    totalBricks,
    brickPrice,
    wetMortarVolume,
    dryMortarVolume,
    cementBags,
    sandVolume,
    costs: {
      bricks: brickCost,
      cement: cementCost,
      sand: sandCost,
      labour: settings.labourCost || 0,
      transport: settings.transportCost || 0,
      total: totalCost
    },
    floorMasonryEstimates,
    rccPillarEstimate,
    rccProjectEstimate,
    foundationEstimate
  };
};

export interface Room {
  id: string;
  name: string;
  type: 'Bedroom' | 'Kitchen' | 'Bath' | 'Living Hall' | 'Store' | 'Other';
  center?: Coordinate;
}

export interface Staircase {
  id: string;
  name: string;
  start?: Coordinate;
  end?: Coordinate;
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  height: number;
  unit: Unit;
  externalWalls: Wall[];
  internalWalls: Wall[];
  stairs?: Staircase[];
  pillars?: Pillar[];
  ringBeam?: RCCRingBeamConfig;
  fullRingBeam?: RCCFullRingBeamConfig;
  slab?: RCCSlabConfig;
}

export interface RCCRingBeamConfig {
  height: number;
  heightUnit?: Unit;
  width: number;
  widthUnit?: Unit;
  depth: number;
  depthUnit?: Unit;
  enabled?: boolean;
}

export const DEFAULT_RCC_RING_BEAM: RCCRingBeamConfig = {
  height: 2, // 2 ft
  heightUnit: 'ft',
  width: 9, // 9 in
  widthUnit: 'in',
  depth: 9, // 9 in
  depthUnit: 'in',
  enabled: false
};

export interface RCCFullRingBeamConfig {
  enabled: boolean;
  thicknessFt: number; // Thickness in feet (default 1 ft)
}

export const DEFAULT_RCC_FULL_RING_BEAM: RCCFullRingBeamConfig = {
  enabled: true,
  thicknessFt: 1
};

export interface RCCSlabConfig {
  enabled: boolean;
  height: number; // in feet (default 1 ft)
  heightUnit?: Unit;
  thickness?: number; // optional backward compatibility
  thicknessUnit?: Unit;
}

export const DEFAULT_RCC_SLAB: RCCSlabConfig = {
  enabled: true,
  height: 1, // 1 ft default solid RCC floor slab height
  heightUnit: 'ft',
  thickness: 12,
  thicknessUnit: 'in'
};

export interface BuildingModel {
  floors: Floor[];
  compoundWall?: Wall;
  parapetWall?: Wall;
  buildingLength: number;
  buildingWidth: number;
  buildingUnit: Unit;
  externalWallThickness?: number;
  pillars?: Pillar[];
  ringBeam?: RCCRingBeamConfig;
  fullRingBeam?: RCCFullRingBeamConfig;
  slab?: RCCSlabConfig;
  foundation?: FoundationConfig;
  layoutMode?: 'auto' | 'manual';
}

export interface FullCostEstimate {
  estimatedMasonryCost: number;
  estimatedFullCostMin: number;
  estimatedFullCostMax: number;
}


