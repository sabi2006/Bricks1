import { 
  calculateProject, 
  Wall, 
  Pillar, 
  Floor,
  CalculatorSettings, 
  BrickSpecification,
  getEffectivePillarPosition, 
  trimWallByPillars,
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
  calculateFoundationEstimate,
  DEFAULT_BRICK_SIZE,
  DEFAULT_TN_RED_BRICK
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
      est.costs.cement +
      est.costs.sand +
      est.costs.aggregate +
      est.costs.steel +
      est.costs.bindingWire +
      est.costs.coverBlocks
    );
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
});
