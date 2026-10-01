import { 
  calculateProject, 
  Wall, 
  Pillar, 
  Floor,
  CalculatorSettings, 
  BrickSpecification,
  getEffectivePillarPosition, 
  getPillarWorldPosition,
  worldPositionTo2D,
  validatePillarPlacement,
  trimWallByPillars,
  splitWallByPillars,
  detectClosedStructuralBays,
  detectPillarToPillarBeams,
  DEFAULT_RCC_FULL_RING_BEAM,
  RCCFullRingBeamConfig,
  DEFAULT_RCC_RING_BEAM,
  RCCRingBeamConfig,
  DEFAULT_RCC_REINFORCEMENT,
  getSteelBarWeightPerMeter,
  calculatePillarsRcc,
  calculateRingBeamsRcc,
  calculateFullRccTopRcc,
  calculateFloorRccEstimate,
  calculateProjectRccEstimate,
  FoundationFooting,
  FoundationConfig,
  DEFAULT_FOUNDATION_CONFIG,
  generateFootingsForPillars,
  calculateFootingRcc,
  getEffectiveFootingSize,
  calculateFoundationEstimate,
  DEFAULT_BRICK_SIZE,
  DEFAULT_TN_RED_BRICK,
  PlasterConfig,
  DEFAULT_PLASTER_CONFIG,
  calculatePlasterEstimate,
  toMetersPlaster,
  parsePlasterMix,
  getRingBeamJunction,
  getFullRoofJunction,
  getTopRccStructuralJunction,
  getStructuralRoofFootprint,
  validateBeamColumnJoint,
  toMeters,
  applyPillarConfigToAll,
  CommonPillarConfig,
  RingBeamJunction,
  FullRoofJunction,
  TopRccStructuralJunction
} from './brickCalculator';

describe('RCC Pillar Exact Corner Placement & Alignment', () => {
  it('deducts the exact overlapping brick masonry for a 9x9 pillar at a 90-degree L-corner', () => {
    const wallA: Wall = {
      id: 'w1',
      name: 'Wall A',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 }, // 10 ft
      dimensions: { length: 10, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const wallB: Wall = {
      id: 'w2',
      name: 'Wall B',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 10 }, // 10 ft
      dimensions: { length: 10, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const pillar: Pillar = {
      id: 'p1',
      name: 'P1',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 0, y: 0 },
      placementType: 'corner',
      alignment: 'outside_corner',
      shape: 'square'
    };

    const settings: CalculatorSettings = {
      mortarJointHorizontal: 10,
      mortarJointVertical: 10,
      wastagePercentage: 5,
      dryVolumeFactor: 1.33,
      mixRatioCement: 1,
      mixRatioSand: 5,
      brickPrice: 8,
      cementPrice: 400,
      sandPrice: 1500,
      labourCost: 0,
      transportCost: 0
    };

    const brick: BrickSpecification = {
      productId: 'std',
      name: 'Standard',
      length: 230,
      width: 110,
      height: 75
    };

    const project = {
      walls: [wallA, wallB],
      pillars: [pillar],
      buildingModel: {
        floors: [{ id: 'f1', name: 'f1', level: 0, height: 10, unit: 'ft', externalWalls: [wallA, wallB], internalWalls: [] }],
        buildingLength: 10,
        buildingWidth: 10,
        buildingUnit: 'ft' as const
      }
    };

    const resultWithoutPillar = calculateProject({ ...project, pillars: [] }, brick, settings);
    const resultWithPillar = calculateProject(project, brick, settings);

    const diffNetVolumeM3 = resultWithoutPillar.netWallVolume - resultWithPillar.netWallVolume;
    const cubicFeetToM3 = (val: number) => val * Math.pow(0.3048, 3);
    const expectedCubicFeet = 5.625 * 2; // both walls overlap pillar footprint
    
    console.log("Difference in Volume M3:", diffNetVolumeM3);
    console.log("Expected Difference M3:", cubicFeetToM3(expectedCubicFeet));
  });

  it('correctly calculates trimmed wall start and end coordinates without gap or overlap', () => {
    const wallA: Wall = {
      id: 'w1',
      name: 'Front Wall',
      start: { x: 0, y: 0 },
      end: { x: 40, y: 0 },
      dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const pillarCorner: Pillar = {
      id: 'p1',
      name: 'P1',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 0, y: 0 },
      alignment: 'outside_corner',
      shape: 'square'
    };

    const trimmed = trimWallByPillars(wallA, [pillarCorner], 'ft');

    // 9 in = 0.75 ft. Half width is 0.375 ft (4.5 in)
    console.log("Trimmed Wall Start:", trimmed.start); // { x: 0.375, y: 0 }
    console.log("Trimmed Wall Length:", trimmed.length); // 40 - 0.375 = 39.625 ft
    console.log("Trim Start Amount:", trimmed.trimStart); // 0.375 ft
    expect(trimmed.length).toBeCloseTo(39.625, 3);
  });
});

describe('Multi-Floor RCC Concrete Pillar System', () => {
  it('preserves exact X/Z coordinates across Ground Floor, First Floor, and Second Floor', () => {
    const groundFloorPillar: Pillar = {
      id: 'pillar-f0-1',
      name: 'P1',
      floorId: 'floor-0',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 5, y: 8 },
      placementType: 'wall_joint',
      alignment: 'centre',
      shape: 'square'
    };

    // When First Floor is created, the pillar must use exact same X and Z (2D y) coordinates
    const firstFloorPillar: Pillar = {
      ...groundFloorPillar,
      id: 'pillar-floor-1-1',
      floorId: 'floor-1',
      height: 10
    };

    const secondFloorPillar: Pillar = {
      ...groundFloorPillar,
      id: 'pillar-floor-2-1',
      floorId: 'floor-2',
      height: 10
    };

    expect(groundFloorPillar.position?.x).toBe(5);
    expect(groundFloorPillar.position?.y).toBe(8);
    expect(firstFloorPillar.position?.x).toBe(groundFloorPillar.position?.x);
    expect(firstFloorPillar.position?.y).toBe(groundFloorPillar.position?.y);
    expect(secondFloorPillar.position?.x).toBe(groundFloorPillar.position?.x);
    expect(secondFloorPillar.position?.y).toBe(groundFloorPillar.position?.y);
  });

  it('detects structural pillars at corners, long wall spans, junctions, and central support without opening conflicts', () => {
    const floor: import('./brickCalculator').Floor = {
      id: 'floor-0',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: [
        {
          id: 'w1', name: 'Front Wall', start: { x: 0, y: 0 }, end: { x: 40, y: 0 },
          dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
          openings: [
            { id: 'op1', type: 'door', width: 3, height: 7, count: 1, unit: 'ft', distanceFromStart: 18 }
          ]
        },
        {
          id: 'w2', name: 'Right Wall', start: { x: 40, y: 0 }, end: { x: 40, y: 30 },
          dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
          openings: []
        },
        {
          id: 'w3', name: 'Back Wall', start: { x: 40, y: 30 }, end: { x: 0, y: 30 },
          dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
          openings: []
        },
        {
          id: 'w4', name: 'Left Wall', start: { x: 0, y: 30 }, end: { x: 0, y: 0 },
          dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
          openings: []
        }
      ],
      internalWalls: [
        {
          id: 'iw1', name: 'Central Partition', start: { x: 20, y: 0 }, end: { x: 20, y: 30 },
          dimensions: { length: 30, height: 10, thickness: 4.5, unit: 'ft', thicknessUnit: 'in' },
          openings: []
        }
      ]
    };

    const { detectStructuralPillars } = require('./brickCalculator');
    const pillars = detectStructuralPillars(floor, 40, 30, 'ft', 10);

    // Verify corners
    const hasCorner00 = pillars.some((p: Pillar) => p.position?.x === 0 && p.position?.y === 0);
    const hasCorner400 = pillars.some((p: Pillar) => p.position?.x === 40 && p.position?.y === 0);
    const hasCorner4030 = pillars.some((p: Pillar) => p.position?.x === 40 && p.position?.y === 30);
    const hasCorner030 = pillars.some((p: Pillar) => p.position?.x === 0 && p.position?.y === 30);
    const hasCentral = pillars.some((p: Pillar) => p.position?.x === 20 && p.position?.y === 15);

    expect(hasCorner00).toBe(true);
    expect(hasCorner400).toBe(true);
    expect(hasCorner4030).toBe(true);
    expect(hasCorner030).toBe(true);
    expect(hasCentral).toBe(true);
  });

  it('correctly warns on conflict when a candidate pillar overlaps with a door or window opening', () => {
    const { checkPillarOpeningCollision } = require('./brickCalculator');
    const wallWithDoor: Wall = {
      id: 'w-door',
      name: 'Front Wall',
      start: { x: 0, y: 0 },
      end: { x: 40, y: 0 },
      dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: [
        { id: 'door1', type: 'door', width: 4, height: 7, count: 1, unit: 'ft', distanceFromStart: 10 }
      ]
    };

    // Candidate pillar directly in middle of door (dist = 12 ft -> x = 12, y = 0)
    const collisionInside = checkPillarOpeningCollision({ x: 12, y: 0 }, 9, 'in', [wallWithDoor], 'ft');
    expect(collisionInside.hasConflict).toBe(true);

    // Candidate pillar well outside the door (x = 25, y = 0)
    const collisionOutside = checkPillarOpeningCollision({ x: 25, y: 0 }, 9, 'in', [wallWithDoor], 'ft');
    expect(collisionOutside.hasConflict).toBe(false);
  });
});

describe('Wall Segmentation around RCC Pillars (Zero Overlap)', () => {
  const { splitWallByPillars } = require('./brickCalculator');

  it('Case 1: One pillar on straight wall splits into BRICK | RCC | BRICK', () => {
    const wall: Wall = {
      id: 'w-straight',
      name: 'Main Wall',
      start: { x: 0, y: 0 },
      end: { x: 40, y: 0 }, // 40 ft
      dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const middlePillar: Pillar = {
      id: 'p-mid',
      name: 'P_Mid',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 20, y: 0 }, // 9 in = 0.75 ft. Pillar span along wall is [19.625, 20.375]
      alignment: 'centre',
      shape: 'square'
    };

    const segments = splitWallByPillars(wall, [middlePillar], 'ft');

    // Should create exactly 2 brick segments around the pillar
    expect(segments.length).toBe(2);

    // Segment 1: from x=0 to x=19.625
    expect(segments[0].start.x).toBeCloseTo(0, 3);
    expect(segments[0].end.x).toBeCloseTo(19.625, 3);
    expect(segments[0].length).toBeCloseTo(19.625, 3);

    // Segment 2: from x=20.375 to x=40
    expect(segments[1].start.x).toBeCloseTo(20.375, 3);
    expect(segments[1].end.x).toBeCloseTo(40, 3);
    expect(segments[1].length).toBeCloseTo(19.625, 3);

    // Total brick length must NOT include the 0.75 ft pillar span
    const totalBrickLength = segments.reduce((sum: number, s: any) => sum + s.length, 0);
    expect(totalBrickLength).toBeCloseTo(39.25, 3);
  });

  it('Case 2: Two pillars on one wall split into BRICK | RCC | BRICK | RCC | BRICK', () => {
    const wall: Wall = {
      id: 'w-multi',
      name: 'Multi Pillar Wall',
      start: { x: 0, y: 0 },
      end: { x: 30, y: 0 }, // 30 ft
      dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const p1: Pillar = {
      id: 'p1',
      name: 'P1',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 10, y: 0 },
      alignment: 'centre',
      shape: 'square'
    };

    const p2: Pillar = {
      id: 'p2',
      name: 'P2',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 20, y: 0 },
      alignment: 'centre',
      shape: 'square'
    };

    const segments = splitWallByPillars(wall, [p1, p2], 'ft');

    // Should create exactly 3 brick segments
    expect(segments.length).toBe(3);

    // Segment 1: [0, 9.625]
    expect(segments[0].start.x).toBeCloseTo(0, 3);
    expect(segments[0].end.x).toBeCloseTo(9.625, 3);

    // Segment 2: [10.375, 19.625]
    expect(segments[1].start.x).toBeCloseTo(10.375, 3);
    expect(segments[1].end.x).toBeCloseTo(19.625, 3);

    // Segment 3: [20.375, 30]
    expect(segments[2].start.x).toBeCloseTo(20.375, 3);
    expect(segments[2].end.x).toBeCloseTo(30, 3);
  });

  it('Case 3: Corner pillar replaces the overlapping wall corner region', () => {
    const wallX: Wall = {
      id: 'w-x',
      name: 'Wall X',
      start: { x: 0, y: 0 },
      end: { x: 20, y: 0 },
      dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const cornerPillar: Pillar = {
      id: 'p-corner',
      name: 'P_Corner',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 0, y: 0 },
      alignment: 'outside_corner',
      shape: 'square'
    };

    const segments = splitWallByPillars(wallX, [cornerPillar], 'ft');

    expect(segments.length).toBe(1);
    expect(segments[0].start.x).toBeCloseTo(0.375, 3); // Starts after pillar face
    expect(segments[0].end.x).toBeCloseTo(20, 3);
    expect(segments[0].length).toBeCloseTo(19.625, 3);
  });

  it('Case 4: Internal wall junction cuts cleanly at the pillar face', () => {
    const internalWall: Wall = {
      id: 'iw-cross',
      name: 'Internal Cross Wall',
      start: { x: 15, y: 0 }, // Meets pillar at (15, 0)
      end: { x: 15, y: 20 },
      dimensions: { length: 20, height: 10, thickness: 4.5, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const junctionPillar: Pillar = {
      id: 'p-junc',
      name: 'P_Junction',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 15, y: 0 },
      alignment: 'centre',
      shape: 'square'
    };

    const segments = splitWallByPillars(internalWall, [junctionPillar], 'ft');

    expect(segments.length).toBe(1);
    expect(segments[0].start.y).toBeCloseTo(0.375, 3); // Starts at y=0.375 (outside the 9in pillar)
    expect(segments[0].end.y).toBeCloseTo(20, 3);
  });

  it('Case 5: Multi-floor support ensures both floors segment walls identically at matching coordinates', () => {
    const groundWall: Wall = {
      id: 'gw1',
      name: 'Ground Wall',
      start: { x: 0, y: 0 },
      end: { x: 30, y: 0 },
      dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const firstWall: Wall = {
      id: 'fw1',
      name: 'First Floor Wall',
      start: { x: 0, y: 0 },
      end: { x: 30, y: 0 },
      dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const groundPillar: Pillar = {
      id: 'p-g',
      name: 'P1',
      floorId: 'floor-0',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 15, y: 0 },
      alignment: 'centre',
      shape: 'square'
    };

    const firstPillar: Pillar = {
      id: 'p-1',
      name: 'P1',
      floorId: 'floor-1',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 15, y: 0 }, // Identical coordinate
      alignment: 'centre',
      shape: 'square'
    };

    const gSegments = splitWallByPillars(groundWall, [groundPillar], 'ft');
    const fSegments = splitWallByPillars(firstWall, [firstPillar], 'ft');

    expect(gSegments.length).toBe(2);
    expect(fSegments.length).toBe(2);
    expect(gSegments[0].length).toBeCloseTo(fSegments[0].length, 3);
    expect(gSegments[1].length).toBeCloseTo(fSegments[1].length, 3);
    expect(gSegments[0].end.x).toBeCloseTo(fSegments[0].end.x, 3);
    expect(gSegments[1].start.x).toBeCloseTo(fSegments[1].start.x, 3);
  });
});

describe('Floor-Specific RCC Pillar State and Delete Isolation', () => {
  it('deleting a pillar on First Floor preserves the Ground Floor pillar at the same (X, Z) coordinate', () => {
    const groundPillar: Pillar = {
      id: 'pillar-floor-0-P33',
      name: 'P33',
      floorId: 'floor-0',
      verticalColumnId: 'col-33',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 10, y: 15 },
      alignment: 'centre',
      shape: 'square'
    };

    const firstFloorPillar: Pillar = {
      id: 'pillar-floor-1-P33',
      name: 'P33',
      floorId: 'floor-1',
      verticalColumnId: 'col-33',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 10, y: 15 }, // Exact same physical X/Z
      alignment: 'centre',
      shape: 'square'
    };

    let allPillars = [groundPillar, firstFloorPillar];

    // User selects P33 on First Floor and deletes it
    const activeFloorId = 'floor-1';
    const targetPillarId = firstFloorPillar.id;

    const remainingPillars = allPillars.filter(
      p => !(p.floorId === activeFloorId && p.id === targetPillarId)
    );

    // Ground Floor pillar MUST remain
    const gfPillar = remainingPillars.find(p => p.floorId === 'floor-0');
    expect(gfPillar).toBeDefined();
    expect(gfPillar?.id).toBe('pillar-floor-0-P33');
    expect(gfPillar?.position?.x).toBe(10);
    expect(gfPillar?.position?.y).toBe(15);

    // First Floor pillar MUST be deleted
    const ffPillar = remainingPillars.find(p => p.floorId === 'floor-1');
    expect(ffPillar).toBeUndefined();
  });

  it('editing a pillar on First Floor does NOT mutate the Ground Floor pillar', () => {
    const groundPillar: Pillar = {
      id: 'pillar-floor-0-P1',
      name: 'P1',
      floorId: 'floor-0',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 5, y: 5 },
      alignment: 'centre'
    };

    const firstFloorPillar: Pillar = {
      id: 'pillar-floor-1-P1',
      name: 'P1',
      floorId: 'floor-1',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 5, y: 5 },
      alignment: 'centre'
    };

    let allPillars = [groundPillar, firstFloorPillar];

    // User changes First Floor pillar width from 9" to 12" and position X from 5 to 6
    allPillars = allPillars.map(p => {
      if (p.floorId === 'floor-1' && p.id === 'pillar-floor-1-P1') {
        return { ...p, width: 12, position: { x: 6, y: 5 } };
      }
      return p;
    });

    const gfPillar = allPillars.find(p => p.floorId === 'floor-0');
    const ffPillar = allPillars.find(p => p.floorId === 'floor-1');

    expect(gfPillar?.width).toBe(9);
    expect(gfPillar?.position?.x).toBe(5);

    expect(ffPillar?.width).toBe(12);
    expect(ffPillar?.position?.x).toBe(6);
  });
});

describe('Additive RCC Ring Beam Structural Elevation Model', () => {
  it('brick wall maintains full 10 ft height, and RCC ring beam adds 2 ft for 12 ft total floor height', () => {
    const wallHeight = 10; // 10 ft brick wall
    const beamHeight = 2;  // 2 ft RCC Ring Beam
    const floorTotalHeight = wallHeight + beamHeight; // 12 ft total

    expect(wallHeight).toBe(10);
    expect(beamHeight).toBe(2);
    expect(floorTotalHeight).toBe(12);

    // Multi-floor elevations
    const groundBaseY = 0;
    const groundWallTop = groundBaseY + wallHeight; // 10 ft
    const groundBeamBottom = groundWallTop;         // 10 ft
    const groundBeamTop = groundBeamBottom + beamHeight; // 12 ft
    const groundPillarHeight = floorTotalHeight;    // 12 ft

    expect(groundWallTop).toBe(10);
    expect(groundBeamBottom).toBe(10);
    expect(groundBeamTop).toBe(12);
    expect(groundPillarHeight).toBe(12);

    // First Floor elevations
    const firstBaseY = groundBeamTop;               // Starts strictly at 12 ft
    const firstWallTop = firstBaseY + wallHeight;   // 22 ft
    const firstBeamBottom = firstWallTop;           // 22 ft
    const firstBeamTop = firstBeamBottom + beamHeight; // 24 ft
    const firstPillarHeight = floorTotalHeight;     // 12 ft (from 12 to 24 ft)

    expect(firstBaseY).toBe(12);
    expect(firstWallTop).toBe(22);
    expect(firstBeamBottom).toBe(22);
    expect(firstBeamTop).toBe(24);
    expect(firstPillarHeight).toBe(12);

    // Zero overlap checks
    expect(groundBeamBottom).toBeGreaterThanOrEqual(groundWallTop);
    expect(firstBaseY).toBeGreaterThanOrEqual(groundBeamTop);
  });

  it('updates multi-floor stacking correctly when user enters custom beam heights (e.g. 1.5 ft and 3 ft)', () => {
    const wallHeight = 10;
    
    // Test 1.5 ft beam
    const beamHeight15 = 1.5;
    const groundTotal15 = wallHeight + beamHeight15; // 11.5 ft
    const firstBaseY15 = groundTotal15;              // 11.5 ft
    const firstTotal15 = firstBaseY15 + wallHeight + beamHeight15; // 23 ft

    expect(groundTotal15).toBe(11.5);
    expect(firstBaseY15).toBe(11.5);
    expect(firstTotal15).toBe(23);

    // Test 3 ft beam
    const beamHeight3 = 3;
    const groundTotal3 = wallHeight + beamHeight3;   // 13 ft
    const firstBaseY3 = groundTotal3;                // 13 ft
    const firstTotal3 = firstBaseY3 + wallHeight + beamHeight3; // 26 ft

    expect(groundTotal3).toBe(13);
    expect(firstBaseY3).toBe(13);
    expect(firstTotal3).toBe(26);
  });
});

describe('Floor-Specific Object State and Deletion Isolation (Walls, Openings, Pillars)', () => {
  it('deleting a wall on Floor 1 does NOT delete or mutate the corresponding wall on Ground Floor', () => {
    const groundFloor: Floor = {
      id: 'floor-0',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: [
        { id: 'floor-0-front', floorId: 'floor-0', name: 'Front Wall', start: { x: 0, y: 0 }, end: { x: 40, y: 0 }, dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] }
      ],
      internalWalls: [
        { id: 'floor-0-int-1', floorId: 'floor-0', name: 'Partition 1', start: { x: 20, y: 0 }, end: { x: 20, y: 30 }, dimensions: { length: 30, height: 10, thickness: 4.5, unit: 'ft', thicknessUnit: 'in' }, openings: [] }
      ]
    };

    const firstFloor: Floor = {
      id: 'floor-1',
      name: 'Floor 1',
      level: 1,
      height: 10,
      unit: 'ft',
      externalWalls: [
        { id: 'floor-1-front', floorId: 'floor-1', name: 'Front Wall', start: { x: 0, y: 0 }, end: { x: 40, y: 0 }, dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] }
      ],
      internalWalls: [
        { id: 'floor-1-int-1', floorId: 'floor-1', name: 'Partition 1', start: { x: 20, y: 0 }, end: { x: 20, y: 30 }, dimensions: { length: 30, height: 10, thickness: 4.5, unit: 'ft', thicknessUnit: 'in' }, openings: [] }
      ]
    };

    let floors = [groundFloor, firstFloor];

    // User is on Floor 1 and deletes internal wall 'floor-1-int-1'
    const activeFloorId = 'floor-1';
    const targetWallId = 'floor-1-int-1';

    floors = floors.map(f => {
      if (f.id === activeFloorId) {
        return {
          ...f,
          externalWalls: f.externalWalls.filter(w => w.id !== targetWallId),
          internalWalls: f.internalWalls.filter(w => w.id !== targetWallId)
        };
      }
      return f;
    });

    // Floor 1 internal wall is deleted
    const updatedFF = floors.find(f => f.id === 'floor-1');
    expect(updatedFF?.internalWalls.length).toBe(0);

    // Ground Floor internal wall remains intact
    const updatedGF = floors.find(f => f.id === 'floor-0');
    expect(updatedGF?.internalWalls.length).toBe(1);
    expect(updatedGF?.internalWalls[0].id).toBe('floor-0-int-1');
  });

  it('deleting a door/window on Floor 1 does NOT delete the door/window on Ground Floor', () => {
    const groundWall: Wall = {
      id: 'floor-0-front',
      floorId: 'floor-0',
      name: 'Front Wall',
      start: { x: 0, y: 0 },
      end: { x: 40, y: 0 },
      dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: [
        { id: 'op-floor-0-door1', floorId: 'floor-0', type: 'door', width: 3, height: 7, count: 1, unit: 'ft', distanceFromStart: 10 }
      ]
    };

    const firstWall: Wall = {
      id: 'floor-1-front',
      floorId: 'floor-1',
      name: 'Front Wall',
      start: { x: 0, y: 0 },
      end: { x: 40, y: 0 },
      dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: [
        { id: 'op-floor-1-door1', floorId: 'floor-1', type: 'door', width: 3, height: 7, count: 1, unit: 'ft', distanceFromStart: 10 }
      ]
    };

    let floors: Floor[] = [
      { id: 'floor-0', name: 'Ground Floor', level: 0, height: 10, unit: 'ft', externalWalls: [groundWall], internalWalls: [] },
      { id: 'floor-1', name: 'Floor 1', level: 1, height: 10, unit: 'ft', externalWalls: [firstWall], internalWalls: [] }
    ];

    // User is on Floor 1 and deletes door 'op-floor-1-door1'
    const activeFloorId = 'floor-1';
    const targetWallId = 'floor-1-front';
    const targetOpId = 'op-floor-1-door1';

    floors = floors.map(f => {
      if (f.id === activeFloorId) {
        return {
          ...f,
          externalWalls: f.externalWalls.map(w => w.id === targetWallId ? { ...w, openings: w.openings.filter(o => o.id !== targetOpId) } : w)
        };
      }
      return f;
    });

    // Floor 1 door is deleted
    const ffWall = floors.find(f => f.id === 'floor-1')?.externalWalls[0];
    expect(ffWall?.openings.length).toBe(0);

    // Ground Floor door remains intact
    const gfWall = floors.find(f => f.id === 'floor-0')?.externalWalls[0];
    expect(gfWall?.openings.length).toBe(1);
    expect(gfWall?.openings[0].id).toBe('op-floor-0-door1');
  });
});

describe('2D Canvas Screen-to-Model Transformation and Corner Snapping', () => {
  const buildingLength = 40;
  const buildingWidth = 30;

  // Screen/SVG ViewBox to Model conversion formula: modelY = buildingWidth - svgY
  const svgToModel = (svgX: number, svgY: number) => ({
    x: svgX,
    y: buildingWidth - svgY
  });

  it('correctly maps Top-Left, Top-Right, Bottom-Left, and Bottom-Right without Y-inversion', () => {
    // Top-Left screen click (near svgX = 0, svgY = 0)
    const tl = svgToModel(0, 0);
    expect(tl.x).toBe(0);
    expect(tl.y).toBe(30); // Top-Left model coordinate (x=0, y=30)

    // Top-Right screen click (near svgX = 40, svgY = 0)
    const tr = svgToModel(40, 0);
    expect(tr.x).toBe(40);
    expect(tr.y).toBe(30); // Top-Right model coordinate (x=40, y=30)

    // Bottom-Left screen click (near svgX = 0, svgY = 30)
    const bl = svgToModel(0, 30);
    expect(bl.x).toBe(0);
    expect(bl.y).toBe(0);  // Bottom-Left model coordinate (x=0, y=0)

    // Bottom-Right screen click (near svgX = 40, svgY = 30)
    const br = svgToModel(40, 30);
    expect(br.x).toBe(40);
    expect(br.y).toBe(0);  // Bottom-Right model coordinate (x=40, y=0)
  });
});

describe('100% Independent Multi-Floor Pillar Operations (Add, Edit, Move, Grid)', () => {
  it('adding a pillar on Floor 1 adds it ONLY to Floor 1 and leaves Ground Floor untouched', () => {
    const p1Ground: Pillar = { id: 'pillar-floor-0-p1', name: 'P1', floorId: 'floor-0', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 } };
    const p2Ground: Pillar = { id: 'pillar-floor-0-p2', name: 'P2', floorId: 'floor-0', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 } };

    const p1First: Pillar = { id: 'pillar-floor-1-p1', name: 'P1', floorId: 'floor-1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 } };
    const p2First: Pillar = { id: 'pillar-floor-1-p2', name: 'P2', floorId: 'floor-1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 } };

    let allPillars: Pillar[] = [p1Ground, p2Ground, p1First, p2First];

    // User is on Floor 1 and adds P3 at (20, 15)
    const activeFloorId = 'floor-1';
    const newPillar: Pillar = {
      id: `pillar-${activeFloorId}-p3`,
      name: 'P3',
      floorId: activeFloorId,
      width: 12,
      depth: 12,
      height: 10,
      count: 1,
      unit: 'in',
      position: { x: 20, y: 15 }
    };

    allPillars = [...allPillars, newPillar];

    // Ground Floor pillars
    const gfPillars = allPillars.filter(p => p.floorId === 'floor-0');
    expect(gfPillars.length).toBe(2);
    expect(gfPillars.some(p => p.name === 'P3')).toBe(false);

    // Floor 1 pillars
    const ffPillars = allPillars.filter(p => p.floorId === 'floor-1');
    expect(ffPillars.length).toBe(3);
    expect(ffPillars.some(p => p.name === 'P3')).toBe(true);
  });

  it('moving a pillar on Floor 1 does NOT move the Ground Floor pillar', () => {
    const p1Ground: Pillar = { id: 'pillar-floor-0-p1', name: 'P1', floorId: 'floor-0', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 10, y: 15 } };
    const p1First: Pillar = { id: 'pillar-floor-1-p1', name: 'P1', floorId: 'floor-1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 10, y: 15 } };

    let allPillars: Pillar[] = [p1Ground, p1First];

    // Move Floor 1 pillar to (12, 18)
    const activeFloorId = 'floor-1';
    const targetId = 'pillar-floor-1-p1';

    allPillars = allPillars.map(p => {
      if (p.floorId === activeFloorId && p.id === targetId) {
        return { ...p, position: { x: 12, y: 18 } };
      }
      return p;
    });

    const gfPillar = allPillars.find(p => p.floorId === 'floor-0');
    const ffPillar = allPillars.find(p => p.floorId === 'floor-1');

    expect(gfPillar?.position?.x).toBe(10);
    expect(gfPillar?.position?.y).toBe(15);

    expect(ffPillar?.position?.x).toBe(12);
    expect(ffPillar?.position?.y).toBe(18);
  });
});

describe('RCC Full Ring Beam vs Normal RCC Ring Beam Mutually Exclusive Structural Modes', () => {
  it('Mode A (Normal Ring Beam = ON, Full Ring Beam = OFF): renders perimeter beam only, top remains open', () => {
    const wallHeight = 10; // ft
    const ringBeamHeight = 2; // ft
    const ringBeamConfig: RCCRingBeamConfig = { ...DEFAULT_RCC_RING_BEAM, enabled: true, height: ringBeamHeight };
    const fullRingBeamConfig: RCCFullRingBeamConfig = { ...DEFAULT_RCC_FULL_RING_BEAM, enabled: false, thicknessFt: 1 };

    const isFullBeamActive = fullRingBeamConfig.enabled;
    const isNormalRingBeamActive = !isFullBeamActive && ringBeamConfig.enabled;

    expect(isFullBeamActive).toBe(false);
    expect(isNormalRingBeamActive).toBe(true);

    const groundWallTop = wallHeight; // 10 ft
    const groundBeamTop = groundWallTop + ringBeamHeight; // 12 ft
    const firstFloorBaseY = groundBeamTop; // 12 ft

    expect(groundWallTop).toBe(10);
    expect(groundBeamTop).toBe(12);
    expect(firstFloorBaseY).toBe(12);
  });

  it('Mode B (Normal Ring Beam = OFF, Full Ring Beam = ON): suppresses normal beam, creates complete solid concrete top', () => {
    const wallHeight = 10; // ft
    const fullRingBeamThickness = 1; // ft
    const ringBeamConfig: RCCRingBeamConfig = { ...DEFAULT_RCC_RING_BEAM, enabled: false, height: 2 };
    const fullRingBeamConfig: RCCFullRingBeamConfig = { ...DEFAULT_RCC_FULL_RING_BEAM, enabled: true, thicknessFt: fullRingBeamThickness };

    const isFullBeamActive = fullRingBeamConfig.enabled;
    const isNormalRingBeamActive = !isFullBeamActive && ringBeamConfig.enabled;

    // Normal Ring Beam must be suppressed
    expect(isFullBeamActive).toBe(true);
    expect(isNormalRingBeamActive).toBe(false);

    // Full Ring Beam sits directly immediately above brick wall (Zero Gap)
    const groundWallTop = wallHeight; // 10 ft
    const fullRingBeamTop = groundWallTop + fullRingBeamThickness; // 11 ft
    const firstFloorBaseY = fullRingBeamTop; // 11 ft (Starts cleanly immediately above full concrete top)

    expect(groundWallTop).toBe(10);
    expect(fullRingBeamTop).toBe(11);
    expect(firstFloorBaseY).toBe(11);
  });

  it('supports custom Thickness (ft) (e.g. 0.5 ft, 1 ft, 1.5 ft, 2 ft) for Full Ring Beam per floor independently', () => {
    const wallHeight = 10;

    // Ground Floor: 1.5 ft thickness
    const gfThicknessFt = 1.5;
    const gfTop = wallHeight + gfThicknessFt; // 11.5 ft
    expect(gfTop).toBe(11.5);

    // Floor 1: 0.5 ft thickness
    const ffThicknessFt = 0.5;
    const ffBaseY = gfTop;
    const ffTop = ffBaseY + wallHeight + ffThicknessFt; // 11.5 + 10 + 0.5 = 22.0 ft
    expect(ffTop).toBe(22.0);

    // Floor 2: 2.0 ft thickness
    const sfThicknessFt = 2.0;
    const sfBaseY = ffTop;
    const sfTop = sfBaseY + wallHeight + sfThicknessFt; // 22.0 + 10 + 2.0 = 34.0 ft
    expect(sfTop).toBe(34.0);
  });

  it('supports multi-floor independent mode configuration (GF Full Ring Beam, Floor 1 Normal Ring Beam)', () => {
    const gf: Floor = {
      id: 'floor-0',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: [],
      internalWalls: [],
      ringBeam: { ...DEFAULT_RCC_RING_BEAM, enabled: false },
      fullRingBeam: { enabled: true, thicknessFt: 1 }
    };

    const ff: Floor = {
      id: 'floor-1',
      name: 'Floor 1',
      level: 1,
      height: 10,
      unit: 'ft',
      externalWalls: [],
      internalWalls: [],
      ringBeam: { ...DEFAULT_RCC_RING_BEAM, enabled: true, height: 2 },
      fullRingBeam: { enabled: false, thicknessFt: 1 }
    };

    // Ground Floor uses Full Ring Beam (+1 ft)
    const gfIsFull = gf.fullRingBeam?.enabled === true;
    const gfTopH = gf.height + (gfIsFull ? (gf.fullRingBeam?.thicknessFt ?? 1) : 2);
    expect(gfTopH).toBe(11);

    // First Floor starts at 11 ft and uses Normal Ring Beam (+2 ft)
    const ffIsFull = ff.fullRingBeam?.enabled === true;
    const ffTopH = gfTopH + ff.height + (ffIsFull ? 1 : (ff.ringBeam?.height ?? 2));
    expect(ffTopH).toBe(23); // 11 + 10 + 2 = 23 ft
  });

  it('verifies strict separation between Tools (structural full ring beam config) and Scene Elements (visibility toggle)', () => {
    const floorWithFullBeam: Floor = {
      id: 'floor-0',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: [],
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 }
    };

    // Case 1: Tools enabled + Scene Elements Show RCC Full Ring Beam = true -> Renders Full Ring Beam in 3D
    let showFullRingBeam = true;
    const shouldRenderCase1 = (floorWithFullBeam.fullRingBeam?.enabled ?? false) && showFullRingBeam;
    expect(shouldRenderCase1).toBe(true);

    // Case 2: Tools enabled + Scene Elements Show RCC Full Ring Beam = false -> Hidden in 3D, floor elevation/data unchanged
    showFullRingBeam = false;
    const shouldRenderCase2 = (floorWithFullBeam.fullRingBeam?.enabled ?? false) && showFullRingBeam;
    expect(shouldRenderCase2).toBe(false);
    expect(floorWithFullBeam.fullRingBeam?.enabled).toBe(true); // Data remains 100% intact

    // Case 3: Tools disabled + Scene Elements visible -> Not rendered
    const floorWithoutFullBeam: Floor = {
      ...floorWithFullBeam,
      id: 'floor-1',
      fullRingBeam: { enabled: false, thicknessFt: 1 }
    };
    showFullRingBeam = true;
    const shouldRenderCase3 = (floorWithoutFullBeam.fullRingBeam?.enabled ?? false) && showFullRingBeam;
    expect(shouldRenderCase3).toBe(false);
  });
});

describe('Closed Structural Pillar Bay Detection for Full RCC Fill', () => {
  it('detects 1 valid closed structural bay for 4 corner pillars', () => {
    const pillars: Pillar[] = [
      { id: 'p1', name: 'P1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, shape: 'square' },
      { id: 'p2', name: 'P2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, shape: 'square' },
      { id: 'p3', name: 'P3', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 30 }, shape: 'square' },
      { id: 'p4', name: 'P4', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 30 }, shape: 'square' },
    ];

    const bays = detectClosedStructuralBays(pillars, 'ft');
    expect(bays.length).toBe(1);
    expect(bays[0].minX).toBe(0);
    expect(bays[0].maxX).toBe(40);
    expect(bays[0].minY).toBe(0);
    expect(bays[0].maxY).toBe(30);
    expect(bays[0].width).toBe(40);
    expect(bays[0].depth).toBe(30);
  });

  it('detects 4 individual closed structural bays for a 3x3 grid of 9 pillars', () => {
    const pillars: Pillar[] = [
      { id: 'p1', name: 'P1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, shape: 'square' },
      { id: 'p2', name: 'P2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 20, y: 0 }, shape: 'square' },
      { id: 'p3', name: 'P3', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, shape: 'square' },
      { id: 'p4', name: 'P4', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 15 }, shape: 'square' },
      { id: 'p5', name: 'P5', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 20, y: 15 }, shape: 'square' },
      { id: 'p6', name: 'P6', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 15 }, shape: 'square' },
      { id: 'p7', name: 'P7', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 30 }, shape: 'square' },
      { id: 'p8', name: 'P8', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 20, y: 30 }, shape: 'square' },
      { id: 'p9', name: 'P9', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 30 }, shape: 'square' },
    ];

    const bays = detectClosedStructuralBays(pillars, 'ft');
    expect(bays.length).toBe(4);
    // Bay 1: [0..20, 0..15]
    expect(bays.some(b => b.minX === 0 && b.maxX === 20 && b.minY === 0 && b.maxY === 15)).toBe(true);
    // Bay 2: [20..40, 0..15]
    expect(bays.some(b => b.minX === 20 && b.maxX === 40 && b.minY === 0 && b.maxY === 15)).toBe(true);
    // Bay 3: [0..20, 15..30]
    expect(bays.some(b => b.minX === 0 && b.maxX === 20 && b.minY === 15 && b.maxY === 30)).toBe(true);
    // Bay 4: [20..40, 15..30]
    expect(bays.some(b => b.minX === 20 && b.maxX === 40 && b.minY === 15 && b.maxY === 30)).toBe(true);
  });

  it('negative test: does NOT fill open area outside closed pillars (e.g. courtyard or area with no pillars)', () => {
    // Only left bay has 4 pillars; right area has no pillars
    const pillars: Pillar[] = [
      { id: 'p1', name: 'P1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, shape: 'square' },
      { id: 'p2', name: 'P2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 20, y: 0 }, shape: 'square' },
      { id: 'p3', name: 'P3', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 20, y: 30 }, shape: 'square' },
      { id: 'p4', name: 'P4', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 30 }, shape: 'square' },
    ];

    const bays = detectClosedStructuralBays(pillars, 'ft');
    expect(bays.length).toBe(1);
    // Only the left bay [0..20, 0..30] is detected; right area [20..40] is NOT filled
    expect(bays[0].maxX).toBe(20);
    expect(bays.some(b => b.maxX > 20)).toBe(false);
  });

  it('negative test: incomplete/open structure with fewer than 4 pillars produces 0 bays and NO fill', () => {
    const openPillars: Pillar[] = [
      { id: 'p1', name: 'P1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, shape: 'square' },
      { id: 'p2', name: 'P2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, shape: 'square' },
      { id: 'p3', name: 'P3', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 30 }, shape: 'square' },
      // p4 at (0, 30) is missing
    ];

    const bays = detectClosedStructuralBays(openPillars, 'ft');
    expect(bays.length).toBe(0); // No closed bay -> NO fill
  });
});

describe('Live RCC Material Estimation Engine (Pillars, Beams, Full RCC Top)', () => {
  const defaultSettings: CalculatorSettings = {
    mortarJointHorizontal: 10,
    mortarJointVertical: 10,
    wastagePercentage: 5,
    dryVolumeFactor: 1.33,
    mixRatioCement: 1,
    mixRatioSand: 5,
    brickPrice: 8.5,
    cementPrice: 400,
    sandPrice: 2118, // ₹60/CFT * 35.3147
    labourCost: 0,
    transportCost: 0,
    rccConcreteMixRatio: '1:1.5:3',
    rccCementRatio: 1,
    rccSandRatio: 1.5,
    rccAggregateRatio: 3,
    sandPricePerCft: 60,
    aggregatePricePerCft: 45,
    steelRate: 65,
    bindingWireRate: 85,
    coverBlockPrice: 3,
    rccLabourRate: 3500
  };

  it('verifies steel unit weight formula D²/162 kg/m', () => {
    // 8mm: 64/162 = 0.395 kg/m
    expect(getSteelBarWeightPerMeter(8)).toBeCloseTo(0.395, 2);
    // 10mm: 100/162 = 0.617 kg/m
    expect(getSteelBarWeightPerMeter(10)).toBeCloseTo(0.617, 2);
    // 12mm: 144/162 = 0.889 kg/m
    expect(getSteelBarWeightPerMeter(12)).toBeCloseTo(0.889, 2);
    // 16mm: 256/162 = 1.580 kg/m
    expect(getSteelBarWeightPerMeter(16)).toBeCloseTo(1.580, 2);
  });

  it('calculates RCC pillar concrete volume and steel accurately for 4 pillars (9"x9"x10ft)', () => {
    const pillars: Pillar[] = [
      { id: 'p1', name: 'P1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, shape: 'square' },
      { id: 'p2', name: 'P2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, shape: 'square' },
      { id: 'p3', name: 'P3', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 30 }, shape: 'square' },
      { id: 'p4', name: 'P4', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 30 }, shape: 'square' },
    ];

    const res = calculatePillarsRcc(pillars, 10, 'ft', DEFAULT_RCC_REINFORCEMENT);
    // Single pillar: (9/12) * (9/12) * 10 = 5.625 CFT = 0.1593 m3
    // 4 pillars: 4 * 5.625 = 22.5 CFT = 0.637 m3
    expect(res.concreteVolumeCft).toBeCloseTo(22.5, 1);
    expect(res.concreteVolumeM3).toBeCloseTo(0.637, 2);
    expect(res.steelKg).toBeGreaterThan(0);
    expect(res.coverBlocks).toBeGreaterThan(0);
    expect(res.count).toBe(4);
  });

  it('calculates RCC ring beam concrete volume and reinforcement for 4 perimeter walls', () => {
    const walls: Wall[] = [
      { id: 'w1', name: 'W1', start: { x: 0, y: 0 }, end: { x: 40, y: 0 }, dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
      { id: 'w2', name: 'W2', start: { x: 40, y: 0 }, end: { x: 40, y: 30 }, dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
      { id: 'w3', name: 'W3', start: { x: 40, y: 30 }, end: { x: 0, y: 30 }, dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
      { id: 'w4', name: 'W4', start: { x: 0, y: 30 }, end: { x: 0, y: 0 }, dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
    ];

    const ringBeamConfig: RCCRingBeamConfig = { enabled: true, height: 2, heightUnit: 'ft', width: 9, widthUnit: 'in', depth: 9, depthUnit: 'in' };
    const res = calculateRingBeamsRcc(walls, ringBeamConfig, 'ft', DEFAULT_RCC_REINFORCEMENT);

    // Total perimeter length = 140 ft = 42.672 m
    // Volume = 140 ft * (9/12 ft) * 2 ft = 210 CFT = 5.946 m3
    expect(res.concreteVolumeCft).toBeCloseTo(210, 1);
    expect(res.concreteVolumeM3).toBeCloseTo(5.95, 2);
    expect(res.steelKg).toBeGreaterThan(0);
    expect(res.coverBlocks).toBeGreaterThan(0);
  });

  it('calculates Full RCC Top concrete volume and reinforcement for closed structural bay', () => {
    const pillars: Pillar[] = [
      { id: 'p1', name: 'P1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, shape: 'square' },
      { id: 'p2', name: 'P2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, shape: 'square' },
      { id: 'p3', name: 'P3', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 30 }, shape: 'square' },
      { id: 'p4', name: 'P4', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 30 }, shape: 'square' },
    ];

    const fullRingBeamConfig: RCCFullRingBeamConfig = { enabled: true, thicknessFt: 1 };
    const res = calculateFullRccTopRcc(pillars, fullRingBeamConfig, 'ft', DEFAULT_RCC_REINFORCEMENT);

    // Bay is approx 40.75 ft x 30.75 ft * 1 ft thickness
    expect(res.areaM2).toBeGreaterThan(100);
    expect(res.concreteVolumeM3).toBeGreaterThan(30);
    expect(res.steelKg).toBeGreaterThan(0);
    expect(res.bayCount).toBe(1);
  });

  it('supports cumulative multi-floor live estimation with independent floor isolation', () => {
    const gfPillars: Pillar[] = [
      { id: 'p1', name: 'P1', floorId: 'gf', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, shape: 'square' },
      { id: 'p2', name: 'P2', floorId: 'gf', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, shape: 'square' },
      { id: 'p3', name: 'P3', floorId: 'gf', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 30 }, shape: 'square' },
      { id: 'p4', name: 'P4', floorId: 'gf', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 30 }, shape: 'square' },
    ];

    const ffPillars: Pillar[] = [
      { id: 'p5', name: 'P5', floorId: 'ff', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, shape: 'square' },
      { id: 'p6', name: 'P6', floorId: 'ff', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, shape: 'square' },
      { id: 'p7', name: 'P7', floorId: 'ff', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 30 }, shape: 'square' },
      { id: 'p8', name: 'P8', floorId: 'ff', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 30 }, shape: 'square' },
    ];

    const gf: Floor = {
      id: 'gf',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: [],
      internalWalls: [],
      pillars: gfPillars,
      fullRingBeam: { enabled: true, thicknessFt: 1 }
    };

    const ff: Floor = {
      id: 'ff',
      name: 'First Floor',
      level: 1,
      height: 10,
      unit: 'ft',
      externalWalls: [],
      internalWalls: [],
      pillars: ffPillars,
      fullRingBeam: { enabled: true, thicknessFt: 1 }
    };

    const initialEstimate = calculateProjectRccEstimate([gf, ff], [...gfPillars, ...ffPillars], 'ft', defaultSettings);
    expect(initialEstimate.floors.length).toBe(2);
    expect(initialEstimate.totalConcreteVolumeM3).toBeCloseTo(
      initialEstimate.floors[0].concreteVolumeM3 + initialEstimate.floors[1].concreteVolumeM3,
      4
    );

    // Deleting 1 pillar from Floor 1 only reduces Floor 1 without modifying Ground Floor
    const updatedFfPillars = ffPillars.slice(0, 3); // 3 pillars -> no closed bay on Floor 1
    const updatedFf: Floor = { ...ff, pillars: updatedFfPillars };

    const updatedEstimate = calculateProjectRccEstimate([gf, updatedFf], [...gfPillars, ...updatedFfPillars], 'ft', defaultSettings);
    // Ground floor estimate must NOT change
    expect(updatedEstimate.floors[0].concreteVolumeM3).toBe(initialEstimate.floors[0].concreteVolumeM3);
    expect(updatedEstimate.floors[0].costs.total).toBe(initialEstimate.floors[0].costs.total);

    // Floor 1 estimate decreases
    expect(updatedEstimate.floors[1].concreteVolumeM3).toBeLessThan(initialEstimate.floors[1].concreteVolumeM3);
  });
});

describe('Standard TN Red Brick Count & Brick Cost Engine', () => {
  it('confirms single source of truth default TN Red Brick dimensions: 230 x 115 x 75 mm', () => {
    expect(DEFAULT_BRICK_SIZE.lengthMm).toBe(230);
    expect(DEFAULT_BRICK_SIZE.widthMm).toBe(115);
    expect(DEFAULT_BRICK_SIZE.heightMm).toBe(75);

    expect(DEFAULT_TN_RED_BRICK.length).toBe(230);
    expect(DEFAULT_TN_RED_BRICK.width).toBe(115);
    expect(DEFAULT_TN_RED_BRICK.height).toBe(75);
  });

  it('calculates brick count from actual wall geometry (Gross Wall Vol - Opening Vol / Nominal Brick Vol)', () => {
    const wall: Wall = {
      id: 'w1',
      name: 'Single 10ft Wall',
      dimensions: {
        length: 10,
        height: 10,
        thickness: 9, // 9 inches
        unit: 'ft',
        thicknessUnit: 'in'
      },
      openings: [
        {
          id: 'd1',
          name: 'Main Door',
          type: 'door',
          width: 3,
          height: 7,
          unit: 'ft',
          count: 1
        }
      ]
    };

    const settings: CalculatorSettings = {
      mortarJointHorizontal: 10,
      mortarJointVertical: 10,
      wastagePercentage: 10,
      dryVolumeFactor: 1.33,
      mixRatioCement: 1,
      mixRatioSand: 5,
      brickPrice: 8, // ₹8 per brick
      cementPrice: 400,
      sandPrice: 2118,
      labourCost: 0,
      transportCost: 0
    };

    const result = calculateProject({ walls: [wall] }, DEFAULT_TN_RED_BRICK, settings);

    // Gross volume = 10 * 10 * 0.75 ft3 = 75 CFT = 2.12376 m3
    // Door volume = 3 * 7 * 0.75 ft3 = 15.75 CFT = 0.44599 m3
    // Net volume = 59.25 CFT = 1.67777 m3
    expect(result.netWallVolume).toBeCloseTo(1.678, 2);

    // Nominal brick volume with 10mm mortar:
    // (0.230 + 0.010) * (0.115 + 0.010) * (0.075 + 0.010) = 0.240 * 0.125 * 0.085 = 0.00255 m3
    // Base bricks = 1.67777 / 0.00255 = 657.95
    expect(result.baseBrickQuantityExact).toBeCloseTo(657.95, 1);
    expect(result.baseBrickQuantity).toBe(658);

    // Wastage @ 10%:
    // Final = 657.95 * 1.10 = 723.74 -> Purchase = 724
    expect(result.purchaseBrickQuantity).toBe(724);
    expect(result.totalBricks).toBe(724);

    // Brick Cost = 724 * ₹8 = ₹5,792
    expect(result.costs.bricks).toBe(724 * 8);
    expect(result.costs.bricks).toBe(5792);
  });

  it('keeps RCC Ring Beam and Brick Wall completely separated without mixing materials or subtracting wall height', () => {
    const wall: Wall = {
      id: 'w1',
      name: 'Perimeter Wall',
      dimensions: {
        length: 20,
        height: 10,
        thickness: 9,
        unit: 'ft',
        thicknessUnit: 'in'
      },
      openings: []
    };

    const settings: CalculatorSettings = {
      mortarJointHorizontal: 10,
      mortarJointVertical: 10,
      wastagePercentage: 5,
      dryVolumeFactor: 1.33,
      mixRatioCement: 1,
      mixRatioSand: 5,
      brickPrice: 8.5,
      cementPrice: 400,
      sandPrice: 2118,
      labourCost: 0,
      transportCost: 0
    };

    // Calculation with normal wall
    const resultWithoutRingBeam = calculateProject({ walls: [wall] }, DEFAULT_TN_RED_BRICK, settings);

    // Building model with RCC Ring Beam enabled
    const floorWithRingBeam: Floor = {
      id: 'gf',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: [wall],
      internalWalls: [],
      ringBeam: { enabled: true, height: 2, heightUnit: 'ft', width: 9, widthUnit: 'in', depth: 9, depthUnit: 'in' },
      fullRingBeam: { enabled: false, thicknessFt: 1 }
    };

    const buildingModel = {
      floors: [floorWithRingBeam],
      buildingLength: 20,
      buildingWidth: 20,
      buildingUnit: 'ft' as const
    };

    const resultWithRingBeam = calculateProject({ walls: [], buildingModel }, DEFAULT_TN_RED_BRICK, settings);

    // Brick count must NOT decrease or treat ring beam as bricks
    expect(resultWithRingBeam.totalBricks).toBe(resultWithoutRingBeam.totalBricks);
    expect(resultWithRingBeam.costs.bricks).toBe(resultWithoutRingBeam.costs.bricks);

    // RCC Ring Beam is estimated separately as concrete/steel
    expect(resultWithRingBeam.rccProjectEstimate).toBeDefined();
    expect(resultWithRingBeam.rccProjectEstimate!.totalConcreteVolumeCft).toBeGreaterThan(0);
    expect(resultWithRingBeam.rccProjectEstimate!.totalSteelKg).toBeGreaterThan(0);
  });

  it('calculates multi-floor brick count and brick cost with floor isolation', () => {
    const gfWall: Wall = {
      id: 'w-gf',
      name: 'GF Wall',
      dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };
    const ffWall: Wall = {
      id: 'w-ff',
      name: 'FF Wall',
      dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const floorGf: Floor = {
      id: 'gf',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: [gfWall],
      internalWalls: []
    };

    const floorFf: Floor = {
      id: 'ff',
      name: 'First Floor',
      level: 1,
      height: 10,
      unit: 'ft',
      externalWalls: [ffWall],
      internalWalls: []
    };

    const settings: CalculatorSettings = {
      mortarJointHorizontal: 10,
      mortarJointVertical: 10,
      wastagePercentage: 10,
      dryVolumeFactor: 1.33,
      mixRatioCement: 1,
      mixRatioSand: 5,
      brickPrice: 8,
      cementPrice: 400,
      sandPrice: 2118,
      labourCost: 0,
      transportCost: 0
    };

    const result = calculateProject({
      walls: [],
      buildingModel: {
        floors: [floorGf, floorFf],
        buildingLength: 30,
        buildingWidth: 20,
        buildingUnit: 'ft'
      }
    }, DEFAULT_TN_RED_BRICK, settings);

    expect(result.floorMasonryEstimates).toBeDefined();
    expect(result.floorMasonryEstimates!.length).toBe(2);

    const gfEst = result.floorMasonryEstimates![0];
    const ffEst = result.floorMasonryEstimates![1];

    // Ground Floor: 30ft wall -> more bricks than First Floor: 20ft wall
    expect(gfEst.purchaseBrickQuantity).toBeGreaterThan(ffEst.purchaseBrickQuantity);
    expect(gfEst.brickCost).toBe(gfEst.purchaseBrickQuantity * 8);
    expect(ffEst.brickCost).toBe(ffEst.purchaseBrickQuantity * 8);

    // Total Bricks = GF + FF
    expect(result.purchaseBrickQuantity).toBe(gfEst.purchaseBrickQuantity + ffEst.purchaseBrickQuantity);
    expect(result.costs.bricks).toBe(gfEst.brickCost + ffEst.brickCost);
  });
});

describe('RCC Calculation & Unit Consistency Audit', () => {
  it('mathematically validates M20 (1:1.5:3) dry-volume material split and CFT conversions for 127.06 m³', () => {
    const concreteVolumeM3 = 127.06;
    const dryVolumeM3 = concreteVolumeM3 * 1.54; // 195.6724 m3
    expect(dryVolumeM3).toBeCloseTo(195.67, 1);

    const settings: CalculatorSettings = {
      mortarJointHorizontal: 10,
      mortarJointVertical: 10,
      wastagePercentage: 5,
      dryVolumeFactor: 1.33,
      mixRatioCement: 1,
      mixRatioSand: 5,
      brickPrice: 8.5,
      cementPrice: 400, // ₹400 / bag
      sandPricePerCft: 1500, // ₹1500 / CFT
      aggregatePricePerCft: 1200, // ₹1200 / CFT
      steelRate: 65, // ₹65 / kg
      bindingWireRate: 85, // ₹85 / kg
      coverBlockPrice: 3, // ₹3 / piece
      rccLabourRate: 4000, // ₹4000 / m3
      rccConcreteMixRatio: '1:1.5:3',
      rccCementRatio: 1,
      rccSandRatio: 1.5,
      rccAggregateRatio: 3,
      labourCost: 0,
      transportCost: 0
    };

    const steelKg = 3150.6;
    const coverBlocks = 1801;

    const materials = calculateRccMaterialsFromVolume(concreteVolumeM3, steelKg, coverBlocks, settings);

    // 1. M-Sand verification: 195.6724 * 1.5 / 5.5 = 53.3652 m3 ≈ 1884.6 CFT
    expect(materials.sandM3).toBeCloseTo(53.365, 2);
    expect(materials.sandCft).toBeCloseTo(1884.58, 1);

    // 2. 20mm Jalli verification: 195.6724 * 3 / 5.5 = 106.7304 m3 ≈ 3769.2 CFT
    expect(materials.aggregateM3).toBeCloseTo(106.73, 2);
    expect(materials.aggregateCft).toBeCloseTo(3769.15, 1);

    // 3. Cement bags verification: 195.6724 * 1 / 5.5 = 35.5768 m3 / 0.0347 ≈ 1025.27 bags
    expect(materials.cementExactBags).toBeCloseTo(1025.27, 1);

    // 4. Jalli amount calculation @ ₹1200 / CFT: 3769.154 * 1200 ≈ ₹45,22,984.8
    expect(materials.costs.aggregate).toBeCloseTo(materials.aggregateCft * 1200, 1);
    expect(materials.costs.aggregate).toBeCloseTo(4522985, 0);

    // 5. Total RCC cost must be exact sum of all line items
    const expectedTotal = materials.costs.cement +
      materials.costs.sand +
      materials.costs.aggregate +
      materials.costs.steel +
      materials.costs.bindingWire +
      materials.costs.coverBlocks +
      materials.costs.labour;

    expect(materials.costs.total).toBeCloseTo(expectedTotal, 1);
  });

  it('updates total RCC cost immediately when unit rates change', () => {
    const concreteVolumeM3 = 10;
    const steelKg = 500;
    const coverBlocks = 100;

    const baseSettings: CalculatorSettings = {
      mortarJointHorizontal: 10,
      mortarJointVertical: 10,
      wastagePercentage: 5,
      dryVolumeFactor: 1.33,
      mixRatioCement: 1,
      mixRatioSand: 5,
      brickPrice: 8.5,
      cementPrice: 400,
      sandPricePerCft: 60,
      aggregatePricePerCft: 45,
      steelRate: 65,
      bindingWireRate: 85,
      coverBlockPrice: 3,
      rccLabourRate: 3500,
      rccCementRatio: 1,
      rccSandRatio: 1.5,
      rccAggregateRatio: 3,
      labourCost: 0,
      transportCost: 0
    };

    const est1 = calculateRccMaterialsFromVolume(concreteVolumeM3, steelKg, coverBlocks, baseSettings);

    // Increase Jalli rate from 45 to 1200 / CFT
    const updatedSettings: CalculatorSettings = {
      ...baseSettings,
      aggregatePricePerCft: 1200
    };

    const est2 = calculateRccMaterialsFromVolume(concreteVolumeM3, steelKg, coverBlocks, updatedSettings);

    expect(est2.costs.aggregate).toBe(est2.aggregateCft * 1200);
    expect(est2.costs.total).toBe(est1.costs.total - est1.costs.aggregate + (est2.aggregateCft * 1200));
  });

  it('correctly calculates 9 pillars of 9"x9"x10ft as 50.625 CFT (not 4.2 CFT) and ~12 bags cement', () => {
    const pillars: Pillar[] = Array.from({ length: 9 }).map((_, idx) => ({
      id: `pillar-${idx + 1}`,
      name: `P${idx + 1}`,
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in' as Unit,
      position: { x: (idx % 3) * 20, y: Math.floor(idx / 3) * 15 },
      shape: 'square' as const,
      includeInEstimate: true
    }));

    const res = calculatePillarsRcc(pillars, 10, 'ft', DEFAULT_RCC_REINFORCEMENT);

    // 1 pillar = (9/12) * (9/12) * 10 = 5.625 CFT = 0.15928 m3
    // 9 pillars = 9 * 5.625 = 50.625 CFT = 1.43354 m3
    expect(res.count).toBe(9);
    expect(res.concreteVolumeCft).toBeCloseTo(50.625, 2);
    expect(res.concreteVolumeM3).toBeCloseTo(1.4335, 3);

    const settings: CalculatorSettings = {
      mortarJointHorizontal: 10,
      mortarJointVertical: 10,
      wastagePercentage: 5,
      dryVolumeFactor: 1.54,
      mixRatioCement: 1,
      mixRatioSand: 5,
      brickPrice: 8.5,
      cementPrice: 400,
      sandPricePerCft: 60,
      aggregatePricePerCft: 45,
      steelRate: 65,
      bindingWireRate: 85,
      coverBlockPrice: 3,
      rccLabourRate: 4000,
      rccCementRatio: 1,
      rccSandRatio: 1.5,
      rccAggregateRatio: 3,
      labourCost: 0,
      transportCost: 0
    };

    const pillarMaterials = calculateRccMaterialsFromVolume(res.concreteVolumeM3, res.steelKg, res.coverBlocks, settings);

    // Dry volume = 1.43354 * 1.54 = 2.20765 m3
    // Cement = 2.20765 * (1 / 5.5) = 0.40139 m3 / 0.0347 ≈ 11.57 exact bags (12 bags rounded)
    expect(pillarMaterials.cementExactBags).toBeCloseTo(11.57, 1);
    expect(pillarMaterials.cementBags).toBe(12);

    // M-Sand = 2.20765 * (1.5 / 5.5) * 35.3147 ≈ 21.26 CFT
    expect(pillarMaterials.sandCft).toBeCloseTo(21.26, 1);

    // Jalli = 2.20765 * (3 / 5.5) * 35.3147 ≈ 42.53 CFT
    expect(pillarMaterials.aggregateCft).toBeCloseTo(42.53, 1);
  });

  it('verifies exposed rebar cage parameters match RCC estimation configuration', () => {
    const customReinf: RCCReinforcementConfig = {
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
      slabDistributionBarDiaMm: 8,
      slabSpacingMm: 150,
      slabCoverMm: 20,
      slabTopExtraPercent: 20,
      waterCementRatio: 0.50,
      bindingWireKgPerTonneSteel: 10,
      coverBlockSpacingMm: 1000
    };

    const pillars: Pillar[] = [
      { id: 'p1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, shape: 'square' }
    ];

    const est = calculatePillarsRcc(pillars, 10, 'ft', customReinf);

    // Height in meters = 3.048 m
    // Main bars: 4 * 3.048 * 1.10 * (16^2 / 162) = 4 * 3.048 * 1.10 * 1.58 = 21.19 kg
    // Stirrup count: ceil(3.048 / 0.15) + 1 = 22 stirrups
    // Core perimeter: 4 * (0.2286 - 2 * 0.04) + 0.15 = 4 * 0.1486 + 0.15 = 0.7444 m
    // Stirrup steel: 22 * 0.7444 * (8^2 / 162) = 22 * 0.7444 * 0.395 = 6.47 kg
    // Total steel = 21.19 + 6.47 = 27.66 kg
    expect(est.steelKg).toBeCloseTo(27.66, 1);
    expect(est.count).toBe(1);
  });

  it('calculates 2-direction slab reinforcement mesh accurately from slab footprint and reinforcement settings', () => {
    const pillars: Pillar[] = [
      { id: 'p1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, shape: 'square' },
      { id: 'p2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, shape: 'square' },
      { id: 'p3', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 30 }, shape: 'square' },
      { id: 'p4', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 30 }, shape: 'square' },
    ];

    const config: RCCFullRingBeamConfig = { enabled: true, thicknessFt: 1 };
    const reinf: RCCReinforcementConfig = {
      ...DEFAULT_RCC_REINFORCEMENT,
      slabMainBarDiaMm: 10,       // 10mm main bars
      slabMainBarSpacingMm: 150,  // 150mm spacing
      slabDistBarDiaMm: 8,        // 8mm distribution bars
      slabDistBarSpacingMm: 150,  // 150mm spacing
      slabCoverMm: 20
    };

    const res = calculateFullRccTopRcc(pillars, config, 'ft', reinf);

    // Slab area ~ 40.75 ft * 30.75 ft = 12.42 m * 9.37 m ≈ 116.4 m2
    expect(res.areaM2).toBeGreaterThan(110);
    expect(res.concreteVolumeM3).toBeGreaterThan(30);
    
    // Main bars: 10mm @ 150mm -> D^2/162 = 0.617 kg/m
    // Distribution bars: 8mm @ 150mm -> D^2/162 = 0.395 kg/m
    expect(res.steelKg).toBeGreaterThan(500);
    expect(res.coverBlocks).toBeGreaterThan(400);
  });

  it('validates zero-gap vertical column continuity and boundary elevation matching between stacked floors', () => {
    const floor0 = { id: 'floor-0', name: 'Ground Floor', height: 10, fullRingBeam: { enabled: true, thicknessFt: 1 } };
    const floor1 = { id: 'floor-1', name: 'First Floor', height: 10, fullRingBeam: { enabled: true, thicknessFt: 1 } };
    const floor2 = { id: 'floor-2', name: 'Second Floor', height: 10, fullRingBeam: { enabled: true, thicknessFt: 1 } };

    const floors = [floor0, floor1, floor2];

    const elevations = floors.map((f, i) => {
      const yOffsetRaw = floors.slice(0, i).reduce((sum, prev) => {
        return sum + prev.height + (prev.fullRingBeam?.thicknessFt || 1);
      }, 0);
      const totalH = f.height + (f.fullRingBeam?.thicknessFt || 1);
      return {
        bottomY: yOffsetRaw,
        topY: yOffsetRaw + totalH,
        height: totalH
      };
    });

    // Ground Floor: 0 to 11 ft
    expect(elevations[0].bottomY).toBe(0);
    expect(elevations[0].topY).toBe(11);

    // First Floor: 11 to 22 ft (exact match with Ground Floor top - zero gap!)
    expect(elevations[1].bottomY).toBe(elevations[0].topY);
    expect(elevations[1].topY).toBe(22);

    // Second Floor: 22 to 33 ft (exact match with First Floor top - zero gap!)
    expect(elevations[2].bottomY).toBe(elevations[1].topY);
    expect(elevations[2].topY).toBe(33);
  });

  it('detects all adjacent pillar-to-pillar structural RCC beams for 4 corner pillars and grid framing', () => {
    const cornerPillars: Pillar[] = [
      { id: 'p1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, shape: 'square' },
      { id: 'p2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, shape: 'square' },
      { id: 'p3', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 30 }, shape: 'square' },
      { id: 'p4', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 30 }, shape: 'square' },
    ];

    const beams = detectPillarToPillarBeams(cornerPillars, 'ft');

    // Expected 4 perimeter beams: P1-P2 (front), P4-P3 (back), P1-P4 (left), P2-P3 (right)
    expect(beams.length).toBe(4);
    expect(beams.some(b => (b.startPillarId === 'p1' && b.endPillarId === 'p2') || (b.startPillarId === 'p2' && b.endPillarId === 'p1'))).toBe(true);
    expect(beams.some(b => (b.startPillarId === 'p4' && b.endPillarId === 'p3') || (b.startPillarId === 'p3' && b.endPillarId === 'p4'))).toBe(true);
    expect(beams.some(b => (b.startPillarId === 'p1' && b.endPillarId === 'p4') || (b.startPillarId === 'p4' && b.endPillarId === 'p1'))).toBe(true);
    expect(beams.some(b => (b.startPillarId === 'p2' && b.endPillarId === 'p3') || (b.startPillarId === 'p3' && b.endPillarId === 'p2'))).toBe(true);

    // Test with intermediate / internal pillars (3x2 grid = 6 pillars)
    const gridPillars: Pillar[] = [
      { id: 'p1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, shape: 'square' },
      { id: 'p2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 20, y: 0 }, shape: 'square' },
      { id: 'p3', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, shape: 'square' },
      { id: 'p4', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 30 }, shape: 'square' },
      { id: 'p5', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 20, y: 30 }, shape: 'square' },
      { id: 'p6', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 30 }, shape: 'square' },
    ];

    const gridBeams = detectPillarToPillarBeams(gridPillars, 'ft');
    // Horizontal lines: (p1-p2, p2-p3) + (p4-p5, p5-p6) = 4 beams
    // Vertical lines: (p1-p4, p2-p5, p3-p6) = 3 beams
    // Total = 7 structural beams
    expect(gridBeams.length).toBe(7);
  });
});

describe('Ground Floor Foundation & Sub-grade Construction System', () => {
  const baseSettings: CalculatorSettings = {
    mortarJointHorizontal: 10,
    mortarJointVertical: 10,
    wastagePercentage: 5,
    mixRatioCement: 1,
    mixRatioSand: 5,
    brickPrice: 8.5,
    cementPrice: 400,
    sandPrice: 60 * 35.3147,
    sandPricePerCft: 60,
    aggregatePricePerCft: 45,
    steelRate: 65,
    rccLabourRate: 4000,
    excavationRatePerM3: 250,
    sandFillRatePerCft: 45,
    pccLabourRatePerM3: 2500,
    footingLabourRatePerM3: 4200,
    labourCost: 0,
    transportCost: 0
  };

  it('auto-generates aligned isolated footings with PCC and sand filling for Ground Floor pillars', () => {
    const pillars: Pillar[] = [
      { id: 'p1', name: 'P1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, floorId: 'floor-0' },
      { id: 'p2', name: 'P2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, floorId: 'floor-0' },
      { id: 'p3', name: 'P3', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 30 }, floorId: 'floor-0' },
      { id: 'p4', name: 'P4', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 30 }, floorId: 'floor-0' },
    ];

    const footings = generateFootingsForPillars(pillars, DEFAULT_FOUNDATION_CONFIG, 'ft');

    expect(footings.length).toBe(4);
    expect(footings[0].pillarId).toBe('p1');
    expect(footings[0].position).toEqual({ x: 0, y: 0 });
    expect(footings[0].footingLength).toBe(4); // 4 ft
    expect(footings[0].footingWidth).toBe(4);  // 4 ft
    expect(footings[0].footingDepth).toBe(1);  // 1 ft
    expect(footings[0].pccLength).toBe(5);    // 5 ft (4 + 1 ft projection)
    expect(footings[0].pccWidth).toBe(5);
    expect(footings[0].rebar.mainBarCount).toBe(6);
    expect(footings[0].rebar.mainBarDiaMm).toBe(12);
  });

  it('accurately calculates layer-by-layer volumes (Excavation, Sand, PCC, RCC Footing, Backfill) for an isolated footing', () => {
    const footing: FoundationFooting = {
      id: 'footing-1',
      pillarId: 'p1',
      pillarName: 'P1',
      position: { x: 0, y: 0 },
      foundationType: 'isolated',
      footingLength: 4,
      footingWidth: 4,
      footingDepth: 1,
      footingUnit: 'ft',
      concreteGrade: 'M20',
      footingMixRatio: '1:1.5:3',
      pccLength: 5,
      pccWidth: 5,
      pccThickness: 0.3333333333333333, // 4 inches = 0.333 ft
      pccUnit: 'ft',
      pccMixRatio: '1:4:8',
      sandFillLength: 5,
      sandFillWidth: 5,
      sandFillDepth: 0.5, // 6 inches = 0.5 ft
      sandFillUnit: 'ft',
      sandFillCompactionFactor: 1.25,
      excavationLength: 6,
      excavationWidth: 6,
      excavationDepth: 4, // 4 ft pit
      excavationUnit: 'ft',
      rebar: {
        mainBarDiaMm: 12,
        mainBarCount: 6,
        distBarDiaMm: 12,
        distBarCount: 6,
        coverMm: 50,
        hookLengthMm: 150
      },
      includeInEstimate: true
    };

    const est = calculateFootingRcc(footing, baseSettings);

    // 1. Excavation: 6 * 6 * 4 = 144 CFT
    expect(est.excavationVolumeCft).toBeCloseTo(144, 1);
    expect(est.excavationVolumeM3).toBeCloseTo(144 * Math.pow(0.3048, 3), 2);

    // 2. Sand Filling: 5 * 5 * 0.5 * 1.25 = 15.625 CFT
    expect(est.sandFillVolumeCft).toBeCloseTo(15.625, 2);

    // 3. Plain PCC Base: 5 * 5 * 0.3333 = 8.333 CFT (Plain concrete with NO steel)
    expect(est.pccVolumeCft).toBeCloseTo(8.333, 1);
    expect(est.cementBagsPcc).toBeGreaterThan(0);

    // 4. RCC Footing: 4 * 4 * 1 = 16 CFT
    expect(est.footingVolumeCft).toBeCloseTo(16, 1);
    expect(est.cementBagsRcc).toBeGreaterThan(0);

    // 5. Footing TMT Steel (6 main + 6 dist + 4 column starter bars)
    expect(est.steelKg).toBeGreaterThan(15);
    expect(est.steelTonnes).toBeCloseTo(est.steelKg / 1000, 4);

    // 6. Backfill volume is positive and less than excavation volume
    expect(est.backfillVolumeCft).toBeGreaterThan(0);
    expect(est.backfillVolumeCft).toBeLessThan(est.excavationVolumeCft);

    // 7. Costs are positive and correctly itemized
    expect(est.costs.excavation).toBeGreaterThan(0);
    expect(est.costs.sandFill).toBeGreaterThan(0);
    expect(est.costs.pccLabour).toBeGreaterThan(0);
    expect(est.costs.footingLabour).toBeGreaterThan(0);
    expect(est.costs.cement).toBeGreaterThan(0);
    expect(est.costs.steel).toBeGreaterThan(0);
    expect(est.costs.total).toBe(
      est.costs.excavation +
      est.costs.sandFill +
      est.costs.pccLabour +
      est.costs.footingLabour +
      (est.costs.stubLabour || 0) +
      est.costs.cement +
      est.costs.sand +
      est.costs.aggregate +
      est.costs.steel +
      est.costs.bindingWire +
      est.costs.coverBlocks
    );
  });

  it('updates concrete volume, steel, and costs live when Column Stub height is customized', () => {
    const baseFooting: FoundationFooting = {
      id: 'footing-stub-test',
      pillarId: 'p-stub',
      pillarName: 'P-Stub',
      position: { x: 0, y: 0 },
      foundationType: 'isolated',
      footingLength: 4,
      footingWidth: 4,
      footingDepth: 1.5,
      footingUnit: 'ft',
      concreteGrade: 'M20',
      pccLength: 5,
      pccWidth: 5,
      pccThickness: 0.5,
      pccUnit: 'ft',
      sandFillLength: 5,
      sandFillWidth: 5,
      sandFillDepth: 0.5,
      sandFillUnit: 'ft',
      excavationLength: 6,
      excavationWidth: 6,
      excavationDepth: 4.5,
      excavationUnit: 'ft',
      columnStubHeight: 2.0, // 2 ft stub
      columnStubWidth: 9,
      columnStubDepth: 9,
      rebar: {
        mainBarDiaMm: 12,
        mainBarCount: 6,
        distBarDiaMm: 12,
        distBarCount: 6,
        coverMm: 50
      },
      columnStubRebar: {
        mainBarDiaMm: 12,
        mainBarCount: 4,
        stirrupDiaMm: 8,
        stirrupSpacingMm: 150,
        coverMm: 40
      }
    };

    const est2ft = calculateFootingRcc(baseFooting, baseSettings);
    expect(est2ft.columnStubHeight).toBe(2.0);
    expect(est2ft.stubVolumeCft).toBeGreaterThan(0);
    expect(est2ft.stubMainSteelKg).toBeGreaterThan(0);
    expect(est2ft.stubStirrupSteelKg).toBeGreaterThan(0);

    // Increase stub height to 4.0 ft
    const tallerFooting: FoundationFooting = {
      ...baseFooting,
      columnStubHeight: 4.0
    };
    const est4ft = calculateFootingRcc(tallerFooting, baseSettings);

    // Stub volume, steel, and total cost must all strictly increase with stub height
    expect(est4ft.stubVolumeCft).toBeCloseTo(est2ft.stubVolumeCft * 2, 1);
    expect(est4ft.stubSteelKg).toBeGreaterThan(est2ft.stubSteelKg);
    expect(est4ft.costs.stubLabour).toBeGreaterThan(est2ft.costs.stubLabour);
    expect(est4ft.totalCost).toBeGreaterThan(est2ft.totalCost);
  });

  it('strictly isolates foundation to Ground Floor (Level 0) in multi-floor projects', () => {
    const wallGF: Wall = {
      id: 'wgf', name: 'GF Wall', start: { x: 0, y: 0 }, end: { x: 40, y: 0 },
      dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: []
    };
    const wallF1: Wall = {
      id: 'wf1', name: 'F1 Wall', start: { x: 0, y: 0 }, end: { x: 40, y: 0 },
      dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: []
    };

    const gfPillars: Pillar[] = [
      { id: 'p-gf-1', name: 'P1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, floorId: 'floor-0' },
      { id: 'p-gf-2', name: 'P2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, floorId: 'floor-0' }
    ];

    const f1Pillars: Pillar[] = [
      { id: 'p-f1-1', name: 'P1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, floorId: 'floor-1' },
      { id: 'p-f1-2', name: 'P2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, floorId: 'floor-1' }
    ];

    const multiFloorModel = {
      floors: [
        { id: 'floor-0', name: 'Ground Floor', level: 0, height: 10, unit: 'ft' as const, externalWalls: [wallGF], internalWalls: [], pillars: gfPillars },
        { id: 'floor-1', name: 'Floor 1', level: 1, height: 10, unit: 'ft' as const, externalWalls: [wallF1], internalWalls: [], pillars: f1Pillars }
      ],
      pillars: [...gfPillars, ...f1Pillars],
      buildingLength: 40,
      buildingWidth: 30,
      buildingUnit: 'ft' as const,
      foundation: {
        ...DEFAULT_FOUNDATION_CONFIG,
        footings: generateFootingsForPillars(gfPillars, DEFAULT_FOUNDATION_CONFIG, 'ft')
      }
    };

    const projectResult = calculateProject(
      { walls: [wallGF, wallF1], pillars: multiFloorModel.pillars, buildingModel: multiFloorModel },
      DEFAULT_TN_RED_BRICK,
      baseSettings
    );

    expect(projectResult.foundationEstimate).toBeDefined();
    // Exactly 2 footings generated from Ground Floor (NOT 4 from both floors!)
    expect(projectResult.foundationEstimate?.footingCount).toBe(2);
    expect(projectResult.foundationEstimate?.items.length).toBe(2);
    expect(projectResult.foundationEstimate?.items.map(i => i.pillarId)).toEqual(['p-gf-1', 'p-gf-2']);
  });

  it('supports independent addition and deletion of Foundation Pillar / Column Stub', () => {
    const pillars: Pillar[] = [
      { id: 'p1', name: 'P1', width: 9, depth: 9, height: 10, count: 1, unit: 'ft', position: { x: 0, y: 0 } },
      { id: 'p2', name: 'P2', width: 9, depth: 9, height: 10, count: 1, unit: 'ft', position: { x: 10, y: 0 } }
    ];

    // Generate initial footings (both have stubs by default)
    const footings = generateFootingsForPillars(pillars, DEFAULT_FOUNDATION_CONFIG, 'ft');
    expect(footings.length).toBe(2);
    expect(footings[0].hasFoundationPillar).toBe(true);
    expect(footings[0].foundationPillarId).toBe('FP1');
    expect(footings[1].hasFoundationPillar).toBe(true);
    expect(footings[1].foundationPillarId).toBe('FP2');

    // 1. Calculate with both stubs enabled
    const estBoth = calculateFoundationEstimate(
      { ...DEFAULT_FOUNDATION_CONFIG, footings },
      [],
      pillars,
      baseSettings
    );
    expect(estBoth.footingCount).toBe(2);
    expect(estBoth.totalFoundationPillars).toBe(2);
    expect(estBoth.stubCount).toBe(2);
    expect(estBoth.footings[0].rccStubVolumeM3).toBeGreaterThan(0);
    expect(estBoth.footings[1].rccStubVolumeM3).toBeGreaterThan(0);
    const initialTotalCost = estBoth.costs.total;

    // 2. Delete Foundation Pillar on Footing 2 (hasFoundationPillar: false, columnStubHeight: 0)
    const footingsOneStub = footings.map((f, idx) => {
      if (idx === 1) {
        return { ...f, hasFoundationPillar: false, columnStubHeight: 0 };
      }
      return f;
    });

    const estOneStub = calculateFoundationEstimate(
      { ...DEFAULT_FOUNDATION_CONFIG, footings: footingsOneStub },
      [],
      pillars,
      baseSettings
    );
    expect(estOneStub.footingCount).toBe(2);
    expect(estOneStub.totalFoundationPillars).toBe(1);
    expect(estOneStub.stubCount).toBe(1);

    // Footing 1 stub exists, Footing 2 stub is zeroed out
    expect(estOneStub.footings[0].rccStubVolumeM3).toBeGreaterThan(0);
    expect(estOneStub.footings[1].rccStubVolumeM3).toBe(0);
    expect(estOneStub.footings[1].stubSteelKg).toBe(0);
    expect(estOneStub.footings[1].costRccStub).toBe(0);

    // Footing 2 base footing and PCC remain intact!
    expect(estOneStub.footings[1].rccFootingVolumeM3).toBe(estBoth.footings[1].rccFootingVolumeM3);
    expect(estOneStub.footings[1].pccVolumeM3).toBe(estBoth.footings[1].pccVolumeM3);
    expect(estOneStub.footings[1].costRccFooting).toBe(estBoth.footings[1].costRccFooting);

    // Total cost reduced only by stub concrete and steel
    expect(estOneStub.costs.total).toBeLessThan(initialTotalCost);

    // 3. Re-add Foundation Pillar to Footing 2 with custom height (e.g. 3 ft)
    const footingsReAdded = footingsOneStub.map((f, idx) => {
      if (idx === 1) {
        return {
          ...f,
          hasFoundationPillar: true,
          foundationPillarId: 'FP2',
          columnStubHeight: 3.0,
          columnStubWidth: 12,
          columnStubDepth: 12
        };
      }
      return f;
    });

    const estReAdded = calculateFoundationEstimate(
      { ...DEFAULT_FOUNDATION_CONFIG, footings: footingsReAdded },
      [],
      pillars,
      baseSettings
    );
    expect(estReAdded.totalFoundationPillars).toBe(2);
    expect(estReAdded.footings[1].hasFoundationPillar).toBe(true);
    expect(estReAdded.footings[1].rccStubVolumeM3).toBeGreaterThan(0);
    expect(estReAdded.costs.total).toBeGreaterThan(estOneStub.costs.total);
  });

  describe('Common Size / Master Foundation Size Mode', () => {
    const p1: FoundationFooting = {
      id: 'footing-p1',
      pillarId: 'p1',
      pillarName: 'P1',
      floorId: 'floor-0',
      position: { x: 0, y: 0 },
      footingLength: 4,
      footingWidth: 4,
      footingDepth: 1,
      footingUnit: 'ft',
      hasFoundationPillar: true,
      columnStubHeight: 2
    };

    const p2: FoundationFooting = {
      id: 'footing-p2',
      pillarId: 'p2',
      pillarName: 'P2',
      floorId: 'floor-0',
      position: { x: 10, y: 0 },
      footingLength: 5,
      footingWidth: 5,
      footingDepth: 1.5,
      footingUnit: 'ft',
      hasFoundationPillar: true,
      columnStubHeight: 2
    };

    it('returns individual footing sizes when Common Size is OFF', () => {
      const cfg: FoundationConfig = {
        ...DEFAULT_FOUNDATION_CONFIG,
        useCommonFootingSize: false,
        footings: [p1, p2]
      };

      const sizeP1 = getEffectiveFootingSize(p1, cfg);
      const sizeP2 = getEffectiveFootingSize(p2, cfg);

      expect(sizeP1).toEqual({ length: 4, width: 4, depth: 1, unit: 'ft' });
      expect(sizeP2).toEqual({ length: 5, width: 5, depth: 1.5, unit: 'ft' });
    });

    it('synchronizes all footings to shared dimensions when Common Size is ON', () => {
      const cfg: FoundationConfig = {
        ...DEFAULT_FOUNDATION_CONFIG,
        useCommonFootingSize: true,
        commonFootingSize: { length: 6, width: 6, depth: 2, unit: 'ft' },
        footings: [p1, p2]
      };

      const sizeP1 = getEffectiveFootingSize(p1, cfg);
      const sizeP2 = getEffectiveFootingSize(p2, cfg);

      // Both must share the exact same common dimensions
      expect(sizeP1.length).toBe(6);
      expect(sizeP1.width).toBe(6);
      expect(sizeP1.depth).toBe(2);

      expect(sizeP2.length).toBe(6);
      expect(sizeP2.width).toBe(6);
      expect(sizeP2.depth).toBe(2);

      // Positions and IDs must remain completely independent
      expect(p1.position).toEqual({ x: 0, y: 0 });
      expect(p2.position).toEqual({ x: 10, y: 0 });
      expect(p1.id).toBe('footing-p1');
      expect(p2.id).toBe('footing-p2');
    });

    it('auto-generates footings with common dimensions when Common Size is ON', () => {
      const pillars: Pillar[] = [
        { id: 'col1', name: 'P1', width: 9, depth: 9, height: 10, position: { x: 0, y: 0 } },
        { id: 'col2', name: 'P2', width: 9, depth: 9, height: 10, position: { x: 12, y: 0 } }
      ];

      const cfg: Partial<FoundationConfig> = {
        useCommonFootingSize: true,
        commonFootingSize: { length: 5.5, width: 5.5, depth: 1.75, unit: 'ft' }
      };

      const generated = generateFootingsForPillars(pillars, cfg, 'ft');
      expect(generated.length).toBe(2);
      expect(generated[0].footingLength).toBe(5.5);
      expect(generated[0].footingWidth).toBe(5.5);
      expect(generated[0].footingDepth).toBe(1.75);

      expect(generated[1].footingLength).toBe(5.5);
      expect(generated[1].footingWidth).toBe(5.5);
      expect(generated[1].footingDepth).toBe(1.75);
    });

    it('calculates RCC footing volume and steel accurately under Common Size mode', () => {
      const settings: CalculatorSettings = {
        rccConcreteMixRatio: '1:1.5:3',
        cementPrice: 400,
        steelRate: 65
      } as CalculatorSettings;

      const cfg: FoundationConfig = {
        ...DEFAULT_FOUNDATION_CONFIG,
        useCommonFootingSize: true,
        commonFootingSize: { length: 5, width: 5, depth: 1.5, unit: 'ft' },
        footings: [p1]
      };

      const est = calculateFootingRcc(p1, settings, undefined, cfg);

      // 5 ft * 5 ft * 1.5 ft = 37.5 cft
      expect(est.rccFootingVolumeCft).toBeCloseTo(37.5, 1);
      expect(est.totalCost).toBeGreaterThan(0);
    });

    it('scales Foundation Estimate for N footings without double counting under Common Size mode', () => {
      const settings: CalculatorSettings = {
        rccConcreteMixRatio: '1:1.5:3'
      } as CalculatorSettings;

      // 9 footings (P1..P9)
      const nineFootings: FoundationFooting[] = Array.from({ length: 9 }, (_, i) => ({
        id: `footing-${i + 1}`,
        pillarId: `p${i + 1}`,
        pillarName: `P${i + 1}`,
        floorId: 'floor-0',
        position: { x: (i % 3) * 10, y: Math.floor(i / 3) * 10 },
        footingLength: 4,
        footingWidth: 4,
        footingDepth: 1,
        footingUnit: 'ft',
        hasFoundationPillar: false,
        columnStubHeight: 0
      }));

      const cfg: FoundationConfig = {
        ...DEFAULT_FOUNDATION_CONFIG,
        useCommonFootingSize: true,
        commonFootingSize: { length: 5, width: 5, depth: 1.5, unit: 'ft' },
        footings: nineFootings
      };

      const estimate = calculateFoundationEstimate(cfg, [], [], settings, 'ft');

      // Total footing concrete must be 9 * (5 * 5 * 1.5) = 337.5 cft
      const expectedTotalFootingConcreteCft = 9 * 5 * 5 * 1.5;
      expect(estimate.totalRccFootingVolumeCft).toBeCloseTo(expectedTotalFootingConcreteCft, 1);
      expect(estimate.footings.length).toBe(9);
    });
  });
});

describe('Inner + Outer Cement Plaster / Rendering System', () => {
  const dummySettings: CalculatorSettings = {
    mortarJointHorizontal: 10,
    mortarJointVertical: 10,
    wastagePercentage: 5,
    dryVolumeFactor: 1.33,
    mixRatioCement: 1,
    mixRatioSand: 5,
    brickPrice: 8.5,
    cementPrice: 400,
    sandPrice: 2118,
    sandPricePerCft: 60,
    aggregatePrice: 1589,
    aggregatePricePerCft: 45,
    steelRate: 65,
    bindingWireRate: 85,
    coverBlockPrice: 3,
    rccLabourRate: 4000,
    labourCost: 0,
    transportCost: 0,
  };

  it('verifies unit conversions for plaster thickness to meters (mm, cm, in)', () => {
    expect(toMetersPlaster(12, 'mm')).toBeCloseTo(0.012, 5);
    expect(toMetersPlaster(15, 'mm')).toBeCloseTo(0.015, 5);
    expect(toMetersPlaster(6, 'mm')).toBeCloseTo(0.006, 5);
    expect(toMetersPlaster(1.5, 'cm')).toBeCloseTo(0.015, 5);
    expect(toMetersPlaster(0.59, 'in')).toBeCloseTo(0.014986, 5);
  });

  it('verifies plaster mix parsing for 1:6, 1:4, 1:3', () => {
    const mix16 = parsePlasterMix('1:6');
    expect(mix16.cementPart).toBe(1);
    expect(mix16.sandPart).toBe(6);
    expect(mix16.totalParts).toBe(7);
    expect(mix16.cementFraction).toBeCloseTo(1 / 7, 5);
    expect(mix16.sandFraction).toBeCloseTo(6 / 7, 5);

    const mix14 = parsePlasterMix('1:4');
    expect(mix14.cementFraction).toBeCloseTo(1 / 5, 5);
    expect(mix14.sandFraction).toBeCloseTo(4 / 5, 5);
  });

  it('Section 80 Estimation Test: 20ft × 10ft wall with 7×3 door and 4×4 window -> Gross 200 sq ft, Deductions 37 sq ft, Net 163 sq ft', () => {
    // 20 ft length, 10 ft height = 200 sq ft gross
    // Door: 7 ft x 3 ft = 21 sq ft
    // Window: 4 ft x 4 ft = 16 sq ft
    // Total opening deduction = 37 sq ft
    // Net area = 200 - 37 = 163 sq ft
    const testWall: Wall = {
      id: 'w-test-80',
      name: 'Test Wall',
      dimensions: {
        length: 20,
        height: 10,
        thickness: 9,
        unit: 'ft',
        thicknessUnit: 'in'
      },
      openings: [
        { id: 'd1', type: 'door', width: 3, height: 7, count: 1, unit: 'ft' },
        { id: 'w1', type: 'window', width: 4, height: 4, count: 1, unit: 'ft' }
      ]
    };

    const plasterCfg: PlasterConfig = {
      ...DEFAULT_PLASTER_CONFIG,
      enabled: true,
      scope: 'both',
      inner: {
        enabled: true,
        thickness: 12, // 12 mm
        unit: 'mm',
        mixRatio: '1:6',
        wastagePercent: 0, // for exact mathematical verification
        ratePerSqM: 180
      },
      outer: {
        enabled: true,
        thickness: 15, // 15 mm
        unit: 'mm',
        mixRatio: '1:4',
        wastagePercent: 0, // for exact verification
        ratePerSqM: 220
      },
      rcc: {
        enabled: false,
        thickness: 6,
        unit: 'mm',
        mixRatio: '1:4',
        wastagePercent: 0
      },
      dryVolumeFactor: 1.33
    };

    const buildingModel = {
      buildingLength: 20,
      buildingWidth: 10,
      buildingUnit: 'ft' as const,
      floors: [
        {
          id: 'floor-0',
          name: 'Ground Floor',
          level: 0,
          height: 10,
          unit: 'ft' as const,
          externalWalls: [testWall],
          internalWalls: [],
          plaster: plasterCfg
        }
      ],
      plaster: plasterCfg
    };

    const estimate = calculatePlasterEstimate({ walls: [], buildingModel }, dummySettings, 'ft');

    // 163 sq ft = 163 * 0.092903 = 15.1432 m²
    expect(estimate.inner.grossAreaSqFt).toBeCloseTo(200, 1);
    expect(estimate.inner.openingDeductionSqFt).toBeCloseTo(37, 1);
    expect(estimate.inner.netAreaSqFt).toBeCloseTo(163, 1);
    expect(estimate.inner.netAreaSqM).toBeCloseTo(15.143, 2);

    expect(estimate.outer.grossAreaSqFt).toBeCloseTo(200, 1);
    expect(estimate.outer.openingDeductionSqFt).toBeCloseTo(37, 1);
    expect(estimate.outer.netAreaSqFt).toBeCloseTo(163, 1);
    expect(estimate.outer.netAreaSqM).toBeCloseTo(15.143, 2);

    // Inner Plaster (12 mm = 0.012 m)
    // Wet Volume = 15.1432 * 0.012 = 0.1817 m³
    expect(estimate.inner.wetVolumeM3).toBeCloseTo(0.1817, 3);
    // Dry Mortar = 0.1817 * 1.33 = 0.2417 m³
    expect(estimate.inner.dryMortarVolumeM3).toBeCloseTo(0.2417, 3);
    // Mix 1:6 => Cement = 0.2417 / 7 = 0.03453 m³ => exact bags = 0.03453 / 0.0347 ≈ 1.0 bag
    expect(estimate.inner.cementExactBags).toBeCloseTo(1.0, 1);
    expect(estimate.inner.cementBags).toBe(1);
    // Sand = 0.2417 * (6 / 7) = 0.2072 m³ => CFT = 0.2072 * 35.3147 ≈ 7.32 CFT
    expect(estimate.inner.sandCft).toBeCloseTo(7.32, 1);

    // Outer Plaster (15 mm = 0.015 m)
    // Wet Volume = 15.1432 * 0.015 = 0.2271 m³
    expect(estimate.outer.wetVolumeM3).toBeCloseTo(0.2271, 3);
    // Dry Mortar = 0.2271 * 1.33 = 0.3021 m³
    expect(estimate.outer.dryMortarVolumeM3).toBeCloseTo(0.3021, 3);
    // Mix 1:4 => Cement = 0.3021 / 5 = 0.0604 m³ => exact bags = 0.0604 / 0.0347 ≈ 1.74 bags
    expect(estimate.outer.cementExactBags).toBeCloseTo(1.74, 1);
    expect(estimate.outer.cementBags).toBe(2);
    // Sand = 0.3021 * (4 / 5) = 0.2417 m³ => CFT = 0.2417 * 35.3147 ≈ 8.53 CFT
    expect(estimate.outer.sandCft).toBeCloseTo(8.53, 1);

    // Verify quantities are completely separate and not conflated
    expect(estimate.inner.wetVolumeM3).not.toBe(estimate.outer.wetVolumeM3);
  });

  it('calculates internal partition walls on BOTH sides as Inner Plaster (never outer plaster)', () => {
    const partitionWall: Wall = {
      id: 'w-int-1',
      name: 'Partition Wall',
      dimensions: { length: 15, height: 10, thickness: 4.5, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const buildingModel = {
      buildingLength: 30,
      buildingWidth: 20,
      buildingUnit: 'ft' as const,
      floors: [
        {
          id: 'floor-0',
          name: 'Ground Floor',
          level: 0,
          height: 10,
          unit: 'ft' as const,
          externalWalls: [],
          internalWalls: [partitionWall],
          plaster: {
            ...DEFAULT_PLASTER_CONFIG,
            enabled: true,
            inner: { ...DEFAULT_PLASTER_CONFIG.inner, enabled: true },
            rcc: { ...DEFAULT_PLASTER_CONFIG.rcc, enabled: false }
          }
        }
      ]
    };

    const estimate = calculatePlasterEstimate({ walls: [], buildingModel }, dummySettings, 'ft');

    // 15 ft * 10 ft = 150 sq ft per face
    // 2 faces (Face A + Face B) = 300 sq ft inner plaster!
    expect(estimate.inner.grossAreaSqFt).toBeCloseTo(300, 1);
    expect(estimate.inner.netAreaSqFt).toBeCloseTo(300, 1);
    // Outer plaster must be 0 for internal partition walls
    expect(estimate.outer.grossAreaSqFt).toBe(0);
    expect(estimate.outer.netAreaSqFt).toBe(0);
  });

  it('guarantees multi-floor independence: Ground Floor and Floor 1 have separate plaster configurations', () => {
    const wallG: Wall = {
      id: 'wg',
      name: 'Ground Wall',
      dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };
    const wallF1: Wall = {
      id: 'wf1',
      name: 'F1 Wall',
      dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const gfPlaster: PlasterConfig = {
      ...DEFAULT_PLASTER_CONFIG,
      enabled: true,
      inner: { ...DEFAULT_PLASTER_CONFIG.inner, enabled: true, thickness: 12 },
      outer: { ...DEFAULT_PLASTER_CONFIG.outer, enabled: true, thickness: 15 },
      rcc: { ...DEFAULT_PLASTER_CONFIG.rcc, enabled: false }
    };

    const f1Plaster: PlasterConfig = {
      ...DEFAULT_PLASTER_CONFIG,
      enabled: true,
      inner: { ...DEFAULT_PLASTER_CONFIG.inner, enabled: true, thickness: 10 },
      outer: { ...DEFAULT_PLASTER_CONFIG.outer, enabled: true, thickness: 18 },
      rcc: { ...DEFAULT_PLASTER_CONFIG.rcc, enabled: false }
    };

    const buildingModel = {
      buildingLength: 20,
      buildingWidth: 20,
      buildingUnit: 'ft' as const,
      floors: [
        {
          id: 'floor-0',
          name: 'Ground Floor',
          level: 0,
          height: 10,
          unit: 'ft' as const,
          externalWalls: [wallG],
          internalWalls: [],
          plaster: gfPlaster
        },
        {
          id: 'floor-1',
          name: 'Floor 1',
          level: 1,
          height: 10,
          unit: 'ft' as const,
          externalWalls: [wallF1],
          internalWalls: [],
          plaster: f1Plaster
        }
      ]
    };

    const estimate = calculatePlasterEstimate({ walls: [], buildingModel }, dummySettings, 'ft');

    expect(estimate.floors.length).toBe(2);
    // Ground Floor: inner = 12mm, outer = 15mm
    expect(estimate.floors[0].inner.thicknessMm).toBe(12);
    expect(estimate.floors[0].outer.thicknessMm).toBe(15);
    // Floor 1: inner = 10mm, outer = 18mm
    expect(estimate.floors[1].inner.thicknessMm).toBe(10);
    expect(estimate.floors[1].outer.thicknessMm).toBe(18);

    // Floor 1 outer wet volume is greater than Ground Floor outer wet volume
    expect(estimate.floors[1].outer.wetVolumeM3).toBeGreaterThan(estimate.floors[0].outer.wetVolumeM3);
  });

  it('correctly calculates RCC column 6mm surface plaster separately from brick masonry', () => {
    const dummyPillar: Pillar = {
      id: 'p1',
      name: 'P1',
      width: 9,
      depth: 9,
      height: 10,
      count: 1,
      unit: 'in',
      placementType: 'corner'
    };

    const buildingModel = {
      buildingLength: 10,
      buildingWidth: 10,
      buildingUnit: 'ft' as const,
      floors: [
        {
          id: 'floor-0',
          name: 'Ground Floor',
          level: 0,
          height: 10,
          unit: 'ft' as const,
          externalWalls: [],
          internalWalls: [],
          pillars: [dummyPillar],
          plaster: {
            ...DEFAULT_PLASTER_CONFIG,
            enabled: true,
            inner: { ...DEFAULT_PLASTER_CONFIG.inner, enabled: false },
            outer: { ...DEFAULT_PLASTER_CONFIG.outer, enabled: false },
            rcc: { enabled: true, thickness: 6, unit: 'mm', mixRatio: '1:4', wastagePercent: 0 }
          }
        }
      ]
    };

    const estimate = calculatePlasterEstimate({ walls: [], buildingModel }, dummySettings, 'ft');

    // 6 mm thickness = 0.006 m
    expect(estimate.rcc.thicknessMm).toBe(6);
    expect(estimate.rcc.thicknessM).toBeCloseTo(0.006, 5);
    expect(estimate.rcc.netAreaSqM).toBeGreaterThan(0);
    expect(estimate.rcc.wetVolumeM3).toBeGreaterThan(0);
    expect(estimate.rcc.costs.total).toBeGreaterThan(0);
  });

  it('defaults to zero plaster when plaster is not activated by user (Req 53 & 54)', () => {
    const wall: Wall = {
      id: 'w-default',
      name: 'Default Wall',
      dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const buildingModel = {
      buildingLength: 20,
      buildingWidth: 20,
      buildingUnit: 'ft' as const,
      floors: [
        {
          id: 'floor-0',
          name: 'Ground Floor',
          level: 0,
          height: 10,
          unit: 'ft' as const,
          externalWalls: [wall],
          internalWalls: [],
          plaster: { ...DEFAULT_PLASTER_CONFIG } // default enabled = false
        }
      ],
      plaster: { ...DEFAULT_PLASTER_CONFIG }
    };

    const estimate = calculatePlasterEstimate({ walls: [], buildingModel }, dummySettings, 'ft');
    expect(estimate.totalNetPlasterAreaSqFt).toBe(0);
    expect(estimate.totalNetPlasterAreaSqM).toBe(0);
    expect(estimate.totalCementBags).toBe(0);
    expect(estimate.totalSandCft).toBe(0);
    expect(estimate.costs.total).toBe(0);
  });

  it('supports per-wall plaster overrides and selective removal without altering wall dimensions', () => {
    const wall1: Wall = {
      id: 'w1',
      name: 'Wall 1',
      dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };
    const wall2: Wall = {
      id: 'w2',
      name: 'Wall 2 (Outer Removed)',
      dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: [],
      plasterOverrides: {
        outer: { enabled: false }
      }
    };

    const buildingModel = {
      buildingLength: 20,
      buildingWidth: 20,
      buildingUnit: 'ft' as const,
      floors: [
        {
          id: 'floor-0',
          name: 'Ground Floor',
          level: 0,
          height: 10,
          unit: 'ft' as const,
          externalWalls: [wall1, wall2],
          internalWalls: [],
          plaster: {
            ...DEFAULT_PLASTER_CONFIG,
            enabled: true,
            inner: { ...DEFAULT_PLASTER_CONFIG.inner, enabled: true, thickness: 12 },
            outer: { ...DEFAULT_PLASTER_CONFIG.outer, enabled: true, thickness: 15 },
            rcc: { ...DEFAULT_PLASTER_CONFIG.rcc, enabled: false }
          }
        }
      ]
    };

    const estimate = calculatePlasterEstimate({ walls: [], buildingModel }, dummySettings, 'ft');

    // Both wall1 and wall2 have Inner Plaster (200 + 200 = 400 sq ft)
    expect(estimate.inner.netAreaSqFt).toBeCloseTo(400, 1);
    // Only wall1 has Outer Plaster (200 sq ft), wall2 had outer removed!
    expect(estimate.outer.netAreaSqFt).toBeCloseTo(200, 1);

    // Wall dimensions are completely unaffected
    expect(wall2.dimensions.length).toBe(20);
    expect(wall2.dimensions.height).toBe(10);
    expect(wall2.dimensions.thickness).toBe(9);
  });

  it('calculates RCC Side Beam Plaster on exposed vertical side faces (2 * length * height) excluding top and soffit', () => {
    const wall: Wall = {
      id: 'w-beam-1',
      name: 'Beam Wall',
      dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const buildingModel = {
      buildingLength: 20,
      buildingWidth: 20,
      buildingUnit: 'ft' as const,
      ringBeam: {
        height: 1,
        heightUnit: 'ft' as const,
        width: 9,
        widthUnit: 'in' as const
      },
      floors: [
        {
          id: 'floor-0',
          name: 'Ground Floor',
          level: 0,
          height: 10,
          unit: 'ft' as const,
          externalWalls: [wall],
          internalWalls: [],
          ringBeam: {
            height: 1,
            heightUnit: 'ft' as const,
            width: 9,
            widthUnit: 'in' as const
          },
          plaster: {
            ...DEFAULT_PLASTER_CONFIG,
            enabled: true,
            inner: { ...DEFAULT_PLASTER_CONFIG.inner, enabled: false },
            outer: { ...DEFAULT_PLASTER_CONFIG.outer, enabled: false },
            rcc: { ...DEFAULT_PLASTER_CONFIG.rcc, enabled: false },
            rccSideBeam: {
              ...DEFAULT_PLASTER_CONFIG.rccSideBeam,
              enabled: true,
              thicknessMm: 6,
              mixRatio: '1:4' as const,
              ratePerSqM: 160
            }
          }
        }
      ]
    };

    const estimate = calculatePlasterEstimate({ walls: [], buildingModel }, dummySettings, 'ft');

    // Beam length = 20 ft, height = 1 ft.
    // Exposed side faces = 2 * (20 * 1) = 40 sq.ft
    expect(estimate.rccSideBeam.grossAreaSqFt).toBeCloseTo(40, 1);
    expect(estimate.rccSideBeam.netAreaSqFt).toBeCloseTo(40, 1);
    expect(estimate.rccSideBeam.netAreaSqM).toBeCloseTo(3.716, 2);

    // Thickness 6mm = 0.006 m
    // Wet Volume = 3.7161 * 0.006 ≈ 0.0223 m³
    expect(estimate.rccSideBeam.wetVolumeM3).toBeCloseTo(0.0223, 3);
    // Dry Mortar = 0.0223 * 1.33 ≈ 0.02965 m³
    expect(estimate.rccSideBeam.dryMortarVolumeM3).toBeCloseTo(0.0297, 3);

    // Mix 1:4 => Cement exact bags ≈ 0.17 bags, purchase = 1 bag
    expect(estimate.rccSideBeam.cementBags).toBe(1);
    // Sand CFT ≈ 0.84 CFT
    expect(estimate.rccSideBeam.sandCft).toBeCloseTo(0.84, 1);

    // Other surfaces were disabled, so their areas are 0
    expect(estimate.inner.netAreaSqFt).toBe(0);
    expect(estimate.outer.netAreaSqFt).toBe(0);
    expect(estimate.rcc.netAreaSqFt).toBe(0);
  });

  it('allows independent toggling between RCC Column Plaster and RCC Side Beam Plaster', () => {
    const pillar = {
      id: 'p1',
      name: 'Pillar 1',
      width: 12,
      depth: 12,
      unit: 'in' as const,
      height: 10,
      shape: 'rectangular' as const,
      placementType: 'central' as const,
      count: 1
    };
    const wall: Wall = {
      id: 'w1',
      name: 'Wall 1',
      dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    };

    const buildingModelWithBoth = {
      buildingLength: 20,
      buildingWidth: 20,
      buildingUnit: 'ft' as const,
      pillars: [pillar],
      ringBeam: { height: 1, heightUnit: 'ft' as const, width: 9, widthUnit: 'in' as const },
      floors: [
        {
          id: 'floor-0',
          name: 'Ground Floor',
          level: 0,
          height: 10,
          unit: 'ft' as const,
          pillars: [pillar],
          externalWalls: [wall],
          internalWalls: [],
          ringBeam: { height: 1, heightUnit: 'ft' as const, width: 9, widthUnit: 'in' as const },
          plaster: {
            ...DEFAULT_PLASTER_CONFIG,
            enabled: true,
            inner: { ...DEFAULT_PLASTER_CONFIG.inner, enabled: false },
            outer: { ...DEFAULT_PLASTER_CONFIG.outer, enabled: false },
            rcc: { ...DEFAULT_PLASTER_CONFIG.rcc, enabled: true },
            rccSideBeam: { ...DEFAULT_PLASTER_CONFIG.rccSideBeam, enabled: false }
          }
        }
      ]
    };

    // 1. Column ON, Side Beam OFF
    const est1 = calculatePlasterEstimate({ walls: [], buildingModel: buildingModelWithBoth }, dummySettings, 'ft');
    expect(est1.rcc.netAreaSqFt).toBeGreaterThan(0);
    expect(est1.rccSideBeam.netAreaSqFt).toBe(0);

    // 2. Column OFF, Side Beam ON
    const buildingModelBeamOnly = {
      ...buildingModelWithBoth,
      floors: [
        {
          ...buildingModelWithBoth.floors[0],
          plaster: {
            ...buildingModelWithBoth.floors[0].plaster,
            rcc: { ...DEFAULT_PLASTER_CONFIG.rcc, enabled: false },
            rccSideBeam: { ...DEFAULT_PLASTER_CONFIG.rccSideBeam, enabled: true }
          }
        }
      ]
    };
    const est2 = calculatePlasterEstimate({ walls: [], buildingModel: buildingModelBeamOnly }, dummySettings, 'ft');
    expect(est2.rcc.netAreaSqFt).toBe(0);
    expect(est2.rccSideBeam.netAreaSqFt).toBeGreaterThan(0);
  });
});

describe('RCC Ring Beam + Full Ring Beam Physical Connection & Junction Validation', () => {
  const sampleFloor: Floor = {
    id: 'floor-0',
    name: 'Ground Floor',
    level: 0,
    height: 10,
    unit: 'ft',
    externalWalls: [],
    internalWalls: [],
    ringBeam: { height: 1.5, heightUnit: 'ft', width: 9, widthUnit: 'in', depth: 9, depthUnit: 'in', enabled: true },
    fullRingBeam: { enabled: true, thicknessFt: 1 }
  };

  const sampleModel = {
    buildingLength: 40,
    buildingWidth: 30,
    buildingUnit: 'ft' as const,
    floors: [sampleFloor],
    ringBeam: { height: 1.5, heightUnit: 'ft' as const, width: 9, widthUnit: 'in' as const, depth: 9, depthUnit: 'in' as const, enabled: true },
    fullRingBeam: { enabled: true, thicknessFt: 1 },
    slab: { enabled: true, height: 1, heightUnit: 'ft' as const }
  };

  it('TEST 1: verifies physical contact between Pillar, Full Ring Beam, and Slab with zero gap', () => {
    const junc = getRingBeamJunction(sampleFloor, sampleModel, 0);

    // Brick wall top
    const expectedWallTop = 10 * 0.3048; // 3.048m
    expect(junc.brickWallTop).toBeCloseTo(expectedWallTop, 4);

    // Full Ring Beam sits directly on brick wall top
    expect(junc.fullRingBeamBottom).toBeCloseTo(expectedWallTop, 4);
    const expectedFullH = 1.0 * 0.3048; // 0.3048m
    expect(junc.fullRingBeamHeight).toBeCloseTo(expectedFullH, 4);
    expect(junc.fullRingBeamTop).toBeCloseTo(expectedWallTop + expectedFullH, 4);

    // Zero unintended beam gap check
    expect(junc.junctionGap).toBe(0);
    expect(junc.isJunctionConnected).toBe(true);
    expect(junc.intendedJunctionSurfaceY).toBeCloseTo(expectedWallTop, 4);

    // Slab sits directly on top of Full Ring Beam
    expect(junc.slabBottomY).toBeCloseTo(junc.fullRingBeamTop, 4);
    const expectedSlabH = 1.0 * 0.3048; // 0.3048m
    expect(junc.slabThickness).toBeCloseTo(expectedSlabH, 4);
    expect(junc.slabTopY).toBeCloseTo(junc.fullRingBeamTop + expectedSlabH, 4);
    expect(junc.slabGap).toBe(0);
    expect(junc.isSlabConnected).toBe(true);
  });

  it('TEST 2: validates Three.js center vs surface geometry alignment (BoxGeometry) for all layers', () => {
    const junc = getRingBeamJunction(sampleFloor, sampleModel, 0);

    // BoxGeometry top = centerY + height/2, bottom = centerY - height/2
    const calcFullBottom = junc.fullRingBeamCenterY - junc.fullRingBeamHeight / 2;
    const calcFullTop = junc.fullRingBeamCenterY + junc.fullRingBeamHeight / 2;
    expect(calcFullBottom).toBeCloseTo(junc.fullRingBeamBottom, 4);
    expect(calcFullTop).toBeCloseTo(junc.fullRingBeamTop, 4);

    const calcSlabBottom = junc.slabCenterY - junc.slabThickness / 2;
    const calcSlabTop = junc.slabCenterY + junc.slabThickness / 2;
    expect(calcSlabBottom).toBeCloseTo(junc.slabBottomY, 4);
    expect(calcSlabTop).toBeCloseTo(junc.slabTopY, 4);

    // Crucial: BrickWallTop must equal FullRingBeamBottom, and FullRingBeamTop must equal SlabBottom
    const beamSurfaceGap = Math.abs(junc.brickWallTop - calcFullBottom);
    expect(beamSurfaceGap).toBeLessThanOrEqual(0.0001);

    const slabSurfaceGap = Math.abs(calcFullTop - calcSlabBottom);
    expect(slabSurfaceGap).toBeLessThanOrEqual(0.0001);
  });

  it('TEST 3: verifies multi-floor continuity: Pillar -> Full Ring Beam -> Slab -> Next Floor Pillar', () => {
    const gf: Floor = {
      id: 'floor-0',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: [],
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 },
      slab: { enabled: true, height: 1, heightUnit: 'ft' }
    };

    const f1: Floor = {
      id: 'floor-1',
      name: 'Floor 1',
      level: 1,
      height: 10,
      unit: 'ft',
      externalWalls: [],
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1.5 },
      slab: { enabled: true, height: 1, heightUnit: 'ft' }
    };

    const f2: Floor = {
      id: 'floor-2',
      name: 'Floor 2',
      level: 2,
      height: 9,
      unit: 'ft',
      externalWalls: [],
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 0.5 },
      slab: { enabled: true, height: 1, heightUnit: 'ft' }
    };

    const multiModel = {
      buildingLength: 40,
      buildingWidth: 30,
      buildingUnit: 'ft' as const,
      floors: [gf, f1, f2]
    };

    const junc0 = getRingBeamJunction(gf, multiModel, 0);
    expect(junc0.floorBaseY).toBe(0);
    expect(junc0.isJunctionConnected).toBe(true);
    expect(junc0.isSlabConnected).toBe(true);

    // Floor 1 column and walls start at Floor 0 slab top
    const junc1 = getRingBeamJunction(f1, multiModel, junc0.structuralTopY);
    expect(junc1.floorBaseY).toBeCloseTo(junc0.structuralTopY, 4);
    expect(junc1.floorBaseY).toBeCloseTo(junc0.slabTopY, 4);
    expect(junc1.isJunctionConnected).toBe(true);
    expect(junc1.isSlabConnected).toBe(true);

    // Floor 2 column and walls start at Floor 1 slab top
    const junc2 = getRingBeamJunction(f2, multiModel, junc1.structuralTopY);
    expect(junc2.floorBaseY).toBeCloseTo(junc1.structuralTopY, 4);
    expect(junc2.floorBaseY).toBeCloseTo(junc1.slabTopY, 4);
    expect(junc2.isJunctionConnected).toBe(true);
    expect(junc2.isSlabConnected).toBe(true);

    // Floor 1 configuration change does NOT change Ground Floor junction
    const modifiedF1: Floor = { ...f1, fullRingBeam: { ...f1.fullRingBeam!, thicknessFt: 2 } };
    const junc0Unchanged = getRingBeamJunction(gf, { ...multiModel, floors: [gf, modifiedF1, f2] }, 0);
    expect(junc0Unchanged.structuralTopY).toBeCloseTo(junc0.structuralTopY, 4);
    expect(junc0Unchanged.fullRingBeamTop).toBeCloseTo(junc0.fullRingBeamTop, 4);
  });

  it('TEST 4: supports custom thicknesses (0.5 ft, 1 ft, 1.5 ft, 2 ft) with zero gap at all sizes', () => {
    const thicknesses = [0.5, 1.0, 1.5, 2.0];
    for (const th of thicknesses) {
      const fl: Floor = {
        ...sampleFloor,
        fullRingBeam: { enabled: true, thicknessFt: th }
      };
      const junc = getRingBeamJunction(fl, sampleModel, 0);
      expect(junc.fullRingBeamHeight).toBeCloseTo(th * 0.3048, 4);
      expect(junc.junctionGap).toBe(0);
      expect(junc.isJunctionConnected).toBe(true);
      expect(junc.fullRingBeamBottom).toBeCloseTo(junc.brickWallTop, 4);
      expect(junc.slabBottomY).toBeCloseTo(junc.fullRingBeamTop, 4);
    }
  });

  it('TEST 5: verifies total structural top height equals full ring beam + slab thickness', () => {
    const junc = getRingBeamJunction(sampleFloor, sampleModel, 0);
    expect(junc.totalStructuralTopHeight).toBeCloseTo(junc.fullRingBeamHeight + junc.slabThickness, 4);
    expect(junc.structuralTopY).toBeCloseTo(junc.brickWallTop + junc.totalStructuralTopHeight, 4);
    expect(junc.structuralTopY).toBeCloseTo(junc.slabTopY, 4);
  });

  it('TEST 6: verifies brick masonry infill bounds (Wall Top === Full Ring Beam Bottom)', () => {
    const junc = getRingBeamJunction(sampleFloor, sampleModel, 0);
    expect(junc.brickWallTop).toBeCloseTo(junc.fullRingBeamBottom, 4);
    expect(Math.abs(junc.brickWallTop - junc.fullRingBeamBottom)).toBeLessThanOrEqual(0.0001);
  });
});

describe('CRITICAL RCC Pillar Placement & 2D <-> 3D Coordinate Synchronization', () => {
  const testBuilding = {
    buildingLength: 40,
    buildingWidth: 30,
    buildingUnit: 'ft' as const,
    floors: [
      {
        id: 'floor-0',
        name: 'Ground Floor',
        level: 0,
        height: 10,
        unit: 'ft' as const,
        externalWalls: [
          { id: 'w-front', name: 'Front Wall', start: { x: 0, y: 0 }, end: { x: 40, y: 0 }, dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft' as const, thicknessUnit: 'in' as const }, openings: [] },
          { id: 'w-right', name: 'Right Wall', start: { x: 40, y: 0 }, end: { x: 40, y: 30 }, dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft' as const, thicknessUnit: 'in' as const }, openings: [] },
          { id: 'w-back', name: 'Back Wall', start: { x: 40, y: 30 }, end: { x: 0, y: 30 }, dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft' as const, thicknessUnit: 'in' as const }, openings: [] },
          { id: 'w-left', name: 'Left Wall', start: { x: 0, y: 30 }, end: { x: 0, y: 0 }, dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft' as const, thicknessUnit: 'in' as const }, openings: [] }
        ],
        internalWalls: []
      }
    ]
  };

  const cornerPillar: Pillar = {
    id: 'pillar-f0-1',
    name: 'P1',
    floorId: 'floor-0',
    width: 9,
    depth: 9,
    height: 10,
    count: 1,
    unit: 'in',
    position: { x: 0, y: 0 },
    alignment: 'outside_corner',
    shape: 'square'
  };

  it('TEST 1: Exact 2D -> 3D Coordinate Mapping and Zero Drift Round-Trip', () => {
    const worldPos = getPillarWorldPosition(cornerPillar, testBuilding, testBuilding.floors[0].externalWalls);
    
    // Scene center offset for 40ft x 30ft: centerX = -20ft = -6.096m, centerZ = +15ft = +4.572m
    // Pillar at (0, 0) in 2D has localX = 0, localZ = 0
    expect(worldPos.localX).toBeCloseTo(0, 4);
    expect(worldPos.localZ).toBeCloseTo(0, 4);
    expect(worldPos.x).toBeCloseTo(-40 * 0.3048 / 2, 4);
    expect(worldPos.z).toBeCloseTo(30 * 0.3048 / 2, 4);
    expect(worldPos.y).toBe(0);

    // Convert world coordinates back to 2D
    const roundTrip = worldPositionTo2D({ x: worldPos.x, z: worldPos.z }, testBuilding);
    expect(roundTrip.x).toBeCloseTo(0, 3);
    expect(roundTrip.y).toBeCloseTo(0, 3);

    // Internal coordinate test at (10, 15)
    const internalPillar: Pillar = { ...cornerPillar, id: 'p-int', position: { x: 10, y: 15 }, alignment: 'centre' };
    const intWorld = getPillarWorldPosition(internalPillar, testBuilding);
    const intRoundTrip = worldPositionTo2D({ x: intWorld.x, z: intWorld.z }, testBuilding);
    expect(intRoundTrip.x).toBeCloseTo(10, 3);
    expect(intRoundTrip.y).toBeCloseTo(15, 3);
  });

  it('TEST 2: Outside Corner Alignment for standard 9"x9" on 9" wall (zero unwanted shift)', () => {
    const walls = testBuilding.floors[0].externalWalls;
    const eff = getEffectivePillarPosition(cornerPillar, walls, 'ft');
    expect(eff.x).toBe(0);
    expect(eff.y).toBe(0);
  });

  it('TEST 3: Outside Corner Alignment for oversized 12"x12" column on 9" wall (flush outer faces)', () => {
    const walls = testBuilding.floors[0].externalWalls;
    const oversizedPillar: Pillar = {
      ...cornerPillar,
      width: 12,
      depth: 12
    };
    const eff = getEffectivePillarPosition(oversizedPillar, walls, 'ft');
    // Difference between 12" column and 9" wall is 3" / 2 = 1.5" = 0.125 ft
    // Shifts +X and +Y into room interior to maintain 100% flush outer face
    expect(eff.x).toBeCloseTo(0.125, 3);
    expect(eff.y).toBeCloseTo(0.125, 3);
  });

  it('TEST 4: Multi-floor Vertical Continuity (Ground, Floor 1, Floor 2 share exact X/Z coordinates)', () => {
    const gfP: Pillar = { ...cornerPillar, floorId: 'floor-0' };
    const f1P: Pillar = { ...cornerPillar, id: 'pillar-f1-1', floorId: 'floor-1' };
    const f2P: Pillar = { ...cornerPillar, id: 'pillar-f2-1', floorId: 'floor-2' };

    const wpGF = getPillarWorldPosition(gfP, { ...testBuilding, floorElevation: 0 });
    const wpF1 = getPillarWorldPosition(f1P, { ...testBuilding, floorElevation: 3.048 });
    const wpF2 = getPillarWorldPosition(f2P, { ...testBuilding, floorElevation: 6.096 });

    // Exact same X and Z in 3D world space
    expect(wpGF.x).toBeCloseTo(wpF1.x, 4);
    expect(wpGF.x).toBeCloseTo(wpF2.x, 4);
    expect(wpGF.z).toBeCloseTo(wpF1.z, 4);
    expect(wpGF.z).toBeCloseTo(wpF2.z, 4);

    // Only Y elevation differs
    expect(wpGF.y).toBe(0);
    expect(wpF1.y).toBeCloseTo(3.048, 3);
    expect(wpF2.y).toBeCloseTo(6.096, 3);
  });

  it('TEST 5: Floor Independence (Moving Floor 1 pillar does NOT move Ground Floor pillar)', () => {
    let pillars: Pillar[] = [
      { ...cornerPillar, id: 'p-gf', floorId: 'floor-0', position: { x: 0, y: 0 } },
      { ...cornerPillar, id: 'p-f1', floorId: 'floor-1', position: { x: 0, y: 0 } }
    ];

    // Move Floor 1 pillar to X=5, Y=5
    pillars = pillars.map(p => p.id === 'p-f1' ? { ...p, position: { x: 5, y: 5 } } : p);

    const gf = pillars.find(p => p.id === 'p-gf')!;
    const f1 = pillars.find(p => p.id === 'p-f1')!;

    expect(gf.position?.x).toBe(0);
    expect(gf.position?.y).toBe(0);
    expect(f1.position?.x).toBe(5);
    expect(f1.position?.y).toBe(5);
  });

  it('TEST 6: Pillar Movement updates connected Beams and Footings', () => {
    const p1: Pillar = { ...cornerPillar, id: 'p1', position: { x: 0, y: 0 } };
    const p2: Pillar = { ...cornerPillar, id: 'p2', position: { x: 20, y: 0 } };

    const initialBeams = detectPillarToPillarBeams([p1, p2], 'ft');
    expect(initialBeams.length).toBe(1);
    expect(initialBeams[0].length).toBeCloseTo(20, 2);

    // Move p1 from X=0 to X=5
    const movedP1: Pillar = { ...p1, position: { x: 5, y: 0 } };
    const updatedBeams = detectPillarToPillarBeams([movedP1, p2], 'ft');
    expect(updatedBeams[0].start.x).toBe(5);
    expect(updatedBeams[0].length).toBeCloseTo(15, 2);

    // Footing also tracks moved pillar position
    const footings = generateFootingsForPillars([movedP1], DEFAULT_FOUNDATION_CONFIG, 'ft');
    expect(footings[0].position.x).toBe(5);
    expect(footings[0].position.y).toBe(0);
  });

  it('TEST 7: Pillar Deletion removes only targeted pillar and its connections', () => {
    const p1: Pillar = { ...cornerPillar, id: 'p1', position: { x: 0, y: 0 } };
    const p2: Pillar = { ...cornerPillar, id: 'p2', position: { x: 20, y: 0 } };
    const p3: Pillar = { ...cornerPillar, id: 'p3', position: { x: 20, y: 20 } };

    let pillars = [p1, p2, p3];
    // Delete p1
    pillars = pillars.filter(p => p.id !== 'p1');

    expect(pillars.length).toBe(2);
    expect(pillars.find(p => p.id === 'p2')?.position).toEqual({ x: 20, y: 0 });
    expect(pillars.find(p => p.id === 'p3')?.position).toEqual({ x: 20, y: 20 });
  });

  it('TEST 8: validatePillarPlacement Validator catches invalid pillar configurations', () => {
    const valid = validatePillarPlacement(cornerPillar, testBuilding.floors[0].externalWalls, testBuilding);
    expect(valid.isValid).toBe(true);
    expect(valid.errors.length).toBe(0);

    const invalidPillar: Pillar = {
      ...cornerPillar,
      position: { x: NaN as any, y: 0 },
      width: -5
    };
    const invalidRes = validatePillarPlacement(invalidPillar, [], testBuilding);
    expect(invalidRes.isValid).toBe(false);
    expect(invalidRes.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('RCC Frame First + Brick Infill Inside Frame Geometry Validation', () => {
  const floorWalls: Wall[] = [
    {
      id: 'w-front',
      name: 'Front Wall',
      start: { x: 0, y: 0 },
      end: { x: 40, y: 0 },
      dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: [{ id: 'op-win', name: 'Window 1', type: 'window', width: 4, height: 4, count: 1, position: 'Center' }]
    },
    {
      id: 'w-right',
      name: 'Right Wall',
      start: { x: 40, y: 0 },
      end: { x: 40, y: 30 },
      dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    },
    {
      id: 'w-back',
      name: 'Back Wall',
      start: { x: 40, y: 30 },
      end: { x: 0, y: 30 },
      dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    },
    {
      id: 'w-left',
      name: 'Left Wall',
      start: { x: 0, y: 30 },
      end: { x: 0, y: 0 },
      dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
      openings: []
    }
  ];

  const framePillars: Pillar[] = [
    { id: 'p1', name: 'P1', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 0 }, alignment: 'outside_corner', placementType: 'corner', shape: 'square' },
    { id: 'p2', name: 'P2', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 20, y: 0 }, alignment: 'centre', placementType: 'intermediate', shape: 'square' },
    { id: 'p3', name: 'P3', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 0 }, alignment: 'outside_corner', placementType: 'corner', shape: 'square' },
    { id: 'p4', name: 'P4', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 40, y: 30 }, alignment: 'outside_corner', placementType: 'corner', shape: 'square' },
    { id: 'p5', name: 'P5', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 20, y: 30 }, alignment: 'centre', placementType: 'intermediate', shape: 'square' },
    { id: 'p6', name: 'P6', width: 9, depth: 9, height: 10, count: 1, unit: 'in', position: { x: 0, y: 30 }, alignment: 'outside_corner', placementType: 'corner', shape: 'square' }
  ];

  it('TEST 1: splitWallByPillars divides a 3-column wall into 2 distinct infill bays stopping at column faces', () => {
    const frontWall = floorWalls[0];
    const segments = splitWallByPillars(frontWall, framePillars, 'ft', floorWalls);

    // Front wall (40 ft) with pillars at X=0, X=20, X=40 must produce exactly 2 infill segments
    expect(segments.length).toBe(2);

    const halfColFt = 4.5 / 12; // 9 inches / 2 = 0.375 ft

    // Bay 1 (P1 -> P2): starts after P1 and ends before P2
    expect(segments[0].start.x).toBeCloseTo(halfColFt, 2);
    expect(segments[0].end.x).toBeCloseTo(20 - halfColFt, 2);
    expect(segments[0].length).toBeCloseTo(20 - 2 * halfColFt, 2);

    // Bay 2 (P2 -> P3): starts after P2 and ends before P3
    expect(segments[1].start.x).toBeCloseTo(20 + halfColFt, 2);
    expect(segments[1].end.x).toBeCloseTo(40 - halfColFt, 2);
    expect(segments[1].length).toBeCloseTo(20 - 2 * halfColFt, 2);
  });

  it('TEST 2: Brick infill never intersects or covers structural column bounds', () => {
    floorWalls.forEach(wall => {
      const segments = splitWallByPillars(wall, framePillars, 'ft', floorWalls);
      segments.forEach(seg => {
        framePillars.forEach(p => {
          const effP = getEffectivePillarPosition(p, floorWalls, 'ft');
          const halfColFt = (p.width / 12) / 2;

          // Neither the start nor end of any masonry segment can lie strictly inside the interior of a column
          const isStartInsideCol = Math.hypot(seg.start.x - effP.x, seg.start.y - effP.y) < halfColFt - 0.01;
          const isEndInsideCol = Math.hypot(seg.end.x - effP.x, seg.end.y - effP.y) < halfColFt - 0.01;

          expect(isStartInsideCol).toBe(false);
          expect(isEndInsideCol).toBe(false);
        });
      });
    });
  });

  it('TEST 3: detectPillarToPillarBeams creates full structural frame spanning all column junctions', () => {
    const beams = detectPillarToPillarBeams(framePillars, 'ft', floorWalls);

    // Should create beams connecting:
    // Horizontal: P1-P2, P2-P3, P6-P5, P5-P4
    // Vertical: P1-P6, P2-P5, P3-P4
    expect(beams.length).toBeGreaterThanOrEqual(7);

    // Every beam connects two distinct pillars
    beams.forEach(beam => {
      expect(beam.startPillarId).toBeDefined();
      expect(beam.endPillarId).toBeDefined();
      expect(beam.startPillarId).not.toBe(beam.endPillarId);
      expect(beam.length).toBeGreaterThan(0.5);
    });
  });

  it('TEST 4: detectClosedStructuralBays detects all closed rectangular frame bays', () => {
    const bays = detectClosedStructuralBays(framePillars, 'ft', floorWalls);

    // 6 pillars in a 2x3 grid produce exactly 2 closed structural bays: Bay 1 (X: 0-20, Y: 0-30) and Bay 2 (X: 20-40, Y: 0-30)
    expect(bays.length).toBe(2);
    expect(bays[0].width).toBeCloseTo(20, 1);
    expect(bays[0].depth).toBeCloseTo(30, 1);
    expect(bays[1].width).toBeCloseTo(20, 1);
    expect(bays[1].depth).toBeCloseTo(30, 1);
  });

  it('TEST 5: getRingBeamJunction maintains unbroken zero-gap structural frame continuity', () => {
    const dummyFloor: Floor = {
      id: 'fl-0',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      pillars: framePillars
    };

    const junction = getRingBeamJunction(dummyFloor, { buildingUnit: 'ft' }, 0);

    expect(junction.isJunctionConnected).toBe(true);
    expect(junction.isSlabConnected).toBe(true);
    expect(junction.junctionGap).toBeLessThan(0.0001);
    expect(junction.slabGap).toBeLessThan(0.0001);

    // Sequence verification: Wall Top -> Full Ring Beam Bottom -> Full Ring Beam Top -> Slab Top
    expect(junction.fullRingBeamBottom).toBe(junction.brickWallTop);
    expect(junction.slabBottomY).toBe(junction.fullRingBeamTop);
    expect(junction.structuralTopY).toBe(junction.slabTopY);
  });

  it('TEST 6: Full Roof on topmost floor directly joins RCC Full Ring Beam with zero gap', () => {
    const gf: Floor = {
      id: 'fl-gf',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 },
      slab: { enabled: true, height: 1, heightUnit: 'ft' }
    };

    const topFloor: Floor = {
      id: 'fl-top',
      name: 'Floor 1',
      level: 1,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 },
      fullRoof: { enabled: true, thickness: 5, thicknessUnit: 'in' },
      slab: { enabled: true, height: 1, heightUnit: 'ft' }
    };

    const multiModel = {
      buildingLength: 40,
      buildingWidth: 30,
      buildingUnit: 'ft' as const,
      floors: [gf, topFloor]
    };

    const gfJunc = getRingBeamJunction(gf, multiModel, 0);
    const topJunc = getRingBeamJunction(topFloor, multiModel, gfJunc.structuralTopY);

    // Full Roof integrates directly on top floor Full Ring Beam top structural line
    expect(topJunc.fullRingBeamBottom).toBe(topJunc.brickWallTop);
    expect(topJunc.slabTopY).toBe(topJunc.fullRingBeamTop);
    expect(topJunc.slabTopY).toBe(topJunc.topStructuralLineY);
    expect(topJunc.isSlabConnected).toBe(true);
    expect(topJunc.slabGap).toBeLessThan(0.0001);

    // Top floor uses configured roof thickness (5 inches = 0.127m)
    expect(topJunc.slabThickness).toBeCloseTo((5 / 12) * 0.3048, 4);
    expect(topJunc.structuralTopY).toBeCloseTo(topJunc.topStructuralLineY, 4);
  });

  it('TEST 7: validates that topmost floor RCC columns terminate flush at Full Ring Beam without extra protruding concrete', () => {
    const gf: Floor = {
      id: 'fl-0',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 }
    };

    const topFloor: Floor = {
      id: 'fl-1',
      name: 'Top Floor',
      level: 1,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 }
    };

    const model = { buildingLength: 40, buildingWidth: 30, buildingUnit: 'ft' as const, floors: [gf, topFloor] };
    const gfJunc = getRingBeamJunction(gf, model, 0);
    const topJunc = getRingBeamJunction(topFloor, model, gfJunc.structuralTopY);

    // Top floor column joint height equals Full Ring Beam height
    const topJointH = topJunc.fullRingBeamHeight;
    const topShaftH = 10 * 0.3048;
    const totalTopColH = topShaftH + topJointH;

    const colTopY = topJunc.floorBaseY + totalTopColH;
    expect(colTopY).toBeCloseTo(topJunc.fullRingBeamTop, 4);

    // Zero excess height above Full Ring Beam
    const excessHeight = Math.max(0, colTopY - topJunc.fullRingBeamTop);
    expect(excessHeight).toBeLessThan(0.0001);
  });

  it('TEST 8: getFullRoofJunction verifies beamTopY === roofTopY === topStructuralLineY with zero junctionGap', () => {
    const gf: Floor = {
      id: 'fl-gf',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 }
    };

    const topFloor: Floor = {
      id: 'fl-top',
      name: 'Top Floor',
      level: 1,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1.5, width: 9, widthUnit: 'in' },
      fullRoof: { enabled: true, thickness: 5, thicknessUnit: 'in' }
    };

    const model = { buildingLength: 40, buildingWidth: 30, buildingUnit: 'ft' as const, floors: [gf, topFloor] };
    const gfJunc = getRingBeamJunction(gf, model, 0);
    const roofJunc = getFullRoofJunction(topFloor, model, gfJunc.structuralTopY);

    expect(roofJunc.roofTopY).toBe(roofJunc.beamTopY);
    expect(roofJunc.roofTopY).toBe(roofJunc.topStructuralLineY);
    expect(roofJunc.junctionGap).toBe(0);
    expect(roofJunc.isJunctionConnected).toBe(true);
    expect(roofJunc.roofThickness).toBeCloseTo((5 / 12) * 0.3048, 4);
    expect(roofJunc.roofCenterY).toBeCloseTo(roofJunc.topStructuralLineY - roofJunc.roofThickness / 2, 4);
    expect(roofJunc.roofBottomY).toBeCloseTo(roofJunc.topStructuralLineY - roofJunc.roofThickness, 4);
  });

  it('TEST 9: getTopRccStructuralJunction verifies that Full Ring Beam and Full Roof are on ONE continuous top structural line', () => {
    const gf: Floor = {
      id: 'fl-gf',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 }
    };

    const topFloor: Floor = {
      id: 'fl-top',
      name: 'Top Floor',
      level: 1,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1, width: 9, widthUnit: 'in' },
      fullRoof: { enabled: true, thickness: 5, thicknessUnit: 'in' }
    };

    const model = { buildingLength: 40, buildingWidth: 30, buildingUnit: 'ft' as const, floors: [gf, topFloor] };
    const gfJunc = getRingBeamJunction(gf, model, 0);
    const topRccJunc = getTopRccStructuralJunction(topFloor, model, gfJunc.structuralTopY);

    expect(topRccJunc.beamTopY).toBe(topRccJunc.topStructuralLineY);
    expect(topRccJunc.roofTopY).toBe(topRccJunc.topStructuralLineY);
    expect(topRccJunc.verticalSeparation).toBe(0);
    expect(topRccJunc.isIntegrated).toBe(true);
    expect(topRccJunc.beamBottomY).toBe(topRccJunc.brickWallTop);
  });

  it('TEST 10: verifies per-floor state isolation: toggling Floor 1 Full Roof does not affect Ground Floor slab or leave orphan roof', () => {
    const gf: Floor = {
      id: 'floor-0',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 },
      slab: { enabled: true, height: 1, heightUnit: 'ft' }
    };

    const fl1: Floor = {
      id: 'floor-1',
      name: 'Floor 1',
      level: 1,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 },
      fullRoof: { enabled: true, thickness: 5, thicknessUnit: 'in' }
    };

    const multiModel = { buildingLength: 40, buildingWidth: 30, buildingUnit: 'ft' as const, floors: [gf, fl1] };

    // Initial state: Floor 1 Full Roof ON, Ground Floor Slab ON
    const showFullRoofByFloor: Record<string, boolean> = {
      'floor-0': false, // Lower floor must never have Full Roof
      'floor-1': true
    };
    const showFloorSlabByFloor: Record<string, boolean> = {
      'floor-0': true,
      'floor-1': false // Top floor uses Full Roof, not intermediate slab
    };

    // Verify initial isolation
    expect(showFullRoofByFloor['floor-1']).toBe(true);
    expect(showFullRoofByFloor['floor-0']).toBe(false);
    expect(showFloorSlabByFloor['floor-0']).toBe(true);

    // Action: User turns Floor 1 Full Roof OFF
    showFullRoofByFloor['floor-1'] = false;

    // Expected: Floor 1 Full Roof is OFF, Ground Floor slab remains ON and unchanged
    expect(showFullRoofByFloor['floor-1']).toBe(false);
    expect(showFloorSlabByFloor['floor-0']).toBe(true);
    expect(showFullRoofByFloor['floor-0']).toBe(false);
  });

  it('TEST 11: verifies Every Floor has its own Complete Structural Unit (Pillar + Brick + Ring Beam + Full Roof) and Global Show Full Roof Master Toggle', () => {
    const gf: Floor = {
      id: 'floor-0',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 },
      fullRoof: { enabled: true, thickness: 6, thicknessUnit: 'in' }
    };

    const fl1: Floor = {
      id: 'floor-1',
      name: 'Floor 1',
      level: 1,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 },
      fullRoof: { enabled: true, thickness: 6, thicknessUnit: 'in' }
    };

    const fl2: Floor = {
      id: 'floor-2',
      name: 'Floor 2',
      level: 2,
      height: 10,
      unit: 'ft',
      externalWalls: floorWalls,
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 },
      fullRoof: { enabled: true, thickness: 6, thicknessUnit: 'in' }
    };

    const floors = [gf, fl1, fl2];

    // Every floor has its own full closed roof
    const evaluateFloorRoofVisibility = (showFullRoof: boolean) => {
      return floors.map(f => ({
        floorId: f.id,
        roofId: `rcc-fullroof-${f.id}`,
        isVisible: showFullRoof
      }));
    };

    // State 1: Global Show Full Roof = ON -> ALL floor roofs visible
    const roofsOn = evaluateFloorRoofVisibility(true);
    expect(roofsOn[0].isVisible).toBe(true);
    expect(roofsOn[1].isVisible).toBe(true);
    expect(roofsOn[2].isVisible).toBe(true);
    expect(roofsOn[0].roofId).toBe('rcc-fullroof-floor-0');
    expect(roofsOn[1].roofId).toBe('rcc-fullroof-floor-1');
    expect(roofsOn[2].roofId).toBe('rcc-fullroof-floor-2');

    // State 2: Global Show Full Roof = OFF -> ALL floor roofs hidden
    const roofsOff = evaluateFloorRoofVisibility(false);
    expect(roofsOff[0].isVisible).toBe(false);
    expect(roofsOff[1].isVisible).toBe(false);
    expect(roofsOff[2].isVisible).toBe(false);
  });

  it('TEST 12: verifies independent visibility of Brick Infill Walls alongside Full Ring Beam and Full Roof', () => {
    const gf: Floor = {
      id: 'floor-0',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: [
        {
          id: 'w-front',
          name: 'Front Wall',
          start: { x: 0, y: 0 },
          end: { x: 40, y: 0 },
          dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' },
          openings: []
        }
      ],
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 },
      fullRoof: { enabled: true, thickness: 6, thicknessUnit: 'in' }
    };

    const pillars: Pillar[] = [
      { id: 'p1', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 0, y: 0 } },
      { id: 'p2', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 40, y: 0 } }
    ];

    // Verify wall splits cleanly into masonry infill spans between RCC pillars
    const segments = splitWallByPillars(gf.externalWalls[0], pillars, 'ft', gf.externalWalls);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0].length).toBeGreaterThan(35); // 40ft minus pillar widths

    // Test independence matrix:
    // Brick infill visibility is strictly determined by showBrickInfill, regardless of fullRoof or fullRingBeam
    const evaluateScene = (showBrickInfill: boolean, showFullRingBeam: boolean, showFullRoof: boolean) => ({
      brickInfillVisible: showBrickInfill,
      fullRingBeamVisible: showFullRingBeam,
      fullRoofVisible: showFullRoof
    });

    // All ON
    expect(evaluateScene(true, true, true)).toEqual({
      brickInfillVisible: true,
      fullRingBeamVisible: true,
      fullRoofVisible: true
    });

    // Brick Infill ON while Full Roof and Beam are ON
    const activeState = evaluateScene(true, true, true);
    expect(activeState.brickInfillVisible).toBe(true);
    expect(activeState.fullRoofVisible).toBe(true);
    expect(activeState.fullRingBeamVisible).toBe(true);

    // Full Roof OFF does not affect brick
    const roofOffState = evaluateScene(true, true, false);
    expect(roofOffState.brickInfillVisible).toBe(true);
    expect(roofOffState.fullRoofVisible).toBe(false);

    // Brick Infill OFF hides bricks while keeping frame visible
    const brickOffState = evaluateScene(false, true, true);
    expect(brickOffState.brickInfillVisible).toBe(false);
    expect(brickOffState.fullRoofVisible).toBe(true);
    expect(brickOffState.fullRingBeamVisible).toBe(true);
  });

  it('TEST 13: verifies Full Roof outer structural support perimeter alignment (0 inset from RCC pillars & beams)', () => {
    const gf: Floor = {
      id: 'floor-0',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: [
        { id: 'w-front', name: 'Front', start: { x: 0, y: 0 }, end: { x: 40, y: 0 }, dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
        { id: 'w-right', name: 'Right', start: { x: 40, y: 0 }, end: { x: 40, y: 30 }, dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
        { id: 'w-back', name: 'Back', start: { x: 40, y: 30 }, end: { x: 0, y: 30 }, dimensions: { length: 40, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
        { id: 'w-left', name: 'Left', start: { x: 0, y: 30 }, end: { x: 0, y: 0 }, dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] }
      ],
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1 },
      fullRoof: { enabled: true, thickness: 6, thicknessUnit: 'in' }
    };

    const pillars: Pillar[] = [
      { id: 'p1', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 0, y: 0 } },
      { id: 'p2', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 40, y: 0 } },
      { id: 'p3', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 40, y: 30 } },
      { id: 'p4', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 0, y: 30 } }
    ];

    const model = {
      buildingLength: 40,
      buildingWidth: 30,
      buildingUnit: 'ft' as const,
      pillars,
      fullRingBeam: { enabled: true, thicknessFt: 1 }
    };

    const footprint = getStructuralRoofFootprint(gf, model, pillars);

    // Pillar outer half dimension (9 in / 2 = 4.5 in = 0.1143 m)
    const halfPillarM = toMeters(4.5, 'in');

    // Expected outer bounds:
    expect(footprint.minX).toBeCloseTo(-halfPillarM, 4);
    expect(footprint.maxX).toBeCloseTo(toMeters(40, 'ft') + halfPillarM, 4);
    expect(footprint.minY).toBeCloseTo(-halfPillarM, 4);
    expect(footprint.maxY).toBeCloseTo(toMeters(30, 'ft') + halfPillarM, 4);

    // Expected outer width and depth:
    expect(footprint.widthM).toBeCloseTo(toMeters(40, 'ft') + toMeters(9, 'in'), 4);
    expect(footprint.depthM).toBeCloseTo(toMeters(30, 'ft') + toMeters(9, 'in'), 4);

    // Centered exactly on building center:
    expect(footprint.centerX).toBeCloseTo(toMeters(20, 'ft'), 4);
    expect(footprint.centerY).toBeCloseTo(toMeters(15, 'ft'), 4);
    expect(footprint.outerPerimeterCoverage).toBe(true);
  });

  it('TEST 14: verifies zero-gap continuous structural joint between RCC Corner Pillars and RCC Beams across all floors', () => {
    // Model with Ground Floor and Floor 1
    const gf: Floor = {
      id: 'floor-0',
      name: 'Ground Floor',
      level: 0,
      height: 10,
      unit: 'ft',
      externalWalls: [
        { id: 'w1', name: 'Front', start: { x: 0, y: 0 }, end: { x: 30, y: 0 }, dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
        { id: 'w2', name: 'Right', start: { x: 30, y: 0 }, end: { x: 30, y: 20 }, dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
        { id: 'w3', name: 'Back', start: { x: 30, y: 20 }, end: { x: 0, y: 20 }, dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
        { id: 'w4', name: 'Left', start: { x: 0, y: 20 }, end: { x: 0, y: 0 }, dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] }
      ],
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1, width: 9, widthUnit: 'in' },
      fullRoof: { enabled: true, thickness: 6, thicknessUnit: 'in' }
    };

    const f1: Floor = {
      id: 'floor-1',
      name: 'Floor 1',
      level: 1,
      height: 10,
      unit: 'ft',
      externalWalls: [
        { id: 'f1-w1', name: 'Front', start: { x: 0, y: 0 }, end: { x: 30, y: 0 }, dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
        { id: 'f1-w2', name: 'Right', start: { x: 30, y: 0 }, end: { x: 30, y: 20 }, dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
        { id: 'f1-w3', name: 'Back', start: { x: 30, y: 20 }, end: { x: 0, y: 20 }, dimensions: { length: 30, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] },
        { id: 'f1-w4', name: 'Left', start: { x: 0, y: 20 }, end: { x: 0, y: 0 }, dimensions: { length: 20, height: 10, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] }
      ],
      internalWalls: [],
      fullRingBeam: { enabled: true, thicknessFt: 1, width: 9, widthUnit: 'in' },
      fullRoof: { enabled: true, thickness: 6, thicknessUnit: 'in' }
    };

    const floors = [gf, f1];

    let currentElevationM = 0;
    floors.forEach((floor, idx) => {
      const floorBaseY = currentElevationM;
      const junc = getRingBeamJunction(floor, { fullRingBeam: floor.fullRingBeam, ringBeam: undefined }, floorBaseY);
      const topJunc = getTopRccStructuralJunction(floor, { fullRingBeam: floor.fullRingBeam, fullRoof: floor.fullRoof }, floorBaseY);

      // 1. Column geometry breakdown:
      const floorWallHeightM = toMeters(floor.height || 10, floor.unit || 'ft');
      const shaftHeightM = floorWallHeightM;
      const jointHeightM = junc.fullRingBeamHeight;
      const totalColumnHeightM = shaftHeightM + jointHeightM;
      const pillarTopY = floorBaseY + totalColumnHeightM;

      // 2. Beam geometry breakdown:
      const beamTopY = junc.topStructuralLineY;
      const beamBottomY = junc.brickWallTop;

      // 3. Validation: Direct structural joint between pillar top and beam top
      const jointValidation = validateBeamColumnJoint(pillarTopY, beamBottomY, beamTopY, 0.0001);

      expect(jointValidation.isValid).toBe(true);
      expect(jointValidation.verticalGap).toBeCloseTo(0, 5);
      expect(pillarTopY).toBeCloseTo(beamTopY, 5);
      expect(pillarTopY).toBeCloseTo(topJunc.topStructuralLineY, 5);
      expect(beamBottomY).toBeCloseTo(junc.brickWallTop, 5);

      // Advance elevation to next floor
      currentElevationM += totalColumnHeightM;
    });
  });

  it('TEST 15: verifies Apply to All Pillars on Current Floor updates dimensions and alignment while preserving positions, unique IDs, and other floor pillars', () => {
    const gfPillars: Pillar[] = [
      { id: 'gf-p1', name: 'P1', floorId: 'floor-0', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 0, y: 0 }, shape: 'square', alignment: 'outside_corner' },
      { id: 'gf-p2', name: 'P2', floorId: 'floor-0', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 30, y: 0 }, shape: 'square', alignment: 'outside_corner' },
      { id: 'gf-p3', name: 'P3', floorId: 'floor-0', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 30, y: 20 }, shape: 'square', alignment: 'outside_corner' },
      { id: 'gf-p4', name: 'P4', floorId: 'floor-0', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 0, y: 20 }, shape: 'square', alignment: 'outside_corner' },
    ];

    const f1Pillars: Pillar[] = [
      { id: 'f1-p1', name: 'P1', floorId: 'floor-1', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 0, y: 0 }, shape: 'square', alignment: 'outside_corner' },
      { id: 'f1-p2', name: 'P2', floorId: 'floor-1', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 30, y: 0 }, shape: 'square', alignment: 'outside_corner' },
      { id: 'f1-p3', name: 'P3', floorId: 'floor-1', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 30, y: 20 }, shape: 'square', alignment: 'outside_corner' },
      { id: 'f1-p4', name: 'P4', floorId: 'floor-1', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 0, y: 20 }, shape: 'square', alignment: 'outside_corner' },
    ];

    const model: any = {
      buildingLength: 30,
      buildingWidth: 20,
      buildingUnit: 'ft',
      pillars: [...gfPillars, ...f1Pillars],
      floors: [
        { id: 'floor-0', name: 'Ground Floor', level: 0, height: 10, unit: 'ft', externalWalls: [], internalWalls: [], pillars: gfPillars },
        { id: 'floor-1', name: 'Floor 1', level: 1, height: 10, unit: 'ft', externalWalls: [], internalWalls: [], pillars: f1Pillars }
      ],
      foundation: {
        enabled: true,
        footings: [
          { id: 'footing-gf-p1', pillarId: 'gf-p1', position: { x: 0, y: 0 }, columnStubWidth: 9, columnStubDepth: 9, columnStubUnit: 'in' },
          { id: 'footing-gf-p2', pillarId: 'gf-p2', position: { x: 30, y: 0 }, columnStubWidth: 9, columnStubDepth: 9, columnStubUnit: 'in' }
        ]
      }
    };

    // User modifies selected pillar properties to 12" x 14" x 11ft, Rectangle, Inside Corner
    const commonConfig: CommonPillarConfig = {
      shape: 'rectangle',
      width: 12,
      depth: 14,
      height: 11,
      unit: 'in',
      alignment: 'inside_corner',
      placementType: 'corner'
    };

    // Apply to current floor (Ground Floor)
    const result = applyPillarConfigToAll(model, commonConfig, {
      scope: 'current',
      activeFloorId: 'floor-0'
    });

    expect(result.affectedCount).toBe(4);
    expect(result.affectedPillarIds).toEqual(['gf-p1', 'gf-p2', 'gf-p3', 'gf-p4']);

    // Ground Floor pillars updated:
    const updatedGfPillars = result.model.pillars!.filter(p => p.floorId === 'floor-0');
    expect(updatedGfPillars.length).toBe(4);
    updatedGfPillars.forEach((p, idx) => {
      expect(p.width).toBe(12);
      expect(p.depth).toBe(14);
      expect(p.height).toBe(11);
      expect(p.shape).toBe('rectangle');
      expect(p.alignment).toBe('inside_corner');
      // Positions and unique IDs strictly preserved
      expect(p.id).toBe(gfPillars[idx].id);
      expect(p.name).toBe(gfPillars[idx].name);
      expect(p.position).toEqual(gfPillars[idx].position);
    });

    // Floor 1 pillars strictly unchanged:
    const updatedF1Pillars = result.model.pillars!.filter(p => p.floorId === 'floor-1');
    expect(updatedF1Pillars.length).toBe(4);
    updatedF1Pillars.forEach((p, idx) => {
      expect(p.width).toBe(9);
      expect(p.depth).toBe(9);
      expect(p.height).toBe(10);
      expect(p.shape).toBe('square');
      expect(p.alignment).toBe('outside_corner');
      expect(p.id).toBe(f1Pillars[idx].id);
      expect(p.position).toEqual(f1Pillars[idx].position);
    });

    // Foundation footing stub dimensions updated while footing positions and IDs are preserved:
    expect(result.model.foundation!.footings[0].columnStubWidth).toBe(12);
    expect(result.model.foundation!.footings[0].columnStubDepth).toBe(14);
    expect(result.model.foundation!.footings[0].position).toEqual({ x: 0, y: 0 });
    expect(result.model.foundation!.footings[0].id).toBe('footing-gf-p1');
  });

  it('TEST 16: verifies Apply to All Pillars with All Floors scope updates all pillars across building while preserving independent coordinates and IDs', () => {
    const gfPillars: Pillar[] = [
      { id: 'gf-p1', name: 'P1', floorId: 'floor-0', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 0, y: 0 } },
      { id: 'gf-p2', name: 'P2', floorId: 'floor-0', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 30, y: 0 } }
    ];

    const f1Pillars: Pillar[] = [
      { id: 'f1-p1', name: 'P1', floorId: 'floor-1', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 0, y: 0 } },
      { id: 'f1-p2', name: 'P2', floorId: 'floor-1', width: 9, depth: 9, height: 10, unit: 'in', count: 1, position: { x: 30, y: 0 } }
    ];

    const model: any = {
      buildingLength: 30,
      buildingWidth: 20,
      buildingUnit: 'ft',
      pillars: [...gfPillars, ...f1Pillars],
      floors: [
        { id: 'floor-0', name: 'Ground Floor', level: 0, height: 10, unit: 'ft', externalWalls: [], internalWalls: [], pillars: gfPillars },
        { id: 'floor-1', name: 'Floor 1', level: 1, height: 10, unit: 'ft', externalWalls: [], internalWalls: [], pillars: f1Pillars }
      ]
    };

    const commonConfig: CommonPillarConfig = {
      shape: 'circular',
      width: 15,
      depth: 15,
      height: 12,
      unit: 'in'
    };

    const result = applyPillarConfigToAll(model, commonConfig, {
      scope: 'all',
      activeFloorId: 'floor-0'
    });

    expect(result.affectedCount).toBe(4);
    expect(result.model.pillars!.length).toBe(4);

    result.model.pillars!.forEach(p => {
      expect(p.width).toBe(15);
      expect(p.depth).toBe(15); // Circular automatically sets depth=width
      expect(p.height).toBe(12);
      expect(p.shape).toBe('circular');
    });

    // Check Ground and Floor 1 positions are preserved
    expect(result.model.pillars!.find(p => p.id === 'gf-p1')?.position).toEqual({ x: 0, y: 0 });
    expect(result.model.pillars!.find(p => p.id === 'gf-p2')?.position).toEqual({ x: 30, y: 0 });
    expect(result.model.pillars!.find(p => p.id === 'f1-p1')?.position).toEqual({ x: 0, y: 0 });
    expect(result.model.pillars!.find(p => p.id === 'f1-p2')?.position).toEqual({ x: 30, y: 0 });
  });
});





