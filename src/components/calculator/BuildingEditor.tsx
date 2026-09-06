"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useCalculator } from './CalculatorContext';
import { 
  BuildingModel, 
  Floor, 
  Unit, 
  Wall, 
  Opening, 
  Coordinate, 
  Pillar, 
  DEFAULT_RCC_PILLAR,
  DEFAULT_RCC_RING_BEAM,
  RCCRingBeamConfig,
  DEFAULT_RCC_FULL_RING_BEAM,
  RCCFullRingBeamConfig,
  DEFAULT_RCC_SLAB,
  RCCSlabConfig,
  FoundationFooting,
  FoundationConfig,
  DEFAULT_FOUNDATION_CONFIG,
  generateFootingsForPillars,
  calculateFootingRcc,
  trimWallByPillars, 
  splitWallByPillars,
  getEffectivePillarPosition, 
  detectStructuralPillars,
  checkPillarOpeningCollision, 
  convertUnit 
} from '@/lib/brickCalculator';
import { MousePointer2, Square, DoorOpen, LayoutGrid, Trash2, X, Info, ShieldAlert, Sparkles, CheckCircle2, Layers, Box, LandPlot, Hammer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BuildingEditorProps {
  initialDetails: any;
  onGenerate: () => void;
}

type Tool = 'wall' | 'door' | 'window' | 'delete' | 'none' | 'pillar' | 'beam' | 'fullRingBeam' | 'foundation';

export function BuildingEditor({ initialDetails, onGenerate }: BuildingEditorProps) {
  const { setBuildingModel, buildingModel } = useCalculator();
  
  // Helper to build initial floors with automatic structural pillars
  const createInitialModel = (): BuildingModel => {
    const numFloors = initialDetails?.visibleFloors || 1;
    const w = 40;
    const d = 30;
    const t = 9;
    const bUnit: Unit = 'ft';

    const initialFloors: Floor[] = Array.from({ length: numFloors }).map((_, i) => {
      const floorId = `floor-${i}`;
      const extWalls: Wall[] = [
        { 
          id: `${floorId}-front`, name: 'Front Wall', floorId,
          start: { x: 0, y: 0 }, end: { x: w, y: 0 },
          dimensions: { length: w, height: 10, thickness: t, unit: bUnit, thicknessUnit: 'in' as Unit }, 
          openings: []
        },
        { 
          id: `${floorId}-right`, name: 'Right Wall', floorId,
          start: { x: w, y: 0 }, end: { x: w, y: d },
          dimensions: { length: d, height: 10, thickness: t, unit: bUnit, thicknessUnit: 'in' as Unit }, 
          openings: []
        },
        { 
          id: `${floorId}-back`, name: 'Back Wall', floorId,
          start: { x: w, y: d }, end: { x: 0, y: d },
          dimensions: { length: w, height: 10, thickness: t, unit: bUnit, thicknessUnit: 'in' as Unit }, 
          openings: []
        },
        { 
          id: `${floorId}-left`, name: 'Left Wall', floorId,
          start: { x: 0, y: d }, end: { x: 0, y: 0 },
          dimensions: { length: d, height: 10, thickness: t, unit: bUnit, thicknessUnit: 'in' as Unit }, 
          openings: []
        },
      ];

      return {
        id: floorId,
        name: i === 0 ? 'Ground Floor' : `Floor ${i}`,
        level: i,
        height: 10,
        unit: bUnit,
        externalWalls: extWalls,
        internalWalls: [],
        rooms: []
      };
    });

    // Detect structural pillars for Ground Floor
    const groundPillars = detectStructuralPillars(initialFloors[0], w, d, bUnit, 10).map((gp, idx) => ({
      ...gp,
      id: `pillar-${initialFloors[0].id}-${idx + 1}`,
      floorId: initialFloors[0].id,
      verticalColumnId: `col-${idx + 1}`
    }));
    
    // Propagate exact X/Z coordinates to subsequent floors as independent floor-owned instances
    const allInitialPillars: Pillar[] = [...groundPillars];
    for (let i = 1; i < initialFloors.length; i++) {
      const fl = initialFloors[i];
      const floorPillars: Pillar[] = groundPillars.map((gp, idx) => ({
        ...gp,
        id: `pillar-${fl.id}-${idx + 1}`,
        floorId: fl.id,
        verticalColumnId: gp.verticalColumnId || `col-${idx + 1}`,
        height: fl.height
      }));
      fl.pillars = floorPillars;
      allInitialPillars.push(...floorPillars);
    }
    initialFloors[0].pillars = groundPillars;
    const initialFootings = generateFootingsForPillars(groundPillars, DEFAULT_FOUNDATION_CONFIG, bUnit);

    return {
      floors: initialFloors.map(f => ({
        ...f,
        ringBeam: { ...DEFAULT_RCC_RING_BEAM },
        fullRingBeam: { ...DEFAULT_RCC_FULL_RING_BEAM },
        slab: { ...DEFAULT_RCC_SLAB }
      })),
      buildingLength: w,
      buildingWidth: d,
      buildingUnit: bUnit,
      externalWallThickness: t,
      pillars: allInitialPillars,
      ringBeam: DEFAULT_RCC_RING_BEAM,
      fullRingBeam: DEFAULT_RCC_FULL_RING_BEAM,
      slab: DEFAULT_RCC_SLAB,
      foundation: {
        ...DEFAULT_FOUNDATION_CONFIG,
        footings: initialFootings
      },
      layoutMode: 'auto'
    };
  };

  const [model, setModel] = useState<BuildingModel>(() => {
    if (buildingModel && buildingModel.floors && buildingModel.floors.length > 0) {
      const baseModel = {
        ...buildingModel,
        ringBeam: buildingModel.ringBeam || DEFAULT_RCC_RING_BEAM,
        fullRingBeam: buildingModel.fullRingBeam || DEFAULT_RCC_FULL_RING_BEAM,
        slab: buildingModel.slab || DEFAULT_RCC_SLAB,
        floors: buildingModel.floors.map(fl => ({
          ...fl,
          ringBeam: fl.ringBeam || buildingModel.ringBeam || DEFAULT_RCC_RING_BEAM,
          fullRingBeam: fl.fullRingBeam || buildingModel.fullRingBeam || DEFAULT_RCC_FULL_RING_BEAM,
          slab: fl.slab || DEFAULT_RCC_SLAB,
          externalWalls: fl.externalWalls.map(w => ({ ...w, floorId: fl.id })),
          internalWalls: fl.internalWalls.map(w => ({ ...w, floorId: fl.id }))
        }))
      };
      // If buildingModel has floors but no pillars, auto-populate structural pillars
      if (!baseModel.pillars || baseModel.pillars.length === 0) {
        const gf = baseModel.floors[0];
        const gfPillars = detectStructuralPillars(gf, baseModel.buildingLength, baseModel.buildingWidth, baseModel.buildingUnit, gf.height).map((gp, idx) => ({
          ...gp,
          id: `pillar-${gf.id}-${idx + 1}`,
          floorId: gf.id,
          verticalColumnId: `col-${idx + 1}`,
          height: gf.height
        }));
        baseModel.pillars = gfPillars;
        baseModel.floors[0].pillars = gfPillars;
      }
      // If buildingModel has no foundation or empty footings, initialize with Ground Floor pillars
      if (!baseModel.foundation || !baseModel.foundation.footings || baseModel.foundation.footings.length === 0) {
        const gfPillars = baseModel.pillars?.filter(p => !p.floorId || p.floorId === 'floor-0' || p.floorId === 'ground') || [];
        baseModel.foundation = {
          ...DEFAULT_FOUNDATION_CONFIG,
          ...(baseModel.foundation || {}),
          footings: generateFootingsForPillars(gfPillars, baseModel.foundation || DEFAULT_FOUNDATION_CONFIG, baseModel.buildingUnit)
        };
      }
      return baseModel;
    }
    return createInitialModel();
  });

  const [activeFloorId, setActiveFloorId] = useState<string>(model.floors[0]?.id || 'floor-0');
  const activeFloor = model.floors.find(f => f.id === activeFloorId) || model.floors[0];

  // Tools state
  const [activeTool, setActiveTool] = useState<Tool>('wall');
  const [internalWallThickness, setInternalWallThickness] = useState<number>(4.5);
  const [doorWidth, setDoorWidth] = useState<number>(3);
  const [doorHeight, setDoorHeight] = useState<number>(7);
  const [windowWidth, setWindowWidth] = useState<number>(4);
  const [windowHeight, setWindowHeight] = useState<number>(4);
  const [pillarName, setPillarName] = useState<string>(`P${(model.pillars?.length || 0) + 1}`);
  const [pillarShape, setPillarShape] = useState<'square' | 'rectangle' | 'circular'>('square');
  const [pillarWidth, setPillarWidth] = useState<number>(DEFAULT_RCC_PILLAR.width); // 9 inches
  const [pillarDepth, setPillarDepth] = useState<number>(DEFAULT_RCC_PILLAR.depth); // 9 inches
  const [pillarHeight, setPillarHeight] = useState<number>(10);
  const [pillarWdUnit, setPillarWdUnit] = useState<Unit>('in');
  const [pillarPlacement, setPillarPlacement] = useState<'corner' | 'wall_joint' | 'wall_end' | 'wall' | 'central' | 'custom'>('corner');
  const [pillarAlignment, setPillarAlignment] = useState<'outside_corner' | 'centre' | 'inside_corner' | 'flush_exterior' | 'flush_interior' | 'custom_offset'>('outside_corner');
  const [pillarFinish, setPillarFinish] = useState<'raw' | 'smooth' | 'painted'>('raw');
  const [pillarContinue, setPillarContinue] = useState<'current' | 'all'>('all');
  const [pillarIncludeEst, setPillarIncludeEst] = useState<boolean>(true);
  const [pillarShowRebar, setPillarShowRebar] = useState<boolean>(false);
  const [pillarShowBeam, setPillarShowBeam] = useState<boolean>(false);
  const [customOffsetX, setCustomOffsetX] = useState<number>(0);
  const [customOffsetY, setCustomOffsetY] = useState<number>(0);

  // RCC Ring Beam Tool Config State
  const [beamEnabled, setBeamEnabled] = useState<boolean>(
    (activeFloor?.ringBeam?.enabled === true) &&
    !(activeFloor?.fullRingBeam?.enabled !== false)
  );
  const [beamHeight, setBeamHeight] = useState<number>(activeFloor?.ringBeam?.height ?? model.ringBeam?.height ?? 2);
  const [beamWidth, setBeamWidth] = useState<number>(activeFloor?.ringBeam?.width ?? model.ringBeam?.width ?? 9);
  const [beamDepth, setBeamDepth] = useState<number>(activeFloor?.ringBeam?.depth ?? model.ringBeam?.depth ?? 9);

  // RCC Full Ring Beam Tool Config State (Thickness in feet only)
  const [fullBeamEnabled, setFullBeamEnabled] = useState<boolean>(
    activeFloor?.fullRingBeam?.enabled ?? model.fullRingBeam?.enabled ?? true
  );
  const [fullBeamThickness, setFullBeamThickness] = useState<number>(
    activeFloor?.fullRingBeam?.thicknessFt ?? model.fullRingBeam?.thicknessFt ?? 1
  );

  // Foundation Tool State
  const [selectedFootingId, setSelectedFootingId] = useState<string | null>(null);
  const isGroundFloor = (activeFloor?.level === 0) || (activeFloorId === 'floor-0') || (model.floors[0]?.id === activeFloorId);
  const selectedFooting = (model.foundation?.footings || []).find(f => f.id === selectedFootingId);

  const handleAutoGenerateFoundations = () => {
    const gfPillars = (model.pillars || []).filter(p => !p.floorId || p.floorId === 'floor-0' || p.floorId === 'ground');
    const targetPillars = gfPillars.length > 0 ? gfPillars : (model.floors[0]?.pillars || []);
    const newFootings = generateFootingsForPillars(targetPillars, model.foundation || DEFAULT_FOUNDATION_CONFIG, model.buildingUnit);
    setModel(prev => ({
      ...prev,
      foundation: {
        ...(prev.foundation || DEFAULT_FOUNDATION_CONFIG),
        enabled: true,
        footings: newFootings
      }
    }));
  };

  const handleUpdateFooting = (footingId: string, changes: Partial<FoundationFooting>) => {
    setModel(prev => {
      const curF = prev.foundation || DEFAULT_FOUNDATION_CONFIG;
      const updatedFootings = curF.footings.map(f => f.id === footingId ? { ...f, ...changes } : f);
      return {
        ...prev,
        foundation: {
          ...curF,
          footings: updatedFootings
        }
      };
    });
  };

  const handleDeleteFooting = (footingId: string) => {
    setModel(prev => {
      const curF = prev.foundation || DEFAULT_FOUNDATION_CONFIG;
      return {
        ...prev,
        foundation: {
          ...curF,
          footings: curF.footings.filter(f => f.id !== footingId)
        }
      };
    });
    if (selectedFootingId === footingId) setSelectedFootingId(null);
  };

  const handleBeamToggle = (enabled: boolean) => {
    setBeamEnabled(enabled);
    if (enabled) {
      setFullBeamEnabled(false);
    }
    const updatedBeam: RCCRingBeamConfig = {
      height: beamHeight,
      heightUnit: 'ft',
      width: beamWidth,
      widthUnit: 'in',
      depth: beamDepth,
      depthUnit: 'in',
      enabled
    };
    const updatedFullBeam: RCCFullRingBeamConfig = {
      enabled: enabled ? false : fullBeamEnabled,
      thicknessFt: fullBeamThickness
    };
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => fl.id === activeFloorId ? {
        ...fl,
        ringBeam: updatedBeam,
        fullRingBeam: updatedFullBeam
      } : fl);
      return {
        ...prev,
        ringBeam: updatedBeam,
        fullRingBeam: updatedFullBeam,
        floors: updatedFloors
      };
    });
  };

  const handleBeamChange = (h: number, w: number, d: number) => {
    const safeH = Math.max(0.1, isNaN(h) ? 2 : h);
    const safeW = Math.max(1, isNaN(w) ? 9 : w);
    const safeD = Math.max(1, isNaN(d) ? 9 : d);
    setBeamHeight(safeH);
    setBeamWidth(safeW);
    setBeamDepth(safeD);
    setBeamEnabled(true);
    setFullBeamEnabled(false);
    const updatedBeam: RCCRingBeamConfig = {
      height: safeH,
      heightUnit: 'ft',
      width: safeW,
      widthUnit: 'in',
      depth: safeD,
      depthUnit: 'in',
      enabled: true
    };
    const updatedFullBeam: RCCFullRingBeamConfig = {
      enabled: false,
      thicknessFt: fullBeamThickness
    };
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => fl.id === activeFloorId ? {
        ...fl,
        ringBeam: updatedBeam,
        fullRingBeam: updatedFullBeam
      } : fl);
      return {
        ...prev,
        ringBeam: updatedBeam,
        fullRingBeam: updatedFullBeam,
        floors: updatedFloors
      };
    });
  };

  const handleFullBeamToggle = (enabled: boolean) => {
    setFullBeamEnabled(enabled);
    if (enabled) {
      setBeamEnabled(false);
    }
    const updatedFullBeam: RCCFullRingBeamConfig = {
      enabled,
      thicknessFt: fullBeamThickness
    };
    const updatedBeam: RCCRingBeamConfig = {
      height: beamHeight,
      heightUnit: 'ft',
      width: beamWidth,
      widthUnit: 'in',
      depth: beamDepth,
      depthUnit: 'in',
      enabled: enabled ? false : beamEnabled
    };
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => fl.id === activeFloorId ? {
        ...fl,
        fullRingBeam: updatedFullBeam,
        ringBeam: updatedBeam
      } : fl);
      return {
        ...prev,
        fullRingBeam: updatedFullBeam,
        ringBeam: updatedBeam,
        floors: updatedFloors
      };
    });
  };

  const handleFullBeamThicknessChange = (thickness: number) => {
    const safeT = Math.max(0.1, isNaN(thickness) ? 1 : thickness);
    setFullBeamThickness(safeT);
    setFullBeamEnabled(true);
    setBeamEnabled(false);
    const updatedFullBeam: RCCFullRingBeamConfig = {
      enabled: true,
      thicknessFt: safeT
    };
    const updatedBeam: RCCRingBeamConfig = {
      height: beamHeight,
      heightUnit: 'ft',
      width: beamWidth,
      widthUnit: 'in',
      depth: beamDepth,
      depthUnit: 'in',
      enabled: false
    };
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => fl.id === activeFloorId ? {
        ...fl,
        fullRingBeam: updatedFullBeam,
        ringBeam: updatedBeam
      } : fl);
      return {
        ...prev,
        fullRingBeam: updatedFullBeam,
        ringBeam: updatedBeam,
        floors: updatedFloors
      };
    });
  };

  useEffect(() => {
    if (activeFloor) {
      const curRing = activeFloor.ringBeam ?? model.ringBeam ?? DEFAULT_RCC_RING_BEAM;
      const curFullRing = activeFloor.fullRingBeam ?? model.fullRingBeam ?? DEFAULT_RCC_FULL_RING_BEAM;
      const isFullOn = curFullRing.enabled === true;
      setFullBeamEnabled(isFullOn);
      setFullBeamThickness(curFullRing.thicknessFt ?? 1);
      setBeamHeight(curRing.height ?? 2);
      setBeamWidth(curRing.width ?? 9);
      setBeamDepth(curRing.depth ?? 9);
      setBeamEnabled(curRing.enabled !== false && !isFullOn);
    }
  }, [activeFloorId]);

  useEffect(() => {
    setBuildingModel(model);
  }, [model, setBuildingModel]);

  const [selectedPillarId, setSelectedPillarId] = useState<string | null>(null);
  const [drawingStart, setDrawingStart] = useState<Coordinate | null>(null);
  const [currentMouse, setCurrentMouse] = useState<Coordinate | null>(null);
  const [pillarPreview, setPillarPreview] = useState<{valid: boolean; coord: Coordinate | null; message?: string}>({ valid: true, coord: null });
  const svgRef = useRef<SVGSVGElement>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    targetMode: 'auto' | 'manual';
  }>({ isOpen: false, targetMode: 'manual' });

  const isManualMode = model.layoutMode === 'manual';

  const handleConfirmModeSwitch = () => {
    if (confirmModal.targetMode === 'manual') {
      // Switch to Manual Layout: remove automatic outer walls
      setModel(prev => ({
        ...prev,
        layoutMode: 'manual',
        floors: prev.floors.map(floor => ({
          ...floor,
          externalWalls: []
        }))
      }));
    } else {
      // Switch to Auto Outer Layout: regenerate outer rectangular walls
      const w = model.buildingLength;
      const d = model.buildingWidth;
      const t = model.externalWallThickness || 9;
      setModel(prev => ({
        ...prev,
        layoutMode: 'auto',
        floors: prev.floors.map(floor => {
          const extWalls = [
            { 
              id: `${floor.id}-front`, name: 'Front Wall', 
              start: { x: 0, y: 0 }, end: { x: w, y: 0 },
              dimensions: { length: w, height: floor.height, thickness: t, unit: model.buildingUnit, thicknessUnit: 'in' as Unit }, 
              openings: []
            },
            { 
              id: `${floor.id}-right`, name: 'Right Wall', 
              start: { x: w, y: 0 }, end: { x: w, y: d },
              dimensions: { length: d, height: floor.height, thickness: t, unit: model.buildingUnit, thicknessUnit: 'in' as Unit }, 
              openings: []
            },
            { 
              id: `${floor.id}-back`, name: 'Back Wall', 
              start: { x: w, y: d }, end: { x: 0, y: d },
              dimensions: { length: w, height: floor.height, thickness: t, unit: model.buildingUnit, thicknessUnit: 'in' as Unit }, 
              openings: []
            },
            { 
              id: `${floor.id}-left`, name: 'Left Wall', 
              start: { x: 0, y: d }, end: { x: 0, y: 0 },
              dimensions: { length: d, height: floor.height, thickness: t, unit: model.buildingUnit, thicknessUnit: 'in' as Unit }, 
              openings: []
            },
          ];
          return { ...floor, externalWalls: extWalls };
        })
      }));
    }
    setConfirmModal({ isOpen: false, targetMode: 'manual' });
  };

  useEffect(() => {
    if (!model.pillars || model.pillars.length === 0) return;
    
    let needsUpdate = false;
    const allWallsArr = model.floors.flatMap(f => [...f.externalWalls, ...f.internalWalls]);
    
    const audited = model.pillars.map(p => {
       if (p.placementType === 'custom' || !p.position) return p;
       const snapInfo = getPillarSnap(p.position, p.placementType || 'custom', allWallsArr);
       const isClose = snapInfo.coord && Math.hypot(snapInfo.coord.x - p.position.x, snapInfo.coord.y - p.position.y) < 0.1;
       
       if (!isClose) {
          needsUpdate = true;
          return { ...p, placementType: 'custom', notes: 'Audit: Converted to custom due to invalid placement' };
       }
       return p;
    });

    if (needsUpdate) {
       setModel(prev => ({ ...prev, pillars: audited as any }));
       alert("Some pillars were floating in rooms but marked as Wall Joint. They have been converted to Custom position. Please verify.");
    }
  }, []); // Run on initial mount

  useEffect(() => {
    // Only auto-generate external walls in Auto mode
    if (model.layoutMode === 'manual') return;

    const w = model.buildingLength;
    const d = model.buildingWidth;
    const t = model.externalWallThickness || 9;
    const newFloors = model.floors.map(floor => {
        const currentExt = floor.externalWalls;
        const extWalls = [
          { 
            id: `${floor.id}-front`, name: 'Front Wall', 
            start: { x: 0, y: 0 }, end: { x: w, y: 0 },
            dimensions: { length: w, height: floor.height, thickness: t, unit: model.buildingUnit, thicknessUnit: 'in' as Unit }, 
            openings: currentExt.find(ew => ew.id === `${floor.id}-front`)?.openings || []
          },
          { 
            id: `${floor.id}-right`, name: 'Right Wall', 
            start: { x: w, y: 0 }, end: { x: w, y: d },
            dimensions: { length: d, height: floor.height, thickness: t, unit: model.buildingUnit, thicknessUnit: 'in' as Unit }, 
            openings: currentExt.find(ew => ew.id === `${floor.id}-right`)?.openings || []
          },
          { 
            id: `${floor.id}-back`, name: 'Back Wall', 
            start: { x: w, y: d }, end: { x: 0, y: d },
            dimensions: { length: w, height: floor.height, thickness: t, unit: model.buildingUnit, thicknessUnit: 'in' as Unit }, 
            openings: currentExt.find(ew => ew.id === `${floor.id}-back`)?.openings || []
          },
          { 
            id: `${floor.id}-left`, name: 'Left Wall', 
            start: { x: 0, y: d }, end: { x: 0, y: 0 },
            dimensions: { length: d, height: floor.height, thickness: t, unit: model.buildingUnit, thicknessUnit: 'in' as Unit }, 
            openings: currentExt.find(ew => ew.id === `${floor.id}-left`)?.openings || []
          },
        ];
        return { ...floor, externalWalls: extWalls };
    });
    
    if (JSON.stringify(newFloors) !== JSON.stringify(model.floors)) {
        setModel(prev => ({ ...prev, floors: newFloors }));
    }
  }, [model.buildingLength, model.buildingWidth, model.buildingUnit, model.externalWallThickness, model.layoutMode]);

  const handleAddFloor = () => {
    const nextLevel = model.floors.length;
    const newFloorId = `floor-${Date.now()}`;
    const w = model.buildingLength;
    const d = model.buildingWidth;
    const t = model.externalWallThickness || 9;
    
    const extWalls: Wall[] = [
      { 
        id: `${newFloorId}-front`, name: 'Front Wall', floorId: newFloorId,
        start: { x: 0, y: 0 }, end: { x: w, y: 0 },
        dimensions: { length: w, height: 10, thickness: t, unit: model.buildingUnit, thicknessUnit: 'in' as Unit }, 
        openings: []
      },
      { 
        id: `${newFloorId}-right`, name: 'Right Wall', floorId: newFloorId,
        start: { x: w, y: 0 }, end: { x: w, y: d },
        dimensions: { length: d, height: 10, thickness: t, unit: model.buildingUnit, thicknessUnit: 'in' as Unit }, 
        openings: []
      },
      { 
        id: `${newFloorId}-back`, name: 'Back Wall', floorId: newFloorId,
        start: { x: w, y: d }, end: { x: 0, y: d },
        dimensions: { length: w, height: 10, thickness: t, unit: model.buildingUnit, thicknessUnit: 'in' as Unit }, 
        openings: []
      },
      { 
        id: `${newFloorId}-left`, name: 'Left Wall', floorId: newFloorId,
        start: { x: 0, y: d }, end: { x: 0, y: 0 },
        dimensions: { length: d, height: 10, thickness: t, unit: model.buildingUnit, thicknessUnit: 'in' as Unit }, 
        openings: []
      },
    ];

    // Propagate all structural pillars from Ground Floor / existing floors to the new floor
    // at the EXACT same X and Z coordinates for 100% vertical structural alignment
    const existingPillars = model.pillars || [];
    const sourceFloor = model.floors[0] || model.floors[model.floors.length - 1];
    const sourcePillars = existingPillars.filter(p => p.floorId === sourceFloor.id || !p.floorId);
    
    const uniquePositionsMap = new Map<string, Pillar>();
    (sourcePillars.length > 0 ? sourcePillars : existingPillars).forEach(p => {
      if (p.position) {
        const key = `${p.position.x.toFixed(2)},${p.position.y.toFixed(2)}`;
        if (!uniquePositionsMap.has(key)) {
          uniquePositionsMap.set(key, p);
        }
      }
    });

    const newFloorPillars: Pillar[] = Array.from(uniquePositionsMap.values()).map((sp, idx) => ({
      ...sp,
      id: `pillar-${newFloorId}-${Date.now()}-${idx + 1}`,
      name: sp.name || `P${idx + 1}`,
      floorId: newFloorId,
      verticalColumnId: sp.verticalColumnId || `col-${idx + 1}`,
      height: 10,
      count: 1
    }));

    const newFloor: Floor = {
      id: newFloorId,
      name: nextLevel === 0 ? 'Ground Floor' : `Floor ${nextLevel}`,
      level: nextLevel,
      height: 10,
      unit: model.buildingUnit,
      externalWalls: extWalls,
      internalWalls: [],
      rooms: [],
      pillars: newFloorPillars,
      ringBeam: { ...DEFAULT_RCC_RING_BEAM },
      fullRingBeam: { ...DEFAULT_RCC_FULL_RING_BEAM },
      slab: { ...DEFAULT_RCC_SLAB }
    };

    setModel(prev => ({
      ...prev,
      floors: [...prev.floors, newFloor],
      pillars: [...(prev.pillars || []), ...newFloorPillars]
    }));
    setActiveFloorId(newFloorId);
  };

  const handleRemoveFloor = (floorIdToRemove: string) => {
    if (model.floors.length <= 1) return; // Prevent removing ground floor
    
    const newFloors = model.floors.filter(f => f.id !== floorIdToRemove);
    const updatedFloors = newFloors.map((f, i) => ({
      ...f,
      level: i,
      name: i === 0 ? 'Ground Floor' : `Floor ${i}`
    }));
    
    const updatedPillars = (model.pillars || []).filter(p => p.floorId !== floorIdToRemove);

    setModel(prev => ({ ...prev, floors: updatedFloors, pillars: updatedPillars }));
    if (activeFloorId === floorIdToRemove) {
      setActiveFloorId(updatedFloors[updatedFloors.length - 1].id);
    }
  };

  const handleAutoGeneratePillars = () => {
    if (!activeFloor) return;
    const generated = detectStructuralPillars(activeFloor, model.buildingLength, model.buildingWidth, model.buildingUnit, activeFloor.height).map((gp, idx) => ({
      ...gp,
      id: `pillar-${activeFloor.id}-${Date.now()}-${idx + 1}`,
      name: gp.name || `P${idx + 1}`,
      floorId: activeFloor.id,
      verticalColumnId: `col-${Date.now()}-${idx + 1}`,
      height: activeFloor.height
    }));

    setModel(prev => {
      const otherPillars = (prev.pillars || []).filter(p => p.floorId !== activeFloor.id);
      return {
        ...prev,
        pillars: [...otherPillars, ...generated],
        floors: prev.floors.map(fl => fl.id === activeFloor.id ? {
          ...fl,
          pillars: generated
        } : fl)
      };
    });
  };

  const snapToGrid = (val: number, step: number = 0.5) => {
    return Math.round(val / step) * step;
  };

  const getMouseCoords = (e: React.MouseEvent | React.TouchEvent): Coordinate | null => {
    if (!svgRef.current) return null;
    const svg = svgRef.current;
    const CTM = svg.getScreenCTM();
    if (!CTM) return null;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(CTM.inverse());
    
    // Convert SVG ViewBox coords to model coordinates (inverting Y across buildingWidth to match inner `<g>` transform)
    const rawX = svgP.x;
    const rawY = model.buildingWidth - svgP.y;

    return { x: snapToGrid(rawX), y: snapToGrid(rawY) };
  };

  const getPillarSnap = (mouse: Coordinate, mode: string, walls: Wall[]) => {
    let bestSnap: Coordinate | null = null;
    let snapSource = '';
    const snapThreshold = 1.5; // ft

    if (mode === 'corner' || mode === 'wall_joint' || mode === 'wall_end') {
      let minDist = snapThreshold;
      walls.forEach(w => {
        if (w.start) {
          const d = Math.hypot(w.start.x - mouse.x, w.start.y - mouse.y);
          if (d < minDist) {
            minDist = d;
            bestSnap = { x: w.start.x, y: w.start.y };
            snapSource = 'Wall Vertex';
          }
        }
        if (w.end) {
          const d = Math.hypot(w.end.x - mouse.x, w.end.y - mouse.y);
          if (d < minDist) {
            minDist = d;
            bestSnap = { x: w.end.x, y: w.end.y };
            snapSource = 'Wall Vertex';
          }
        }
      });
    } else if (mode === 'central') {
      const centerX = model.buildingLength / 2;
      const centerY = model.buildingWidth / 2;
      bestSnap = { x: centerX, y: centerY };
      snapSource = 'Center Structural Axis';
    } else if (mode === 'wall') {
      let minDist = snapThreshold;
      let bestPoint: Coordinate | null = null;

      walls.forEach(w => {
        if (!w.start || !w.end) return;
        const dx = w.end.x - w.start.x;
        const dy = w.end.y - w.start.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;

        const t = Math.max(0, Math.min(1, ((mouse.x - w.start.x) * dx + (mouse.y - w.start.y) * dy) / (len * len)));
        const projX = w.start.x + t * dx;
        const projY = w.start.y + t * dy;
        const d = Math.hypot(projX - mouse.x, projY - mouse.y);

        if (d < minDist) {
          minDist = d;
          bestPoint = { x: projX, y: projY };
        }
      });

      if (bestPoint) {
        bestSnap = bestPoint;
        snapSource = 'Wall Axis';
      }
    }

    const finalCoord = bestSnap || { x: snapToGrid(mouse.x), y: snapToGrid(mouse.y) };

    // Check collision with door or window openings
    const collision = checkPillarOpeningCollision(finalCoord, pillarWidth, pillarWdUnit, walls, model.buildingUnit);
    if (collision.hasConflict) {
      return { 
        valid: false, 
        coord: finalCoord, 
        message: collision.message || 'Warning: Pillar conflicts with door/window opening!' 
      };
    }

    return { 
      valid: true, 
      coord: finalCoord, 
      message: snapSource ? `Snapped: ${snapSource}` : (mode === 'custom' ? 'Custom Position' : 'Grid Position') 
    };
  };

  const updateActiveFloorPillar = (changes: Partial<Pillar>) => {
    if (!selectedPillarId) return;
    setModel(prev => ({
      ...prev,
      pillars: (prev.pillars || []).map(p => (p.floorId === activeFloorId && p.id === selectedPillarId) ? { ...p, ...changes } : p),
      floors: prev.floors.map(fl => fl.id === activeFloorId ? {
        ...fl,
        pillars: (fl.pillars || []).map(p => p.id === selectedPillarId ? { ...p, ...changes } : p)
      } : fl)
    }));
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    const coords = getMouseCoords(e);
    if (!coords) return;
    
    if (activeTool === 'wall' && drawingStart) {
      setCurrentMouse(coords);
    } else if (activeTool === 'pillar') {
      const snap = getPillarSnap(coords, pillarPlacement, allWalls);
      setPillarPreview(snap);
    }
  };

  const handleSvgClick = (e: React.MouseEvent) => {
    const coords = getMouseCoords(e);
    if (!coords || !activeFloor) return;

    if (activeTool === 'wall') {
      if (!drawingStart) {
        setDrawingStart(coords);
        setCurrentMouse(coords);
      } else {
        // Complete the wall
        const length = Math.hypot(coords.x - drawingStart.x, coords.y - drawingStart.y);
        if (length > 0) {
          const newWall: Wall = {
            id: `int-${activeFloorId}-${Date.now()}`,
            floorId: activeFloorId,
            name: `Partition ${activeFloor.internalWalls.length + 1}`,
            start: drawingStart,
            end: coords,
            dimensions: { length, height: activeFloor.height, thickness: internalWallThickness, unit: model.buildingUnit, thicknessUnit: 'in' },
            openings: []
          };
          const updatedFloors = model.floors.map(f => {
            if (f.id === activeFloor.id) return { ...f, internalWalls: [...f.internalWalls, newWall] };
            return f;
          });
          setModel({ ...model, floors: updatedFloors });
        }
        setDrawingStart(null);
        setCurrentMouse(null);
      }
    } else if (activeTool === 'pillar') {
      const snap = getPillarSnap(coords, pillarPlacement, allWalls);
      if (!snap.valid) {
         alert(snap.message || "Invalid placement: Pillar overlaps with an opening or is placed in an invalid location.");
         return;
      }
      
      const placeCoord = snap.coord || coords;
      
      // Find connected walls
      const convFactor = model.buildingUnit === 'ft' ? 1/12 : (model.buildingUnit === 'm' ? 0.0254 : 1);
      const snapDist = Math.max(pillarWidth, pillarDepth) * convFactor * 0.8;
      const connectedWallIds = allWalls.filter(w => {
        if (!w.start || !w.end) return false;
        const dS = Math.hypot(w.start.x - placeCoord.x, w.start.y - placeCoord.y);
        const dE = Math.hypot(w.end.x - placeCoord.x, w.end.y - placeCoord.y);
        return dS < snapDist || dE < snapDist;
      }).map(w => w.id);

      const colId = `col-${Date.now()}`;
      const newPillarsForFloors: Pillar[] = model.floors.map(fl => ({
        id: `pillar-${fl.id}-${Date.now()}`,
        name: pillarName,
        floorId: fl.id,
        verticalColumnId: colId,
        width: pillarWidth,
        depth: pillarShape === 'circular' ? pillarWidth : pillarDepth,
        height: fl.height,
        count: 1,
        unit: pillarWdUnit,
        position: placeCoord,
        placementType: pillarPlacement,
        alignment: pillarAlignment,
        shape: pillarShape,
        finish: pillarFinish,
        includeInEstimate: pillarIncludeEst,
        showRebar: pillarShowRebar,
        showBeam: pillarShowBeam,
        customOffsetX,
        customOffsetY,
        connectedWallIds: fl.id === activeFloorId ? connectedWallIds : []
      }));

      setModel(prev => ({
        ...prev,
        pillars: [...(prev.pillars || []), ...newPillarsForFloors],
        floors: prev.floors.map(fl => {
          const pForFloor = newPillarsForFloors.find(p => p.floorId === fl.id);
          return {
            ...fl,
            pillars: pForFloor ? [...(fl.pillars || []), pForFloor] : fl.pillars
          };
        })
      }));
      setPillarName(`P${(model.pillars?.filter(p => p.floorId === activeFloorId).length || 0) + 2}`);
    }
  };

  const handleWallClick = (e: React.MouseEvent, wall: Wall) => {
    e.stopPropagation(); // Prevent SVG click from firing
    if (!activeFloor || !wall.start || !wall.end) return;

    if (activeTool === 'delete') {
      const targetWallId = wall.id;
      const targetFloorId = activeFloorId;

      const updatedFloors = model.floors.map(f => {
        if (f.id === targetFloorId) {
          return {
            ...f,
            externalWalls: f.externalWalls.filter(w => w.id !== targetWallId),
            internalWalls: f.internalWalls.filter(w => w.id !== targetWallId)
          };
        }
        return f;
      });
      setModel(prev => ({ ...prev, floors: updatedFloors }));
      return;
    }

    if (activeTool === 'door' || activeTool === 'window') {
      const coords = getMouseCoords(e);
      if (!coords) return;
      
      const dist = Math.hypot(coords.x - wall.start.x, coords.y - wall.start.y);
      const isDoor = activeTool === 'door';
      const opW = isDoor ? doorWidth : windowWidth;
      const opH = isDoor ? doorHeight : windowHeight;

      const newOp: Opening = {
        id: `op-${activeFloorId}-${Date.now()}`,
        floorId: activeFloorId,
        wallId: wall.id,
        type: activeTool,
        width: opW,
        height: opH,
        count: 1,
        unit: model.buildingUnit,
        distanceFromStart: dist - (opW / 2), // center on click
        sillHeight: isDoor ? 0 : 3
      };

      const updatedFloors = model.floors.map(f => {
        if (f.id === activeFloorId) {
          return {
            ...f,
            externalWalls: f.externalWalls.map(w => w.id === wall.id ? { ...w, openings: [...w.openings, newOp] } : w),
            internalWalls: f.internalWalls.map(w => w.id === wall.id ? { ...w, openings: [...w.openings, newOp] } : w)
          };
        }
        return f;
      });
      setModel(prev => ({ ...prev, floors: updatedFloors }));
    }
  };

  const handleOpeningClick = (e: React.MouseEvent, wallId: string, opId: string) => {
    e.stopPropagation();
    if (activeTool === 'delete') {
      const targetFloorId = activeFloorId;
      const updatedFloors = model.floors.map(f => {
        if (f.id === targetFloorId) {
          return {
            ...f,
            externalWalls: f.externalWalls.map(w => w.id === wallId ? { ...w, openings: w.openings.filter(o => o.id !== opId) } : w),
            internalWalls: f.internalWalls.map(w => w.id === wallId ? { ...w, openings: w.openings.filter(o => o.id !== opId) } : w)
          };
        }
        return f;
      });
      setModel(prev => ({ ...prev, floors: updatedFloors }));
    }
  };

  const handleGenerate = () => {
    setBuildingModel(model);
    onGenerate();
  };

  const allWalls = activeFloor ? [...activeFloor.externalWalls, ...activeFloor.internalWalls] : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Interactive Wall & Pillar Editor</h2>
        <p className="mt-2 text-sm text-gray-600">
          Draw walls and place RCC columns with precise corner alignment to build a 100% physically accurate 3D model.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <h3 className="text-md font-medium text-gray-900 mb-3">Building Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-start">
          <div>
            <label className="block text-xs font-medium text-gray-700">Length ({model.buildingUnit})</label>
            <input 
              type="number" 
              value={model.buildingLength} 
              onChange={e => setModel(p => ({...p, buildingLength: Number(e.target.value)}))} 
              className="mt-1 block w-full px-2 py-1 rounded border border-gray-300 text-sm focus:ring-orange-500 focus:border-orange-500" 
            />
            {isManualMode && <span className="text-[10px] text-gray-400">Workspace reference</span>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Width ({model.buildingUnit})</label>
            <input 
              type="number" 
              value={model.buildingWidth} 
              onChange={e => setModel(p => ({...p, buildingWidth: Number(e.target.value)}))} 
              className="mt-1 block w-full px-2 py-1 rounded border border-gray-300 text-sm focus:ring-orange-500 focus:border-orange-500" 
            />
            {isManualMode && <span className="text-[10px] text-gray-400">Workspace reference</span>}
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Layout Mode</label>
            <div className="flex flex-col sm:flex-row gap-2 bg-gray-50 p-1.5 rounded border border-gray-200">
              <label className="flex items-center space-x-1.5 text-xs text-gray-800 cursor-pointer">
                <input 
                  type="radio" 
                  name="layoutMode" 
                  checked={!isManualMode} 
                  onChange={() => {
                    if (isManualMode) {
                      setConfirmModal({ isOpen: true, targetMode: 'auto' });
                    }
                  }} 
                  className="text-orange-600 focus:ring-orange-500 h-3.5 w-3.5"
                />
                <span className="font-medium">Auto Outer Layout</span>
              </label>
              <label className="flex items-center space-x-1.5 text-xs text-gray-800 cursor-pointer">
                <input 
                  type="radio" 
                  name="layoutMode" 
                  checked={isManualMode} 
                  onChange={() => {
                    if (!isManualMode) {
                      setConfirmModal({ isOpen: true, targetMode: 'manual' });
                    }
                  }} 
                  className="text-orange-600 focus:ring-orange-500 h-3.5 w-3.5"
                />
                <span className="font-medium">Manual Layout</span>
              </label>
            </div>
            {isManualMode && (
              <p className="mt-1 text-[11px] text-orange-600 font-medium">
                Manual Layout: Draw your own outer building walls on the grid.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Unit</label>
            <select 
              value={model.buildingUnit} 
              onChange={e => setModel(p => ({...p, buildingUnit: e.target.value as Unit}))} 
              className="mt-1 block w-full px-2 py-1.5 rounded border border-gray-300 bg-white text-sm focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="ft">Foot (ft)</option>
              <option value="m">Metre (m)</option>
              <option value="in">Inch (in)</option>
              <option value="cm">Centimetre (cm)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Floor Height ({model.buildingUnit})</label>
            <input 
              type="number" 
              value={activeFloor?.height || 10} 
              onChange={e => {
                const val = Number(e.target.value);
                setModel(p => ({
                  ...p,
                  floors: p.floors.map(f => {
                    if (f.id === activeFloorId) {
                      return { 
                        ...f, 
                        height: val,
                        externalWalls: f.externalWalls.map(w => ({...w, dimensions: {...w.dimensions, height: val}})),
                        internalWalls: f.internalWalls.map(w => ({...w, dimensions: {...w.dimensions, height: val}}))
                      };
                    }
                    return f;
                  })
                }));
              }} 
              className="mt-1 block w-full px-2 py-1 rounded border border-gray-300 text-sm focus:ring-orange-500 focus:border-orange-500" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Ext. Wall Thickness (in)</label>
            <input 
              type="number" 
              value={model.externalWallThickness || 9} 
              onChange={e => setModel(p => ({...p, externalWallThickness: Number(e.target.value)}))} 
              className="mt-1 block w-full px-2 py-1 rounded border border-gray-300 text-sm focus:ring-orange-500 focus:border-orange-500" 
            />
          </div>
        </div>
      </div>

      {/* FLOOR TABS */}
      <div className="flex border-b border-gray-200 overflow-x-auto overflow-y-hidden items-center">
        {model.floors.map((f, idx) => (
          <div
            key={f.id}
            className={cn(
              "flex items-center px-4 py-2 border-b-2 -mb-px transition-colors whitespace-nowrap",
              activeFloorId === f.id
                ? "border-orange-500"
                : "border-transparent hover:border-gray-300"
            )}
          >
            <button
              onClick={() => {
                setActiveFloorId(f.id);
                setSelectedPillarId(null);
                setDrawingStart(null);
                setCurrentMouse(null);
              }}
              className={cn(
                "text-sm font-medium",
                activeFloorId === f.id ? "text-orange-600" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {f.name}
            </button>
            {idx > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveFloor(f.id); }}
                className={cn(
                  "ml-2 rounded-full p-0.5 hover:bg-gray-200 transition-colors",
                  activeFloorId === f.id ? "text-orange-500" : "text-gray-400"
                )}
                title="Remove Floor"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleAddFloor}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center whitespace-nowrap"
        >
          + Add Floor
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 min-h-[600px]">
        
        {/* TOOLBOX */}
        <div className="w-full lg:w-64 flex flex-col space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-y-auto max-h-[700px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tools</span>
          </div>

          <button 
            onClick={() => { setActiveTool('wall'); setDrawingStart(null); }}
            className={cn("flex items-center space-x-2 px-3 py-2 rounded text-sm transition-colors", activeTool === 'wall' ? 'bg-orange-600 text-white' : 'hover:bg-gray-200 text-gray-700')}
          >
            <MousePointer2 className="w-4 h-4" /> <span>Draw Wall</span>
          </button>
          {activeTool === 'wall' && (
            <div className="pl-6 pb-2 pr-2">
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Thickness (in)</label>
              <input 
                type="number" 
                value={internalWallThickness} 
                onChange={e => setInternalWallThickness(Number(e.target.value))} 
                className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-orange-500 focus:border-orange-500" 
              />
            </div>
          )}
          <button 
            onClick={() => { setActiveTool('door'); setDrawingStart(null); }}
            className={cn("flex items-center space-x-2 px-3 py-2 rounded text-sm transition-colors", activeTool === 'door' ? 'bg-orange-600 text-white' : 'hover:bg-gray-200 text-gray-700')}
          >
            <DoorOpen className="w-4 h-4" /> <span>Place Door</span>
          </button>
          {activeTool === 'door' && (
            <div className="pl-6 pb-2 pr-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Width ({model.buildingUnit})</label>
                <input 
                  type="number" 
                  value={doorWidth} 
                  onChange={e => setDoorWidth(Number(e.target.value))} 
                  className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-orange-500 focus:border-orange-500" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Height ({model.buildingUnit})</label>
                <input 
                  type="number" 
                  value={doorHeight} 
                  onChange={e => setDoorHeight(Number(e.target.value))} 
                  className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-orange-500 focus:border-orange-500" 
                />
              </div>
            </div>
          )}
          <button 
            onClick={() => { setActiveTool('window'); setDrawingStart(null); }}
            className={cn("flex items-center space-x-2 px-3 py-2 rounded text-sm transition-colors", activeTool === 'window' ? 'bg-orange-600 text-white' : 'hover:bg-gray-200 text-gray-700')}
          >
            <LayoutGrid className="w-4 h-4" /> <span>Place Window</span>
          </button>
          {activeTool === 'window' && (
            <div className="pl-6 pb-2 pr-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Width ({model.buildingUnit})</label>
                <input 
                  type="number" 
                  value={windowWidth} 
                  onChange={e => setWindowWidth(Number(e.target.value))} 
                  className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-orange-500 focus:border-orange-500" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Height ({model.buildingUnit})</label>
                <input 
                  type="number" 
                  value={windowHeight} 
                  onChange={e => setWindowHeight(Number(e.target.value))} 
                  className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-orange-500 focus:border-orange-500" 
                />
              </div>
            </div>
          )}
          <button 
            onClick={() => { setActiveTool('pillar'); setDrawingStart(null); }}
            className={cn("flex items-center space-x-2 px-3 py-2 rounded text-sm transition-colors", activeTool === 'pillar' ? 'bg-orange-600 text-white' : 'hover:bg-gray-200 text-gray-700')}
          >
            <Square className="w-4 h-4" /> <span>Concrete Pillar (RCC)</span>
          </button>
          {activeTool === 'pillar' && (
            <div className="pl-3 py-3 pr-2 border-l-2 border-orange-500 ml-2 mb-2 bg-white rounded shadow-sm flex flex-col space-y-3">
              <div className="flex justify-between items-center border-b pb-1">
                <label className="block text-xs font-bold text-gray-800">
                  {selectedPillarId ? `Edit ${pillarName || 'Pillar'}` : "Pillar Properties"}
                </label>
                <button
                  type="button"
                  onClick={handleAutoGeneratePillars}
                  className="flex items-center px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded text-[10px] font-semibold transition-colors"
                  title="Automatically place structural columns at all corners, junctions, and central support"
                >
                  <Sparkles className="w-3 h-3 mr-1 text-amber-600" />
                  <span>Auto Grid</span>
                </button>
              </div>
              
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Name / ID</label>
                <input 
                  type="text" 
                  value={pillarName} 
                  onChange={e => {
                    const val = e.target.value;
                    setPillarName(val);
                    updateActiveFloorPillar({ name: val });
                  }} 
                  className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-orange-500" 
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Shape</label>
                <select 
                  value={pillarShape} 
                  onChange={e => {
                    const val = e.target.value as any;
                    setPillarShape(val);
                    updateActiveFloorPillar({ shape: val, depth: val === 'circular' ? pillarWidth : pillarDepth });
                  }} 
                  className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-orange-500"
                >
                  <option value="square">Square</option>
                  <option value="rectangle">Rectangle</option>
                  <option value="circular">Circular</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Width (in)</label>
                  <input 
                    type="number" 
                    value={pillarWidth} 
                    onChange={e => {
                      const val = Number(e.target.value);
                      setPillarWidth(val);
                      updateActiveFloorPillar({ width: val, depth: pillarShape === 'circular' ? val : pillarDepth });
                    }} 
                    className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-orange-500" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Depth (in)</label>
                  <input 
                    type="number" 
                    value={pillarDepth} 
                    onChange={e => {
                      const val = Number(e.target.value);
                      setPillarDepth(val);
                      updateActiveFloorPillar({ depth: val });
                    }} 
                    disabled={pillarShape === 'circular'} 
                    className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-orange-500 disabled:bg-gray-100" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Height ({model.buildingUnit})</label>
                <input 
                  type="number" 
                  value={pillarHeight} 
                  onChange={e => {
                    const val = Number(e.target.value);
                    setPillarHeight(val);
                    updateActiveFloorPillar({ height: val });
                  }} 
                  className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-orange-500" 
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Placement Snap</label>
                <select 
                  value={pillarPlacement} 
                  onChange={e => {
                    const val = e.target.value as any;
                    setPillarPlacement(val);
                    updateActiveFloorPillar({ placementType: val });
                  }} 
                  className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-orange-500"
                >
                  <option value="corner">Corner Snap</option>
                  <option value="wall_joint">Wall Joint</option>
                  <option value="wall_end">End of Wall</option>
                  <option value="central">Central Structural Support</option>
                  <option value="wall">Mid-Wall</option>
                  <option value="custom">Custom Position</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Corner Alignment</label>
                <select 
                  value={pillarAlignment} 
                  onChange={e => {
                    const val = e.target.value as any;
                    setPillarAlignment(val);
                    updateActiveFloorPillar({ alignment: val });
                  }} 
                  className="block w-full px-2 py-1 rounded border border-gray-300 text-xs font-medium text-gray-800 focus:ring-orange-500"
                >
                  <option value="outside_corner">Outside Corner (Recommended)</option>
                  <option value="centre">Centre on Wall Junction</option>
                  <option value="inside_corner">Inside Corner (Room)</option>
                  <option value="flush_exterior">Flush with Exterior Face</option>
                  <option value="flush_interior">Flush with Interior Face</option>
                  <option value="custom_offset">Custom Offset</option>
                </select>
              </div>

              {pillarAlignment === 'custom_offset' && (
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded">
                  <div>
                    <label className="block text-[9px] text-gray-500">Offset X ({model.buildingUnit})</label>
                    <input 
                      type="number" 
                      value={customOffsetX} 
                      onChange={e => {
                        const val = Number(e.target.value);
                        setCustomOffsetX(val);
                        updateActiveFloorPillar({ customOffsetX: val });
                      }} 
                      className="block w-full px-1.5 py-0.5 text-xs border rounded" 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-500">Offset Y ({model.buildingUnit})</label>
                    <input 
                      type="number" 
                      value={customOffsetY} 
                      onChange={e => {
                        const val = Number(e.target.value);
                        setCustomOffsetY(val);
                        updateActiveFloorPillar({ customOffsetY: val });
                      }} 
                      className="block w-full px-1.5 py-0.5 text-xs border rounded" 
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5 pt-1 border-t">
                <label className="flex items-center space-x-2 text-[10px] text-gray-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={pillarIncludeEst} 
                    onChange={e => {
                      const val = e.target.checked;
                      setPillarIncludeEst(val);
                      updateActiveFloorPillar({ includeInEstimate: val });
                    }} 
                    className="rounded text-orange-600 focus:ring-orange-500" 
                  />
                  <span>Include in Estimate</span>
                </label>
                <label className="flex items-center space-x-2 text-[10px] text-blue-700 font-medium cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={pillarShowRebar} 
                    onChange={e => {
                      const val = e.target.checked;
                      setPillarShowRebar(val);
                      updateActiveFloorPillar({ showRebar: val });
                    }} 
                    className="rounded text-blue-600 focus:ring-blue-500" 
                  />
                  <span>Exposed Rebar Preview</span>
                </label>
                <label className="flex items-center space-x-2 text-[10px] text-purple-700 font-medium cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={pillarShowBeam} 
                    onChange={e => {
                      const val = e.target.checked;
                      setPillarShowBeam(val);
                      updateActiveFloorPillar({ showBeam: val });
                    }} 
                    className="rounded text-purple-600 focus:ring-purple-500" 
                  />
                  <span>RCC Tie Beam Preview</span>
                </label>
              </div>
            </div>
          )}
          <button 
            onClick={() => { setActiveTool('beam'); setDrawingStart(null); }}
            className={cn("flex items-center space-x-2 px-3 py-2 rounded text-sm transition-colors", activeTool === 'beam' ? 'bg-purple-600 text-white' : 'hover:bg-gray-200 text-gray-700')}
          >
            <Layers className="w-4 h-4" /> <span>RCC Ring Beam</span>
          </button>
          {activeTool === 'beam' && (
            <div className="pl-3 py-3 pr-2 border-l-2 border-purple-500 ml-2 mb-2 bg-white rounded shadow-sm flex flex-col space-y-3">
              <div className="flex justify-between items-center border-b pb-1">
                <label className="block text-xs font-bold text-gray-800">RCC Ring Beam Config</label>
                <span className="text-[10px] text-purple-600 font-medium">
                  {beamEnabled && !fullBeamEnabled ? "Active (Top Open)" : "Inactive"}
                </span>
              </div>

              <label className="flex items-center space-x-2 text-xs text-gray-800 font-semibold cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={beamEnabled && !fullBeamEnabled} 
                  onChange={e => handleBeamToggle(e.target.checked)} 
                  className="rounded text-purple-600 focus:ring-purple-500" 
                />
                <span>Enable RCC Ring Beam</span>
              </label>
              
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Height (ft)</label>
                <input 
                  type="number" 
                  min="0.5" 
                  max="10" 
                  step="0.5" 
                  value={beamHeight} 
                  onChange={e => handleBeamChange(Number(e.target.value), beamWidth, beamDepth)} 
                  className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-purple-500 font-semibold text-purple-900" 
                />
                <span className="text-[9px] text-gray-400">Additive perimeter beam above 10ft brick wall (Top remains open)</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Width (in)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="36" 
                    value={beamWidth} 
                    onChange={e => handleBeamChange(beamHeight, Number(e.target.value), beamDepth)} 
                    className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-purple-500" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Depth (in)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="36" 
                    value={beamDepth} 
                    onChange={e => handleBeamChange(beamHeight, beamWidth, Number(e.target.value))} 
                    className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-purple-500" 
                  />
                </div>
              </div>

              <div className="bg-purple-50 text-purple-800 p-2 rounded text-[10px] leading-relaxed border border-purple-200">
                <b>Structural Height:</b><br/>
                Brick Wall = <b>10 ft</b><br/>
                RCC Beam = <b>+{beamHeight} ft</b> (Perimeter only, Top = OPEN)<br/>
                Total Wall+Beam = <b>{10 + beamHeight} ft</b>
              </div>
            </div>
          )}

          <button 
            onClick={() => { setActiveTool('fullRingBeam'); setDrawingStart(null); }}
            className={cn("flex items-center space-x-2 px-3 py-2 rounded text-sm transition-colors", activeTool === 'fullRingBeam' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-200 text-gray-700')}
          >
            <Box className="w-4 h-4" /> <span>RCC Full Ring Beam</span>
          </button>
          {activeTool === 'fullRingBeam' && (
            <div className="pl-3 py-3 pr-2 border-l-2 border-indigo-500 ml-2 mb-2 bg-white rounded shadow-sm flex flex-col space-y-3">
              <div className="flex justify-between items-center border-b pb-1">
                <label className="block text-xs font-bold text-gray-800">RCC Full Ring Beam</label>
                <span className="text-[10px] text-indigo-600 font-medium">
                  {fullBeamEnabled ? "Active (Top Closed)" : "Inactive"}
                </span>
              </div>
              
              <label className="flex items-center space-x-2 text-xs text-gray-800 font-semibold cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={fullBeamEnabled} 
                  onChange={e => handleFullBeamToggle(e.target.checked)} 
                  className="rounded text-indigo-600 focus:ring-indigo-500" 
                />
                <span>Enable RCC Full Ring Beam</span>
              </label>

              {fullBeamEnabled && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1">Thickness (ft)</label>
                  <input 
                    type="number" 
                    min="0.1" 
                    max="10" 
                    step="0.5" 
                    value={fullBeamThickness} 
                    onChange={e => handleFullBeamThicknessChange(Number(e.target.value))} 
                    className="block w-full px-2 py-1 rounded border border-gray-300 text-xs focus:ring-indigo-500 font-bold text-indigo-900" 
                  />
                  <span className="text-[9px] text-gray-400">Solid concrete top completely closing floor opening</span>
                </div>
              )}

              <div className="bg-indigo-50 text-indigo-900 p-2 rounded text-[10px] leading-relaxed border border-indigo-200">
                <b>Floor Structural Top:</b><br/>
                • Brick Wall: <b>10 ft</b><br/>
                • RCC Full Ring Beam: <b>{fullBeamEnabled ? `+${fullBeamThickness} ft (Solid Top Closed)` : 'OFF'}</b><br/>
                • Normal Ring Beam: <b>{fullBeamEnabled ? 'Suppressed (Hidden)' : (beamEnabled ? `Active (+${beamHeight} ft)` : 'OFF')}</b><br/>
                • Total Floor Height: <b>{fullBeamEnabled ? 10 + fullBeamThickness : (beamEnabled ? 10 + beamHeight : 10)} ft</b>
              </div>
            </div>
          )}

          <button 
            onClick={() => { setActiveTool('foundation'); setDrawingStart(null); }}
            className={cn("flex items-center space-x-2 px-3 py-2 rounded text-sm transition-colors", activeTool === 'foundation' ? 'bg-amber-600 text-white' : 'hover:bg-gray-200 text-gray-700')}
          >
            <LandPlot className="w-4 h-4" /> <span>Foundation / Base</span>
          </button>
          {activeTool === 'foundation' && (
            <div className="pl-3 py-3 pr-2 border-l-2 border-amber-500 ml-2 mb-2 bg-white rounded shadow-sm flex flex-col space-y-3 max-h-[480px] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-1">
                <label className="block text-xs font-bold text-gray-800">Ground Floor Foundation</label>
                <span className="text-[10px] text-amber-700 font-semibold px-1.5 py-0.5 bg-amber-50 rounded">
                  IS 1080 / 456
                </span>
              </div>

              {!isGroundFloor ? (
                <div className="bg-amber-50 text-amber-800 p-2.5 rounded text-[11px] leading-relaxed border border-amber-200">
                  <div className="font-bold flex items-center gap-1 text-amber-900 mb-1">
                    <Info className="w-3.5 h-3.5" /> Sub-grade Construction
                  </div>
                  Foundation belongs <b>strictly below Ground Floor</b>. Switch to Ground Floor to view & configure structural footings.
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAutoGenerateFoundations}
                      className="flex-1 py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded shadow-sm flex items-center justify-center gap-1 transition-colors"
                      title="Align & generate isolated RCC footings + PCC base for all Ground Floor pillars"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto Generate Foundations</span>
                    </button>
                  </div>

                  {/* Footing Selection Pills */}
                  {(model.foundation?.footings && model.foundation.footings.length > 0) && (
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-600 mb-1">
                        Select Footing ({model.foundation.footings.length} Active):
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {model.foundation.footings.map(f => (
                          <button
                            key={f.id}
                            onClick={() => setSelectedFootingId(selectedFootingId === f.id ? null : f.id)}
                            className={cn(
                              "px-2 py-1 rounded text-[10px] font-bold border transition-colors",
                              selectedFootingId === f.id 
                                ? "bg-amber-600 text-white border-amber-700" 
                                : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                            )}
                          >
                            {f.pillarName || f.id}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedFooting ? (
                    <div className="space-y-2 bg-amber-50/50 p-2.5 rounded border border-amber-200 text-xs">
                      <div className="flex justify-between items-center font-bold text-gray-800 border-b border-amber-200 pb-1">
                        <span>{selectedFooting.pillarName ? `${selectedFooting.pillarName} Footing` : selectedFooting.id}</span>
                        <button 
                          onClick={() => handleDeleteFooting(selectedFooting.id)} 
                          className="text-red-600 hover:text-red-800 text-[10px] font-semibold flex items-center gap-0.5"
                          title="Delete only this foundation footing (keeps pillar)"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <div>
                          <label className="block text-[9px] font-medium text-gray-600">Length ({selectedFooting.footingUnit})</label>
                          <input 
                            type="number" step="0.5" min="1" max="20"
                            value={selectedFooting.footingLength}
                            onChange={e => handleUpdateFooting(selectedFooting.id, { 
                              footingLength: Number(e.target.value),
                              pccLength: Number(e.target.value) + 1,
                              excavationLength: Number(e.target.value) + 2
                            })}
                            className="block w-full px-1.5 py-1 text-xs border rounded bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-medium text-gray-600">Width ({selectedFooting.footingUnit})</label>
                          <input 
                            type="number" step="0.5" min="1" max="20"
                            value={selectedFooting.footingWidth}
                            onChange={e => handleUpdateFooting(selectedFooting.id, { 
                              footingWidth: Number(e.target.value),
                              pccWidth: Number(e.target.value) + 1,
                              excavationWidth: Number(e.target.value) + 2
                            })}
                            className="block w-full px-1.5 py-1 text-xs border rounded bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-medium text-gray-600">Depth ({selectedFooting.footingUnit})</label>
                          <input 
                            type="number" step="0.25" min="0.5" max="10"
                            value={selectedFooting.footingDepth}
                            onChange={e => handleUpdateFooting(selectedFooting.id, { footingDepth: Number(e.target.value) })}
                            className="block w-full px-1.5 py-1 text-xs border rounded bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <div>
                          <label className="block text-[9px] font-medium text-gray-600">PCC Thick ({selectedFooting.pccUnit})</label>
                          <input 
                            type="number" step="0.1" min="0.2" max="2"
                            value={selectedFooting.pccThickness}
                            onChange={e => handleUpdateFooting(selectedFooting.id, { pccThickness: Number(e.target.value) })}
                            className="block w-full px-1.5 py-1 text-xs border rounded bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-medium text-gray-600">Sand Fill ({selectedFooting.sandFillUnit})</label>
                          <input 
                            type="number" step="0.1" min="0.2" max="3"
                            value={selectedFooting.sandFillDepth}
                            onChange={e => handleUpdateFooting(selectedFooting.id, { sandFillDepth: Number(e.target.value) })}
                            className="block w-full px-1.5 py-1 text-xs border rounded bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-medium text-gray-600">Excavation ({selectedFooting.excavationUnit})</label>
                          <input 
                            type="number" step="0.5" min="1" max="15"
                            value={selectedFooting.excavationDepth}
                            onChange={e => handleUpdateFooting(selectedFooting.id, { excavationDepth: Number(e.target.value) })}
                            className="block w-full px-1.5 py-1 text-xs border rounded bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200">
                        <div>
                          <label className="block text-[9px] font-medium text-gray-600">Main Steel (Count × Dia)</label>
                          <div className="flex gap-1 items-center">
                            <input 
                              type="number" min="2" max="30"
                              value={selectedFooting.rebar?.mainBarCount || 6}
                              onChange={e => handleUpdateFooting(selectedFooting.id, {
                                rebar: { ...(selectedFooting.rebar || { mainBarDiaMm: 12, distBarDiaMm: 12, distBarCount: 6, coverMm: 50 }), mainBarCount: Number(e.target.value) }
                              })}
                              className="w-12 px-1 py-0.5 text-xs border rounded bg-white"
                            />
                            <span className="text-[10px]">×</span>
                            <input 
                              type="number" min="8" max="32" step="2"
                              value={selectedFooting.rebar?.mainBarDiaMm || 12}
                              onChange={e => handleUpdateFooting(selectedFooting.id, {
                                rebar: { ...(selectedFooting.rebar || { mainBarCount: 6, distBarDiaMm: 12, distBarCount: 6, coverMm: 50 }), mainBarDiaMm: Number(e.target.value) }
                              })}
                              className="w-12 px-1 py-0.5 text-xs border rounded bg-white"
                            />
                            <span className="text-[9px] text-gray-500">mm</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] font-medium text-gray-600">Dist Steel (Count × Dia)</label>
                          <div className="flex gap-1 items-center">
                            <input 
                              type="number" min="2" max="30"
                              value={selectedFooting.rebar?.distBarCount || 6}
                              onChange={e => handleUpdateFooting(selectedFooting.id, {
                                rebar: { ...(selectedFooting.rebar || { mainBarDiaMm: 12, mainBarCount: 6, distBarDiaMm: 12, coverMm: 50 }), distBarCount: Number(e.target.value) }
                              })}
                              className="w-12 px-1 py-0.5 text-xs border rounded bg-white"
                            />
                            <span className="text-[10px]">×</span>
                            <input 
                              type="number" min="8" max="32" step="2"
                              value={selectedFooting.rebar?.distBarDiaMm || 12}
                              onChange={e => handleUpdateFooting(selectedFooting.id, {
                                rebar: { ...(selectedFooting.rebar || { mainBarDiaMm: 12, mainBarCount: 6, distBarCount: 6, coverMm: 50 }), distBarDiaMm: Number(e.target.value) }
                              })}
                              className="w-12 px-1 py-0.5 text-xs border rounded bg-white"
                            />
                            <span className="text-[9px] text-gray-500">mm</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-medium text-gray-600">PCC Mix</label>
                          <select
                            value={selectedFooting.pccMixRatio || '1:4:8'}
                            onChange={e => handleUpdateFooting(selectedFooting.id, { pccMixRatio: e.target.value as any })}
                            className="block w-full px-1.5 py-0.5 text-xs border rounded bg-white"
                          >
                            <option value="1:4:8">1:4:8 (Standard Lean)</option>
                            <option value="1:3:6">1:3:6 (Stronger Base)</option>
                            <option value="1:2:4">1:2:4 (M15 PCC)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-medium text-gray-600">RCC Footing Grade</label>
                          <select
                            value={selectedFooting.footingMixRatio || '1:1.5:3'}
                            onChange={e => handleUpdateFooting(selectedFooting.id, { footingMixRatio: e.target.value as any, concreteGrade: e.target.value === '1:1.5:3' ? 'M20' : 'M15' })}
                            className="block w-full px-1.5 py-0.5 text-xs border rounded bg-white"
                          >
                            <option value="1:1.5:3">M20 (1:1.5:3)</option>
                            <option value="1:2:4">M15 (1:2:4)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-500 italic p-2 bg-gray-50 rounded">
                      Click any footing on the 2D canvas or select a button above to inspect and customize its parameters.
                    </div>
                  )}

                  <div className="bg-amber-50 text-amber-900 p-2 rounded text-[9px] leading-relaxed border border-amber-200">
                    <b>Structural Safety Warning:</b><br/>
                    Foundation dimensions, reinforcement and bearing capacity must be verified by a qualified structural engineer using actual site soil investigation data.
                  </div>
                </>
              )}
            </div>
          )}

          <button 
            onClick={() => { setActiveTool('delete'); setDrawingStart(null); }}
            className={cn("flex items-center space-x-2 px-3 py-2 rounded text-sm transition-colors mt-2", activeTool === 'delete' ? 'bg-red-600 text-white' : 'hover:bg-gray-200 text-gray-700')}
          >
            <Trash2 className="w-4 h-4" /> <span>Delete</span>
          </button>

          <div className="mt-auto text-xs text-gray-500 italic p-2 bg-gray-100 rounded">
            {activeTool === 'wall' && "Click to start wall, click again to finish."}
            {activeTool === 'door' && "Hover and click on a wall to place a door."}
            {activeTool === 'window' && "Hover and click on a wall to place a window."}
            {activeTool === 'pillar' && "Click corner/grid to place solid RCC column."}
            {activeTool === 'beam' && "Configure additive RCC ring beam height and dimensions (Top remains open)."}
            {activeTool === 'fullRingBeam' && "Configure solid RCC concrete top to completely close floor top."}
            {activeTool === 'foundation' && "Inspect and configure Ground Floor structural footings, PCC & excavation."}
            {activeTool === 'delete' && "Click on a wall, opening, or RCC pillar to delete it."}
          </div>
          {activeTool === 'pillar' && pillarPreview.message && (
             <div className={cn("mt-2 text-[10px] p-2 rounded border font-medium", pillarPreview.valid ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
                {pillarPreview.message}
             </div>
          )}
        </div>

        {/* INTERACTIVE CANVAS */}
        <div className="flex-1 bg-gray-50 border border-gray-300 rounded-lg overflow-hidden relative shadow-inner cursor-crosshair">
          <svg 
            ref={svgRef}
            viewBox={`-20 -20 ${model.buildingLength + 40} ${model.buildingWidth + 40}`} 
            className="w-full h-full" 
            preserveAspectRatio="xMidYMid meet"
            onClick={handleSvgClick}
            onMouseMove={handleSvgMouseMove}
          >
            <g transform={`scale(1, -1) translate(0, -${model.buildingWidth})`}>
              {/* Plot Boundary (Light Green) */}
              <rect x={-20} y={-20} width={model.buildingLength + 40} height={model.buildingWidth + 40} fill="#f0fdf4" />

              {/* Building Boundary Highlight (Main House Area) */}
              <rect x={0} y={0} width={model.buildingLength} height={model.buildingWidth} fill="#ffffff" stroke="#fcd34d" strokeWidth="0.3" strokeDasharray="2,2" />

              {/* Grid Lines (1ft marks) & X-Axis Labels */}
              {Array.from({length: Math.ceil(model.buildingLength) + 41}).map((_, idx) => {
                const i = idx - 20; // range from -20 to Length + 20
                return (
                  <g key={`gx-${i}`}>
                    <line x1={i} y1={-20} x2={i} y2={model.buildingWidth + 20} stroke={i % 5 === 0 ? "#d1d5db" : "#e5e7eb"} strokeWidth={i % 5 === 0 ? "0.2" : "0.1"} />
                    {i % 5 === 0 && (
                      <text transform={`translate(${i}, -21.5) scale(1, -1)`} fontSize="1.2" fill="#9ca3af" textAnchor="middle">{i}'</text>
                    )}
                    {/* Top labels */}
                    {i % 5 === 0 && (
                      <text transform={`translate(${i}, ${model.buildingWidth + 20.5}) scale(1, -1)`} fontSize="1.2" fill="#9ca3af" textAnchor="middle">{i}'</text>
                    )}
                  </g>
                );
              })}
              
              {/* Grid Lines (1ft marks) & Y-Axis Labels */}
              {Array.from({length: Math.ceil(model.buildingWidth) + 41}).map((_, idx) => {
                const i = idx - 20; // range from -20 to Width + 20
                return (
                  <g key={`gy-${i}`}>
                    <line x1={-20} y1={i} x2={model.buildingLength + 20} y2={i} stroke={i % 5 === 0 ? "#d1d5db" : "#e5e7eb"} strokeWidth={i % 5 === 0 ? "0.2" : "0.1"} />
                    {i % 5 === 0 && (
                      <text transform={`translate(-21, ${i}) scale(1, -1)`} fontSize="1.2" fill="#9ca3af" alignmentBaseline="middle" textAnchor="end">{i}'</text>
                    )}
                    {/* Right labels */}
                    {i % 5 === 0 && (
                      <text transform={`translate(${model.buildingLength + 21}, ${i}) scale(1, -1)`} fontSize="1.2" fill="#9ca3af" alignmentBaseline="middle" textAnchor="start">{i}'</text>
                    )}
                  </g>
                );
              })}

              {/* External Walls with Geometric Segmentation against Pillars */}
              {activeFloor?.externalWalls.map(w => {
                 const floorPillars = (model.pillars || []).filter(p => p.floorId === activeFloorId);
                 const segments = splitWallByPillars(w, floorPillars, model.buildingUnit);
                 const tInches = w.dimensions?.thickness || model.externalWallThickness || 9;
                 const tFeet = convertUnit(tInches, 'in', model.buildingUnit);

                 return (
                 <g key={w.id} onClick={(e) => handleWallClick(e, w)} className={activeTool !== 'wall' ? "cursor-pointer" : ""}>
                    {segments.map((seg, sIdx) => (
                      <line 
                        key={`${w.id}-seg-${sIdx}`}
                        x1={seg.start.x} y1={seg.start.y} x2={seg.end.x} y2={seg.end.y} 
                        stroke="#991b1b" strokeWidth={tFeet} strokeLinecap="butt" 
                        className={activeTool !== 'wall' ? "hover:stroke-red-500 transition-colors" : ""}
                      />
                    ))}
                 </g>
                 );
              })}

              {/* Internal / Custom Walls with Geometric Segmentation against Pillars */}
              {activeFloor?.internalWalls.map(w => {
                 const floorPillars = (model.pillars || []).filter(p => p.floorId === activeFloorId);
                 const segments = splitWallByPillars(w, floorPillars, model.buildingUnit);
                 const tInches = w.dimensions?.thickness || 4.5;
                 const tFeet = convertUnit(tInches, 'in', model.buildingUnit);

                 return (
                 <g key={w.id} onClick={(e) => handleWallClick(e, w)} className={activeTool !== 'wall' ? "cursor-pointer" : ""}>
                    {segments.map((seg, sIdx) => (
                      <line 
                        key={`${w.id}-seg-${sIdx}`}
                        x1={seg.start.x} y1={seg.start.y} x2={seg.end.x} y2={seg.end.y} 
                        stroke="#b91c1c" strokeWidth={tFeet} strokeLinecap="butt" 
                        className={activeTool !== 'wall' ? "hover:stroke-red-400 transition-colors" : ""}
                      />
                    ))}
                 </g>
                 );
              })}

              {/* Live Drawing Wall */}
              {activeTool === 'wall' && drawingStart && currentMouse && (
                  <line 
                      x1={drawingStart.x} y1={drawingStart.y} 
                      x2={currentMouse.x} y2={currentMouse.y} 
                      stroke="orange" strokeWidth={internalWallThickness / 12} strokeDasharray="0.5,0.5" 
                  />
              )}

              {/* Openings */}
              {allWalls.map(w => {
                const dx = w.end!.x - w.start!.x;
                const dy = w.end!.y - w.start!.y;
                const length = Math.hypot(dx, dy);
                if (length === 0) return null;
                const nx = dx / length;
                const ny = dy / length;

                return w.openings?.map(op => {
                  const dist = op.distanceFromStart || 0;
                  const cx = w.start!.x + nx * (dist + op.width/2);
                  const cy = w.start!.y + ny * (dist + op.width/2);
                  return (
                    <circle 
                        key={op.id} cx={cx} cy={cy} r={0.8} 
                        fill={op.type === 'door' ? '#2563eb' : '#0891b2'} 
                        onClick={(e) => handleOpeningClick(e, w.id, op.id)}
                        className={activeTool === 'delete' ? "cursor-pointer hover:fill-red-500" : ""}
                    />
                  )
                });
              })}
              
              {/* Pillar Live Preview */}
              {activeTool === 'pillar' && currentMouse && (
                 <g className="pointer-events-none opacity-75">
                    {(() => {
                       const pos = pillarPreview.coord || currentMouse;
                       const dummyPillar: Pillar = {
                         id: 'preview',
                         width: pillarWidth,
                         depth: pillarDepth,
                         height: pillarHeight,
                         count: 1,
                         unit: pillarWdUnit,
                         position: pos,
                         alignment: pillarAlignment,
                         shape: pillarShape
                       };
                       const effPos = getEffectivePillarPosition(dummyPillar, allWalls, model.buildingUnit);
                       const drawW = convertUnit(pillarWidth, pillarWdUnit, model.buildingUnit);
                       const drawD = convertUnit(pillarShape === 'circular' ? pillarWidth : pillarDepth, pillarWdUnit, model.buildingUnit);
                       const strokeColor = pillarPreview.valid ? "#22c55e" : "#ef4444";
                       
                       return (
                         <g>
                           {pillarShape === 'circular' ? (
                             <circle cx={effPos.x} cy={effPos.y} r={Math.max(drawW, drawD) / 2} fill="#64748b" stroke={strokeColor} strokeWidth="0.2" />
                           ) : (
                             <rect x={effPos.x - drawW / 2} y={effPos.y - drawD / 2} width={drawW} height={drawD} fill="#64748b" stroke={strokeColor} strokeWidth="0.2" />
                           )}
                           {/* Alignment direction center marker */}
                           <circle cx={pos.x} cy={pos.y} r={0.25} fill={strokeColor} />
                         </g>
                       );
                    })()}
                 </g>
              )}

              {/* Ground Floor Foundation Footings Rendering (PCC Base + RCC Footing) */}
              {isGroundFloor && (model.foundation?.footings || []).map(f => {
                const pccW = convertUnit(f.pccWidth || 5, f.pccUnit || model.buildingUnit, model.buildingUnit);
                const pccL = convertUnit(f.pccLength || 5, f.pccUnit || model.buildingUnit, model.buildingUnit);
                const fW = convertUnit(f.footingWidth || 4, f.footingUnit || model.buildingUnit, model.buildingUnit);
                const fL = convertUnit(f.footingLength || 4, f.footingUnit || model.buildingUnit, model.buildingUnit);
                const posX = f.position?.x ?? 0;
                const posY = f.position?.y ?? 0;
                const isSelected = selectedFootingId === f.id;
                const isDeleteMode = activeTool === 'delete';

                return (
                  <g 
                    key={`footing-svg-${f.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isDeleteMode) {
                        handleDeleteFooting(f.id);
                      } else {
                        setSelectedFootingId(isSelected ? null : f.id);
                        setActiveTool('foundation');
                      }
                    }}
                    className="cursor-pointer group"
                  >
                    {/* PCC Lean Concrete Layer (Outer Dashed Outline) */}
                    <rect 
                      x={posX - pccL / 2} 
                      y={posY - pccW / 2} 
                      width={pccL} 
                      height={pccW} 
                      fill="#e2e8f0" 
                      fillOpacity="0.45"
                      stroke="#94a3b8" 
                      strokeWidth="0.15" 
                      strokeDasharray="0.6,0.3"
                      className="group-hover:stroke-amber-400 transition-colors"
                    />
                    {/* RCC Footing Body (Inner Solid Outline) */}
                    <rect 
                      x={posX - fL / 2} 
                      y={posY - fW / 2} 
                      width={fL} 
                      height={fW} 
                      fill={isSelected ? "#fed7aa" : "#e0e7ff"} 
                      fillOpacity={isSelected ? "0.75" : "0.55"}
                      stroke={isSelected ? "#ea580c" : (isDeleteMode ? "#f87171" : "#818cf8")} 
                      strokeWidth={isSelected ? "0.3" : "0.15"}
                      className={isDeleteMode ? "hover:fill-red-200 transition-colors" : "hover:stroke-amber-600 transition-colors"}
                    />
                    {/* Footing Identification Label */}
                    <text 
                      x={posX} 
                      y={posY - fW / 2 - 0.4} 
                      transform={`scale(1, -1) translate(0, ${-(posY - fW / 2 - 0.4) * 2})`}
                      textAnchor="middle" 
                      fontSize="0.4" 
                      fill={isSelected ? "#c2410c" : "#4338ca"} 
                      fontWeight="bold"
                      className="pointer-events-none select-none font-mono"
                    >
                      {f.pillarName || f.id} ({f.footingLength}'×{f.footingWidth}')
                    </text>
                  </g>
                );
              })}

              {/* Concrete Pillars Rendering (Floor-Scoped) */}
              {(model.pillars || []).filter(p => p.position && p.floorId === activeFloorId).map(p => {
                const effPos = getEffectivePillarPosition(p, allWalls, model.buildingUnit);
                const drawW = convertUnit(p.width, p.unit, model.buildingUnit);
                const drawD = convertUnit(p.depth, p.unit, model.buildingUnit);
                const isSelected = selectedPillarId === p.id;
                const isDeleteMode = activeTool === 'delete';

                return (
                  <g 
                    key={p.id} 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isDeleteMode) {
                        const targetId = p.id;
                        setModel(prev => ({ 
                          ...prev, 
                          pillars: (prev.pillars || []).filter(pil => !(pil.floorId === activeFloorId && pil.id === targetId)),
                          floors: prev.floors.map(fl => fl.id === activeFloorId ? {
                            ...fl,
                            pillars: (fl.pillars || []).filter(pil => pil.id !== targetId)
                          } : fl),
                          foundation: prev.foundation ? {
                            ...prev.foundation,
                            footings: prev.foundation.footings.filter(f => f.pillarId !== targetId)
                          } : undefined
                        }));
                        if (selectedPillarId === targetId) setSelectedPillarId(null);
                      } else {
                        const willSelect = !isSelected;
                        setSelectedPillarId(willSelect ? p.id : null);
                        if (willSelect) {
                          setPillarName(p.name || '');
                          setPillarShape(p.shape || 'square');
                          setPillarWidth(p.width);
                          setPillarDepth(p.depth);
                          setPillarHeight(p.height);
                          setPillarWdUnit(p.unit);
                          setPillarPlacement(p.placementType || 'corner');
                          setPillarAlignment(p.alignment || 'outside_corner');
                          setPillarFinish(p.finish || 'raw');
                          setPillarIncludeEst(p.includeInEstimate !== false);
                          setPillarShowRebar(!!p.showRebar);
                          setPillarShowBeam(!!p.showBeam);
                          setCustomOffsetX(p.customOffsetX || 0);
                          setCustomOffsetY(p.customOffsetY || 0);
                        }
                      }
                    }}
                    className="cursor-pointer group"
                  >
                    {p.shape === 'circular' ? (
                      <circle
                        cx={effPos.x} cy={effPos.y} r={Math.max(drawW, drawD) / 2}
                        fill={isDeleteMode ? "#ef4444" : (isSelected ? "#0284c7" : "#475569")} 
                        stroke={isDeleteMode ? "#f87171" : (isSelected ? "#38bdf8" : "#1e293b")} 
                        strokeWidth={isSelected || isDeleteMode ? "0.25" : "0.15"}
                        className={isDeleteMode ? "hover:fill-red-700 transition-colors" : "hover:fill-slate-600 transition-colors"}
                      />
                    ) : (
                      <rect 
                        x={effPos.x - drawW / 2} y={effPos.y - drawD / 2}
                        width={drawW} height={drawD}
                        fill={isDeleteMode ? "#ef4444" : (isSelected ? "#0284c7" : "#475569")} 
                        stroke={isDeleteMode ? "#f87171" : (isSelected ? "#38bdf8" : "#1e293b")} 
                        strokeWidth={isSelected || isDeleteMode ? "0.25" : "0.15"}
                        className={isDeleteMode ? "hover:fill-red-700 transition-colors" : "hover:fill-slate-600 transition-colors"}
                      />
                    )}
                    {/* Pillar Name Overlay */}
                    <text 
                      x={effPos.x} y={effPos.y} 
                      transform={`scale(1, -1) translate(0, ${-effPos.y * 2})`}
                      textAnchor="middle" 
                      alignmentBaseline="middle" 
                      fontSize="0.5" 
                      fill="#ffffff" 
                      fontWeight="bold"
                      className="pointer-events-none select-none"
                    >
                      {p.name}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Selected Pillar Inspector Overlay */}
          {selectedPillarId && (() => {
            const p = (model.pillars || []).find(item => item.id === selectedPillarId && item.floorId === activeFloorId);
            if (!p) return null;
            const floorObj = model.floors.find(f => f.id === p.floorId);
            return (
              <div className="absolute top-4 left-4 z-20 bg-slate-900/95 text-white p-3.5 rounded-xl border border-slate-700 shadow-2xl max-w-xs text-xs space-y-2 backdrop-blur-md animate-in fade-in duration-150">
                <div className="flex justify-between items-center border-b border-slate-700 pb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                    <span className="font-bold text-orange-400 text-sm">{p.name} Concrete Column</span>
                  </div>
                  <button onClick={() => setSelectedPillarId(null)} className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"><X className="w-3.5 h-3.5" /></button>
                </div>
                
                <div className="space-y-1 text-slate-300">
                  <div><span className="text-slate-400">Floor: </span><span className="font-semibold text-white">{floorObj?.name || 'Current Floor'}</span></div>
                  <div><span className="text-slate-400">Coordinates: </span><span className="font-mono text-cyan-300">X: {p.position?.x.toFixed(1)} {model.buildingUnit}, Z: {p.position?.y.toFixed(1)} {model.buildingUnit}</span></div>
                  <div><span className="text-slate-400">Dimensions: </span><span className="font-semibold text-white">{p.width} {p.unit} × {p.depth} {p.unit} × {p.height} {model.buildingUnit}</span></div>
                  <div><span className="text-slate-400">Alignment: </span><span className="capitalize font-mono text-cyan-300">{p.alignment?.replace('_', ' ') || 'Centre'}</span></div>
                  <div><span className="text-slate-400">Structure: </span><span className="text-emerald-400 font-semibold">Floor-Isolated RCC Member</span></div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex gap-2">
                  <button
                    onClick={() => {
                      if (!p.position) return;
                      const columnId = p.verticalColumnId || `col-${Date.now()}`;
                      const multiPillars: Pillar[] = [];
                      model.floors.forEach(fl => {
                        if (fl.id !== p.floorId) {
                          multiPillars.push({
                            ...p,
                            id: `pillar-${fl.id}-${Date.now()}`,
                            floorId: fl.id,
                            verticalColumnId: columnId,
                            height: fl.height
                          });
                        }
                      });
                      setModel(prev => {
                        const updatedPillars = [
                          ...(prev.pillars || []).filter(item => !multiPillars.some(mp => mp.floorId === item.floorId && mp.position?.x === item.position?.x && mp.position?.y === item.position?.y)),
                          ...multiPillars
                        ];
                        return {
                          ...prev,
                          pillars: updatedPillars,
                          floors: prev.floors.map(fl => ({
                            ...fl,
                            pillars: updatedPillars.filter(item => item.floorId === fl.id)
                          }))
                        };
                      });
                      alert(`Propagated ${p.name} vertically to all ${model.floors.length} floors!`);
                    }}
                    className="flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-semibold text-center transition-colors"
                  >
                    Sync All Floors
                  </button>
                  <button
                    onClick={() => {
                      const targetId = p.id;
                      setModel(prev => ({
                        ...prev,
                        pillars: (prev.pillars || []).filter(item => !(item.floorId === activeFloorId && item.id === targetId)),
                        floors: prev.floors.map(fl => fl.id === activeFloorId ? {
                          ...fl,
                          pillars: (fl.pillars || []).filter(pil => pil.id !== targetId)
                        } : fl)
                      }));
                      setSelectedPillarId(null);
                    }}
                    className="py-1 px-2 bg-red-600/80 hover:bg-red-600 text-white rounded text-[10px] font-semibold transition-colors flex items-center justify-center"
                    title="Delete Pillar on Current Floor Only"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleGenerate}
          className="px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        >
          Generate 3D Building Preview
        </button>
      </div>

      {/* Confirmation Modal for Layout Mode Switching */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <h4 className="text-lg font-bold text-gray-900 mb-2">
              {confirmModal.targetMode === 'manual' ? 'Switch to Manual Layout' : 'Switch to Auto Outer Layout'}
            </h4>
            <p className="text-sm text-gray-600 mb-6">
              {confirmModal.targetMode === 'manual' 
                ? 'Manual Layout will remove the automatic outer wall layout. Do you want to continue?'
                : 'Switching to Auto Outer Layout will restore the automatic rectangular outer wall layout based on Length and Width. Do you want to continue?'}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmModal({ isOpen: false, targetMode: 'manual' })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmModeSwitch}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow transition-colors"
              >
                {confirmModal.targetMode === 'manual' ? 'Switch to Manual Layout' : 'Switch to Auto Layout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
