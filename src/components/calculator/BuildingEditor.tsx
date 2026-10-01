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
  getEffectiveFootingSize,
  generateFootingsForPillars,
  calculateFootingRcc,
  trimWallByPillars, 
  splitWallByPillars,
  getEffectivePillarPosition, 
  getPillarWorldPosition,
  worldPositionTo2D,
  validatePillarPlacement,
  detectStructuralPillars,
  checkPillarOpeningCollision, 
  convertUnit,
  DEFAULT_PLASTER_CONFIG,
  PlasterConfig,
  PlasterSurfaceConfig,
  toMetersPlaster,
  PlasterUnit,
  PlasterScope,
  applyPillarConfigToAll,
  CommonPillarConfig
} from '@/lib/brickCalculator';
import { MousePointer2, Square, DoorOpen, LayoutGrid, Trash2, X, Info, ShieldAlert, Sparkles, CheckCircle2, Layers, Box, LandPlot, Hammer, RotateCcw, Check, Plus, AlertTriangle, Compass, FolderClock, Save, Paintbrush, Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectHistoryModal } from './ProjectHistoryModal';
import { SaveProjectModal } from './SaveProjectModal';

interface BuildingEditorProps {
  initialDetails: any;
  onGenerate: () => void;
}

type Tool = 'wall' | 'door' | 'window' | 'delete' | 'none' | 'pillar' | 'beam' | 'fullRingBeam' | 'foundation';

export function BuildingEditor({ initialDetails, onGenerate }: BuildingEditorProps) {
  const { setBuildingModel, buildingModel, brickType, settings, result, projectName } = useCalculator();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  
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
        enabled: false,
        footings: []
      },
      plaster: { ...DEFAULT_PLASTER_CONFIG },
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
        plaster: buildingModel.plaster || { ...DEFAULT_PLASTER_CONFIG },
        floors: buildingModel.floors.map(fl => ({
          ...fl,
          ringBeam: fl.ringBeam || buildingModel.ringBeam || DEFAULT_RCC_RING_BEAM,
          fullRingBeam: fl.fullRingBeam || buildingModel.fullRingBeam || DEFAULT_RCC_FULL_RING_BEAM,
          slab: fl.slab || DEFAULT_RCC_SLAB,
          plaster: fl.plaster || buildingModel.plaster || { ...DEFAULT_PLASTER_CONFIG },
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
      // If buildingModel has foundation, preserve it! Otherwise provide default disabled foundation with empty footings
      if (!baseModel.foundation) {
        baseModel.foundation = {
          ...DEFAULT_FOUNDATION_CONFIG,
          enabled: false,
          footings: []
        };
      }
      return baseModel;
    }
    return createInitialModel();
  });

  const [activeFloorId, setActiveFloorId] = useState<string>(model.floors[0]?.id || 'floor-0');
  const [activeMode, setActiveMode] = useState<'floor' | 'foundation' | 'plaster'>('floor');
  const [selectedWallForPlasterId, setSelectedWallForPlasterId] = useState<string | null>(null);
  const [plasterTarget, setPlasterTarget] = useState<'all' | 'external' | 'internal' | 'selected'>('all');
  const [useCommonInner, setUseCommonInner] = useState<boolean>(true);
  const [useCommonOuter, setUseCommonOuter] = useState<boolean>(true);
  const [useCommonRccSideBeam, setUseCommonRccSideBeam] = useState<boolean>(true);
  const activeFloor = model.floors.find(f => f.id === activeFloorId) || model.floors[0];

  // Plaster configuration helpers for active floor & model
  const plasterConfig: PlasterConfig = {
    ...DEFAULT_PLASTER_CONFIG,
    ...(model.plaster || {}),
    ...(activeFloor?.plaster || {})
  };

  const handleUpdatePlasterConfig = (updates: Partial<PlasterConfig>) => {
    setModel(prev => {
      const updatedPlaster: PlasterConfig = {
        ...DEFAULT_PLASTER_CONFIG,
        ...(prev.plaster || {}),
        ...updates
      };
      return {
        ...prev,
        plaster: updatedPlaster,
        floors: prev.floors.map(fl => {
          if (fl.id !== activeFloorId) return fl;
          return {
            ...fl,
            plaster: {
              ...DEFAULT_PLASTER_CONFIG,
              ...(fl.plaster || {}),
              ...updates
            }
          };
        })
      };
    });
  };

  const handleUpdateWallPlasterOverride = (
    wallId: string, 
    overrides: { 
      innerEnabled?: boolean; 
      outerEnabled?: boolean; 
      innerThickness?: number; 
      outerThickness?: number;
      innerMix?: string;
      outerMix?: string;
      innerWastage?: number;
      outerWastage?: number;
      innerRate?: number;
      outerRate?: number;
    }
  ) => {
    setModel(prev => ({
      ...prev,
      floors: prev.floors.map(fl => {
        if (fl.id !== activeFloorId) return fl;
        return {
          ...fl,
          externalWalls: fl.externalWalls.map(w => {
            if (w.id !== wallId) return w;
            const cur = w.plasterOverrides || {};
            return {
              ...w,
              plasterOverrides: {
                ...cur,
                inner: {
                  ...(cur.inner || {}),
                  ...(overrides.innerThickness !== undefined ? { thickness: overrides.innerThickness } : {}),
                  ...(overrides.innerMix !== undefined ? { mixRatio: overrides.innerMix } : {}),
                  ...(overrides.innerEnabled !== undefined ? { enabled: overrides.innerEnabled } : {}),
                  ...(overrides.innerWastage !== undefined ? { wastagePercent: overrides.innerWastage } : {}),
                  ...(overrides.innerRate !== undefined ? { ratePerSqM: overrides.innerRate } : {})
                },
                outer: {
                  ...(cur.outer || {}),
                  ...(overrides.outerThickness !== undefined ? { thickness: overrides.outerThickness } : {}),
                  ...(overrides.outerMix !== undefined ? { mixRatio: overrides.outerMix } : {}),
                  ...(overrides.outerEnabled !== undefined ? { enabled: overrides.outerEnabled } : {}),
                  ...(overrides.outerWastage !== undefined ? { wastagePercent: overrides.outerWastage } : {}),
                  ...(overrides.outerRate !== undefined ? { ratePerSqM: overrides.outerRate } : {})
                }
              }
            };
          }),
          internalWalls: fl.internalWalls.map(w => {
            if (w.id !== wallId) return w;
            const cur = w.plasterOverrides || {};
            return {
              ...w,
              plasterOverrides: {
                ...cur,
                inner: {
                  ...(cur.inner || {}),
                  ...(overrides.innerThickness !== undefined ? { thickness: overrides.innerThickness } : {}),
                  ...(overrides.innerMix !== undefined ? { mixRatio: overrides.innerMix } : {}),
                  ...(overrides.innerEnabled !== undefined ? { enabled: overrides.innerEnabled } : {}),
                  ...(overrides.innerWastage !== undefined ? { wastagePercent: overrides.innerWastage } : {}),
                  ...(overrides.innerRate !== undefined ? { ratePerSqM: overrides.innerRate } : {})
                }
              }
            };
          })
        };
      })
    }));
  };

  // Manual Plaster Apply Actions (Req 10)
  const handleApplyInnerPlaster = () => {
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => {
        if (fl.id !== activeFloorId) return fl;
        const targetExt = plasterTarget === 'all' || plasterTarget === 'external';
        const targetInt = plasterTarget === 'all' || plasterTarget === 'internal';

        return {
          ...fl,
          plaster: {
            ...DEFAULT_PLASTER_CONFIG,
            ...(fl.plaster || {}),
            enabled: true,
            inner: {
              ...(fl.plaster?.inner || DEFAULT_PLASTER_CONFIG.inner),
              enabled: true
            }
          },
          externalWalls: fl.externalWalls.map(w => {
            if (plasterTarget === 'selected' && w.id !== selectedWallForPlasterId) return w;
            if (plasterTarget !== 'selected' && !targetExt) return w;
            return {
              ...w,
              plasterOverrides: {
                ...(w.plasterOverrides || {}),
                inner: {
                  ...(w.plasterOverrides?.inner || {}),
                  enabled: true,
                  thickness: plasterConfig.inner.thickness,
                  mixRatio: plasterConfig.inner.mixRatio,
                  ratePerSqM: plasterConfig.inner.ratePerSqM
                }
              }
            };
          }),
          internalWalls: fl.internalWalls.map(w => {
            if (plasterTarget === 'selected' && w.id !== selectedWallForPlasterId) return w;
            if (plasterTarget !== 'selected' && !targetInt) return w;
            return {
              ...w,
              plasterOverrides: {
                ...(w.plasterOverrides || {}),
                inner: {
                  ...(w.plasterOverrides?.inner || {}),
                  enabled: true,
                  thickness: plasterConfig.inner.thickness,
                  mixRatio: plasterConfig.inner.mixRatio,
                  ratePerSqM: plasterConfig.inner.ratePerSqM
                }
              }
            };
          })
        };
      });

      return {
        ...prev,
        plaster: {
          ...DEFAULT_PLASTER_CONFIG,
          ...(prev.plaster || {}),
          enabled: true,
          inner: {
            ...(prev.plaster?.inner || DEFAULT_PLASTER_CONFIG.inner),
            enabled: true
          }
        },
        floors: updatedFloors
      };
    });
  };

  const handleApplyOuterPlaster = () => {
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => {
        if (fl.id !== activeFloorId) return fl;
        return {
          ...fl,
          plaster: {
            ...DEFAULT_PLASTER_CONFIG,
            ...(fl.plaster || {}),
            enabled: true,
            outer: {
              ...(fl.plaster?.outer || DEFAULT_PLASTER_CONFIG.outer),
              enabled: true
            }
          },
          externalWalls: fl.externalWalls.map(w => {
            if (plasterTarget === 'selected' && w.id !== selectedWallForPlasterId) return w;
            if (plasterTarget === 'internal') return w;
            return {
              ...w,
              plasterOverrides: {
                ...(w.plasterOverrides || {}),
                outer: {
                  ...(w.plasterOverrides?.outer || {}),
                  enabled: true,
                  thickness: plasterConfig.outer.thickness,
                  mixRatio: plasterConfig.outer.mixRatio,
                  ratePerSqM: plasterConfig.outer.ratePerSqM
                }
              }
            };
          })
        };
      });

      return {
        ...prev,
        plaster: {
          ...DEFAULT_PLASTER_CONFIG,
          ...(prev.plaster || {}),
          enabled: true,
          outer: {
            ...(prev.plaster?.outer || DEFAULT_PLASTER_CONFIG.outer),
            enabled: true
          }
        },
        floors: updatedFloors
      };
    });
  };

  const handleApplyRccPlaster = () => {
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => {
        if (fl.id !== activeFloorId) return fl;
        return {
          ...fl,
          plaster: {
            ...DEFAULT_PLASTER_CONFIG,
            ...(fl.plaster || {}),
            enabled: true,
            rcc: {
              ...(fl.plaster?.rcc || DEFAULT_PLASTER_CONFIG.rcc),
              enabled: true
            },
            rccColumnsEnabled: true,
            rccBeamsEnabled: true
          }
        };
      });

      return {
        ...prev,
        plaster: {
          ...DEFAULT_PLASTER_CONFIG,
          ...(prev.plaster || {}),
          enabled: true,
          rcc: {
            ...(prev.plaster?.rcc || DEFAULT_PLASTER_CONFIG.rcc),
            enabled: true
          },
          rccColumnsEnabled: true,
          rccBeamsEnabled: true
        },
        floors: updatedFloors
      };
    });
  };

  // Manual Plaster Removal Actions (Req 11) - Finishes only, never deletes walls
  const handleRemoveInnerPlaster = () => {
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => {
        if (fl.id !== activeFloorId) return fl;
        const targetExt = plasterTarget === 'all' || plasterTarget === 'external';
        const targetInt = plasterTarget === 'all' || plasterTarget === 'internal';

        return {
          ...fl,
          plaster: plasterTarget === 'all' ? {
            ...(fl.plaster || DEFAULT_PLASTER_CONFIG),
            inner: { ...(fl.plaster?.inner || DEFAULT_PLASTER_CONFIG.inner), enabled: false }
          } : fl.plaster,
          externalWalls: fl.externalWalls.map(w => {
            if (plasterTarget === 'selected' && w.id !== selectedWallForPlasterId) return w;
            if (plasterTarget !== 'selected' && !targetExt) return w;
            return {
              ...w,
              plasterOverrides: {
                ...(w.plasterOverrides || {}),
                inner: { ...(w.plasterOverrides?.inner || {}), enabled: false }
              }
            };
          }),
          internalWalls: fl.internalWalls.map(w => {
            if (plasterTarget === 'selected' && w.id !== selectedWallForPlasterId) return w;
            if (plasterTarget !== 'selected' && !targetInt) return w;
            return {
              ...w,
              plasterOverrides: {
                ...(w.plasterOverrides || {}),
                inner: { ...(w.plasterOverrides?.inner || {}), enabled: false }
              }
            };
          })
        };
      });
      return { ...prev, floors: updatedFloors };
    });
  };

  const handleRemoveOuterPlaster = () => {
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => {
        if (fl.id !== activeFloorId) return fl;
        return {
          ...fl,
          plaster: (plasterTarget === 'all' || plasterTarget === 'external') ? {
            ...(fl.plaster || DEFAULT_PLASTER_CONFIG),
            outer: { ...(fl.plaster?.outer || DEFAULT_PLASTER_CONFIG.outer), enabled: false }
          } : fl.plaster,
          externalWalls: fl.externalWalls.map(w => {
            if (plasterTarget === 'selected' && w.id !== selectedWallForPlasterId) return w;
            if (plasterTarget === 'internal') return w;
            return {
              ...w,
              plasterOverrides: {
                ...(w.plasterOverrides || {}),
                outer: { ...(w.plasterOverrides?.outer || {}), enabled: false }
              }
            };
          })
        };
      });
      return { ...prev, floors: updatedFloors };
    });
  };

  const handleApplyRccSideBeamPlaster = () => {
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => {
        if (fl.id !== activeFloorId) return fl;
        return {
          ...fl,
          plaster: {
            ...DEFAULT_PLASTER_CONFIG,
            ...(fl.plaster || {}),
            enabled: true,
            rccSideBeam: {
              ...(fl.plaster?.rccSideBeam || DEFAULT_PLASTER_CONFIG.rccSideBeam),
              enabled: true
            },
            rccBeamsEnabled: true
          }
        };
      });

      return {
        ...prev,
        plaster: {
          ...DEFAULT_PLASTER_CONFIG,
          ...(prev.plaster || {}),
          enabled: true,
          rccSideBeam: {
            ...(prev.plaster?.rccSideBeam || DEFAULT_PLASTER_CONFIG.rccSideBeam),
            enabled: true
          },
          rccBeamsEnabled: true
        },
        floors: updatedFloors
      };
    });
  };

  const handleRemoveRccPlaster = () => {
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => {
        if (fl.id !== activeFloorId) return fl;
        return {
          ...fl,
          plaster: {
            ...(fl.plaster || DEFAULT_PLASTER_CONFIG),
            rcc: { ...(fl.plaster?.rcc || DEFAULT_PLASTER_CONFIG.rcc), enabled: false }
          }
        };
      });
      return { ...prev, floors: updatedFloors };
    });
  };

  const handleRemoveRccSideBeamPlaster = () => {
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => {
        if (fl.id !== activeFloorId) return fl;
        return {
          ...fl,
          plaster: {
            ...(fl.plaster || DEFAULT_PLASTER_CONFIG),
            rccSideBeam: { ...(fl.plaster?.rccSideBeam || DEFAULT_PLASTER_CONFIG.rccSideBeam), enabled: false }
          }
        };
      });
      return { ...prev, floors: updatedFloors };
    });
  };

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
  const [pillarPosX, setPillarPosX] = useState<number>(0);
  const [pillarPosZ, setPillarPosZ] = useState<number>(0);
  const [draggingPillarId, setDraggingPillarId] = useState<string | null>(null);
  const [dragStartPillarMouse, setDragStartPillarMouse] = useState<Coordinate | null>(null);
  const [dragStartPillarPos, setDragStartPillarPos] = useState<Coordinate | null>(null);
  const [applyPillarScope, setApplyPillarScope] = useState<'current' | 'all'>('current');
  const [showApplyAllConfirm, setShowApplyAllConfirm] = useState<boolean>(false);
  const [applyAllSuccessNotice, setApplyAllSuccessNotice] = useState<string | null>(null);

  // RCC Ring Beam Tool Config State
  const [beamEnabled, setBeamEnabled] = useState<boolean>(
    activeFloor?.ringBeam?.enabled === true
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
  const [autoCreateStub, setAutoCreateStub] = useState<boolean>(true);
  const [pillarNotice, setPillarNotice] = useState<{ msg: string; type: 'info' | 'error' | 'success' } | null>(null);
  const [confirmDeletePillarFor, setConfirmDeletePillarFor] = useState<FoundationFooting | null>(null);
  const [showDifferentSizesPrompt, setShowDifferentSizesPrompt] = useState<boolean>(false);

  // Manual Foundation Placement & Manipulation State
  const [isPlacingFooting, setIsPlacingFooting] = useState<boolean>(false);
  const [foundationSnapMode, setFoundationSnapMode] = useState<'free' | '0.5' | '1.0' | 'pillar'>('free');
  const [foundationMouse, setFoundationMouse] = useState<Coordinate | null>(null);
  const [draggingFootingId, setDraggingFootingId] = useState<string | null>(null);
  const [dragStartMouse, setDragStartMouse] = useState<Coordinate | null>(null);
  const [dragStartFootingPos, setDragStartFootingPos] = useState<Coordinate | null>(null);

  const isGroundFloor = (activeFloor?.level === 0) || (activeFloorId === 'floor-0') || (model.floors[0]?.id === activeFloorId);
  const footingsList = model.foundation?.footings || [];
  const selectedFooting = footingsList.find(f => f.id === selectedFootingId) || (footingsList.length > 0 ? footingsList[0] : null);

  const getFoundationCoords = (
    e: React.MouseEvent | React.TouchEvent, 
    snapMode: 'free' | '0.5' | '1.0' | 'pillar' = foundationSnapMode
  ): Coordinate | null => {
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
    
    // Convert SVG ViewBox coords to model world coordinates
    const rawX = svgP.x;
    const rawY = model.buildingWidth - svgP.y;

    if (snapMode === 'free') {
      return { x: Number(rawX.toFixed(2)), y: Number(rawY.toFixed(2)) };
    }
    if (snapMode === '0.5') {
      return { x: Math.round(rawX / 0.5) * 0.5, y: Math.round(rawY / 0.5) * 0.5 };
    }
    if (snapMode === '1.0') {
      return { x: Math.round(rawX / 1.0) * 1.0, y: Math.round(rawY / 1.0) * 1.0 };
    }
    if (snapMode === 'pillar') {
      const gfPillars = (model.pillars || []).filter(p => !p.floorId || p.floorId === 'floor-0' || p.floorId === 'ground');
      let closestPillar: Pillar | null = null;
      let minD = 2.0; // 2 ft snapping threshold
      for (const p of gfPillars) {
        if (p.position) {
          const d = Math.hypot(p.position.x - rawX, p.position.y - rawY);
          if (d < minD) {
            minD = d;
            closestPillar = p;
          }
        }
      }
      if (closestPillar && (closestPillar as Pillar).position) {
        return { x: (closestPillar as Pillar).position!.x, y: (closestPillar as Pillar).position!.y };
      }
      return { x: Math.round(rawX / 0.5) * 0.5, y: Math.round(rawY / 0.5) * 0.5 };
    }

    return { x: Number(rawX.toFixed(2)), y: Number(rawY.toFixed(2)) };
  };

  const getNextFootingLabel = (): string => {
    const list = model.foundation?.footings || [];
    const usedNums = new Set<number>();
    list.forEach(f => {
      const matchPillarName = (f.pillarName || '').match(/^F(\d+)$/i);
      if (matchPillarName) {
        usedNums.add(parseInt(matchPillarName[1], 10));
      }
      const matchId = f.id.match(/^footing-(?:manual-)?F?(\d+)$/i);
      if (matchId) {
        usedNums.add(parseInt(matchId[1], 10));
      }
    });
    let n = 1;
    while (usedNums.has(n)) {
      n++;
    }
    return `F${n}`;
  };

  const handleCreateManualFooting = (coord: Coordinate) => {
    const nextLabel = getNextFootingLabel();
    const fId = `footing-manual-${Date.now()}`;
    const stubH = autoCreateStub ? 2.0 : 0.0;
    const isCommon = model.foundation?.useCommonFootingSize && model.foundation?.commonFootingSize;
    const fLen = isCommon ? (model.foundation!.commonFootingSize!.length || 4.0) : (model.foundation?.defaultFootingLength || 4.0);
    const fWid = isCommon ? (model.foundation!.commonFootingSize!.width || 4.0) : (model.foundation?.defaultFootingWidth || 4.0);
    const fDep = isCommon ? (model.foundation!.commonFootingSize!.depth || 1.0) : (model.foundation?.defaultFootingDepth || 1.0);
    const pccOffset = 0.5;
    const pccLen = fLen + 2 * pccOffset;
    const pccWid = fWid + 2 * pccOffset;
    const pccThick = 0.33;
    const sandDep = 0.5;
    const excLen = pccLen + 1.0;
    const excWid = pccWid + 1.0;
    const excDep = stubH + fDep + pccThick + sandDep;

    const newFooting: FoundationFooting = {
      id: fId,
      floorId: 'floor-0',
      pillarName: nextLabel,
      isManual: true,
      position: { x: coord.x, y: coord.y },
      foundationType: 'isolated',
      hasFoundationPillar: autoCreateStub,
      foundationPillarId: autoCreateStub ? `FP${nextLabel.replace(/\D/g, '') || '1'}` : undefined,
      columnStubHeight: stubH,
      columnStubWidth: 9,
      columnStubDepth: 9,
      columnStubConcreteGrade: 'M20',
      columnStubMixRatio: '1:1.5:3',
      columnStubRebar: {
        mainBarDiaMm: 16,
        mainBarCount: 4,
        stirrupDiaMm: 8,
        stirrupSpacingMm: 150,
        coverMm: 40
      },
      footingLength: fLen,
      footingWidth: fWid,
      footingDepth: fDep,
      footingUnit: model.buildingUnit,
      concreteGrade: 'M20',
      footingMixRatio: '1:1.5:3',
      pccLength: pccLen,
      pccWidth: pccWid,
      pccThickness: pccThick,
      pccUnit: model.buildingUnit,
      pccMixRatio: '1:4:8',
      sandFillLength: pccLen,
      sandFillWidth: pccWid,
      sandFillDepth: sandDep,
      sandFillUnit: model.buildingUnit,
      sandCompactionFactor: 1.15,
      sandFillCompactionFactor: 1.15,
      excavationLength: excLen,
      excavationWidth: excWid,
      excavationDepth: excDep,
      excavationUnit: model.buildingUnit,
      plinthLevel: 0.0,
      foundationBedLevel: -excDep,
      rebar: {
        mainBarDiaMm: 12,
        mainBarCount: 6,
        distBarDiaMm: 12,
        distBarCount: 6,
        coverMm: 50
      },
      enabled: true,
      includeInEstimate: true
    };

    setModel(prev => {
      const curF = prev.foundation || DEFAULT_FOUNDATION_CONFIG;
      return {
        ...prev,
        foundation: {
          ...curF,
          enabled: true,
          footings: [...(curF.footings || []), newFooting]
        }
      };
    });

    setSelectedFootingId(fId);
    setPillarNotice({
      msg: `Created manual footing ${nextLabel} at (${coord.x.toFixed(1)}', ${coord.y.toFixed(1)}').`,
      type: 'success'
    });
  };

  const handleFootingMouseDown = (e: React.MouseEvent, footing: FoundationFooting) => {
    e.stopPropagation();
    setSelectedFootingId(footing.id);
    if (!isPlacingFooting) {
      const rawCoords = getFoundationCoords(e, 'free');
      if (rawCoords && footing.position) {
        setDraggingFootingId(footing.id);
        setDragStartMouse(rawCoords);
        setDragStartFootingPos({ x: footing.position.x, y: footing.position.y });
      }
    }
  };

  const handleAutoGenerateFoundations = () => {
    const gfId = model.floors[0]?.id || 'floor-0';
    const gfPillars = (model.pillars || []).filter(p => !p.floorId || p.floorId === gfId || p.floorId === 'floor-0' || p.floorId === 'ground');
    const targetPillars = gfPillars.length > 0 ? gfPillars : (model.floors[0]?.pillars || []);
    const newFootings = generateFootingsForPillars(targetPillars, model.foundation || DEFAULT_FOUNDATION_CONFIG, model.buildingUnit);
    
    // Apply autoCreateStub setting
    const formattedNewFootings = autoCreateStub ? newFootings : newFootings.map(f => ({
      ...f,
      hasFoundationPillar: false,
      columnStubHeight: 0
    }));

    // Preserve any existing manually placed footings or footings without a linked pillar
    const existingFootings = model.foundation?.footings || [];
    const manualFootings = existingFootings.filter(f => f.isManual === true || !f.pillarId);
    const finalFootings = [...manualFootings, ...formattedNewFootings];

    setModel(prev => ({
      ...prev,
      foundation: {
        ...(prev.foundation || DEFAULT_FOUNDATION_CONFIG),
        enabled: true,
        footings: finalFootings
      }
    }));
    if (finalFootings.length > 0) {
      setSelectedFootingId(finalFootings[0].id);
    }
    setPillarNotice({
      msg: `Generated ${formattedNewFootings.length} pillar footings${manualFootings.length > 0 ? ` (${manualFootings.length} manual footings preserved)` : ''}${autoCreateStub ? ' with column stubs' : ' (stubs disabled)'}.`,
      type: 'success'
    });
  };

  const handleAddFoundationPillar = () => {
    if (!selectedFooting) {
      setPillarNotice({ msg: "Please select a footing first.", type: 'error' });
      return;
    }

    const hasPillar = selectedFooting.hasFoundationPillar !== false && (selectedFooting.columnStubHeight === undefined || selectedFooting.columnStubHeight > 0);
    if (hasPillar) {
      setPillarNotice({ 
        msg: `Foundation pillar already exists for this footing (${selectedFooting.pillarName || selectedFooting.id}).`, 
        type: 'info' 
      });
      return;
    }

    // Centered on selected footing coordinates
    const gfPillars = model.pillars || [];
    const linkedPillar = gfPillars.find(p => p.id === selectedFooting.pillarId || p.name === selectedFooting.pillarName);
    const pW = linkedPillar?.width || selectedFooting.columnStubWidth || 9;
    const pD = linkedPillar?.depth || selectedFooting.columnStubDepth || 9;
    const stubH = 2.0;
    const fIdx = footingsList.findIndex(f => f.id === selectedFooting.id);
    const fpId = selectedFooting.foundationPillarId || `FP${(fIdx >= 0 ? fIdx + 1 : 1)}`;

    const fD = selectedFooting.footingDepth || 1.0;
    const pccT = selectedFooting.pccThickness || 0.33;
    const sandD = selectedFooting.sandFillDepth || 0.5;

    handleUpdateFooting(selectedFooting.id, {
      hasFoundationPillar: true,
      foundationPillarId: fpId,
      columnStubHeight: stubH,
      columnStubWidth: pW,
      columnStubDepth: pD,
      columnStubConcreteGrade: selectedFooting.columnStubConcreteGrade || 'M20',
      columnStubMixRatio: selectedFooting.columnStubMixRatio || '1:1.5:3',
      columnStubRebar: selectedFooting.columnStubRebar || {
        mainBarDiaMm: 16,
        mainBarCount: 4,
        stirrupDiaMm: 8,
        stirrupSpacingMm: 150,
        coverMm: 40
      },
      excavationDepth: stubH + fD + pccT + sandD,
      foundationBedLevel: -(stubH + fD + pccT + sandD)
    });

    setPillarNotice({ 
      msg: `Created Foundation Pillar ${fpId} centered on footing ${selectedFooting.pillarName || selectedFooting.id}.`, 
      type: 'success' 
    });
  };

  const handleInitiateDeleteFoundationPillar = () => {
    if (!selectedFooting) {
      setPillarNotice({ msg: "Please select a footing first.", type: 'error' });
      return;
    }

    const hasPillar = selectedFooting.hasFoundationPillar !== false && (selectedFooting.columnStubHeight === undefined || selectedFooting.columnStubHeight > 0);
    if (!hasPillar) {
      setPillarNotice({ 
        msg: `No foundation pillar exists for footing ${selectedFooting.pillarName || selectedFooting.id}.`, 
        type: 'info' 
      });
      return;
    }

    setConfirmDeletePillarFor(selectedFooting);
  };

  const handleConfirmDeleteFoundationPillar = () => {
    if (!confirmDeletePillarFor) return;

    const fId = confirmDeletePillarFor.id;
    const fpId = confirmDeletePillarFor.foundationPillarId || 'FP';
    const fD = confirmDeletePillarFor.footingDepth || 1.0;
    const pccT = confirmDeletePillarFor.pccThickness || 0.33;
    const sandD = confirmDeletePillarFor.sandFillDepth || 0.5;

    handleUpdateFooting(fId, {
      hasFoundationPillar: false,
      columnStubHeight: 0,
      excavationDepth: fD + pccT + sandD,
      foundationBedLevel: -(fD + pccT + sandD)
    });

    setConfirmDeletePillarFor(null);
    setPillarNotice({
      msg: `Foundation pillar ${fpId} and reinforcement cage deleted. Footing and Ground Pillar remain intact.`,
      type: 'success'
    });
  };

  const handleUpdateFooting = (footingId: string, changes: Partial<FoundationFooting>) => {
    setModel(prev => {
      const curF = prev.foundation || DEFAULT_FOUNDATION_CONFIG;
      const isSizeChange = changes.footingLength !== undefined || changes.footingWidth !== undefined || changes.footingDepth !== undefined;

      if (curF.useCommonFootingSize && isSizeChange) {
        // Requirements 6 & 7: When Common Size is ON, editing ANY footing size updates ALL footings
        const newCommonSize = {
          length: changes.footingLength !== undefined ? changes.footingLength : (curF.commonFootingSize?.length ?? 4),
          width: changes.footingWidth !== undefined ? changes.footingWidth : (curF.commonFootingSize?.width ?? 4),
          depth: changes.footingDepth !== undefined ? changes.footingDepth : (curF.commonFootingSize?.depth ?? 1),
          unit: curF.commonFootingSize?.unit || prev.buildingUnit
        };

        const updatedFootings = curF.footings.map(f => {
          const isTarget = f.id === footingId;
          const otherChanges = isTarget ? changes : {};
          const pccL = newCommonSize.length + 1;
          const pccW = newCommonSize.width + 1;
          const stubH = (isTarget && changes.columnStubHeight !== undefined)
            ? changes.columnStubHeight
            : (f.hasFoundationPillar !== false && (f.columnStubHeight === undefined || f.columnStubHeight > 0) ? (f.columnStubHeight ?? 2.0) : 0);
          const pccT = f.pccThickness || 0.33;
          const sandD = f.sandFillDepth || 0.5;

          return {
            ...f,
            ...otherChanges,
            footingLength: newCommonSize.length,
            footingWidth: newCommonSize.width,
            footingDepth: newCommonSize.depth,
            pccLength: pccL,
            pccWidth: pccW,
            excavationLength: pccL + 1,
            excavationWidth: pccW + 1,
            excavationDepth: stubH + newCommonSize.depth + pccT + sandD,
            foundationBedLevel: -(stubH + newCommonSize.depth + pccT + sandD)
          };
        });

        return {
          ...prev,
          foundation: {
            ...curF,
            commonFootingSize: newCommonSize,
            footings: updatedFootings
          }
        };
      }

      // Individual mode (Common Size = OFF)
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

  const handleToggleCommonSize = (enable: boolean, chosenSize?: { length: number; width: number; depth: number }) => {
    setModel(prev => {
      const curF = prev.foundation || DEFAULT_FOUNDATION_CONFIG;
      if (!enable) {
        // Requirement 11: When turning OFF, existing current common values are copied into each footing as initial individual values
        const currentCommon = curF.commonFootingSize || { length: 4, width: 4, depth: 1 };
        const updatedFootings = curF.footings.map(f => ({
          ...f,
          footingLength: currentCommon.length,
          footingWidth: currentCommon.width,
          footingDepth: currentCommon.depth
        }));
        return {
          ...prev,
          foundation: {
            ...curF,
            useCommonFootingSize: false,
            footings: updatedFootings
          }
        };
      }

      // Toggling ON
      let resolvedSize = chosenSize;
      if (!resolvedSize) {
        if (selectedFooting) {
          resolvedSize = {
            length: selectedFooting.footingLength || 4,
            width: selectedFooting.footingWidth || 4,
            depth: selectedFooting.footingDepth || 1
          };
        } else if (curF.footings.length > 0) {
          resolvedSize = {
            length: curF.footings[0].footingLength || 4,
            width: curF.footings[0].footingWidth || 4,
            depth: curF.footings[0].footingDepth || 1
          };
        } else {
          resolvedSize = {
            length: curF.defaultFootingLength || 4,
            width: curF.defaultFootingWidth || 4,
            depth: curF.defaultFootingDepth || 1
          };
        }
      }

      const updatedFootings = curF.footings.map(f => {
        const stubH = f.hasFoundationPillar !== false && (f.columnStubHeight === undefined || f.columnStubHeight > 0) ? (f.columnStubHeight ?? 2.0) : 0;
        const pccT = f.pccThickness || 0.33;
        const sandD = f.sandFillDepth || 0.5;
        const pccL = resolvedSize!.length + 1;
        const pccW = resolvedSize!.width + 1;
        return {
          ...f,
          footingLength: resolvedSize!.length,
          footingWidth: resolvedSize!.width,
          footingDepth: resolvedSize!.depth,
          pccLength: pccL,
          pccWidth: pccW,
          excavationLength: pccL + 1,
          excavationWidth: pccW + 1,
          excavationDepth: stubH + resolvedSize!.depth + pccT + sandD,
          foundationBedLevel: -(stubH + resolvedSize!.depth + pccT + sandD)
        };
      });

      return {
        ...prev,
        foundation: {
          ...curF,
          useCommonFootingSize: true,
          commonFootingSize: {
            length: resolvedSize!.length,
            width: resolvedSize!.width,
            depth: resolvedSize!.depth,
            unit: prev.buildingUnit
          },
          footings: updatedFootings
        }
      };
    });
    setShowDifferentSizesPrompt(false);
    setPillarNotice({
      msg: `Common Footing Size enabled. Applied to ${model.foundation?.footings?.length || 0} footings.`,
      type: 'success'
    });
  };

  const handleUpdateCommonSize = (field: 'length' | 'width' | 'depth', val: number) => {
    setModel(prev => {
      const curF = prev.foundation || DEFAULT_FOUNDATION_CONFIG;
      const currentCommon = curF.commonFootingSize || {
        length: curF.defaultFootingLength || 4,
        width: curF.defaultFootingWidth || 4,
        depth: curF.defaultFootingDepth || 1,
        unit: prev.buildingUnit
      };

      const newCommonSize = {
        ...currentCommon,
        [field]: val
      };

      const updatedFootings = curF.footings.map(f => {
        const stubH = f.hasFoundationPillar !== false && (f.columnStubHeight === undefined || f.columnStubHeight > 0) ? (f.columnStubHeight ?? 2.0) : 0;
        const pccT = f.pccThickness || 0.33;
        const sandD = f.sandFillDepth || 0.5;
        const pccL = newCommonSize.length + 1;
        const pccW = newCommonSize.width + 1;
        return {
          ...f,
          footingLength: newCommonSize.length,
          footingWidth: newCommonSize.width,
          footingDepth: newCommonSize.depth,
          pccLength: pccL,
          pccWidth: pccW,
          excavationLength: pccL + 1,
          excavationWidth: pccW + 1,
          excavationDepth: stubH + newCommonSize.depth + pccT + sandD,
          foundationBedLevel: -(stubH + newCommonSize.depth + pccT + sandD)
        };
      });

      return {
        ...prev,
        foundation: {
          ...curF,
          useCommonFootingSize: true,
          commonFootingSize: newCommonSize,
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

  const handleApplyToAllFootings = (sourceFooting: FoundationFooting) => {
    setModel(prev => {
      const curF = prev.foundation || DEFAULT_FOUNDATION_CONFIG;
      const updatedFootings = curF.footings.map(f => ({
        ...f,
        columnStubHeight: sourceFooting.columnStubHeight,
        columnStubWidth: sourceFooting.columnStubWidth,
        columnStubDepth: sourceFooting.columnStubDepth,
        columnStubConcreteGrade: sourceFooting.columnStubConcreteGrade,
        columnStubMixRatio: sourceFooting.columnStubMixRatio,
        columnStubRebar: sourceFooting.columnStubRebar ? { ...sourceFooting.columnStubRebar } : undefined,
        footingLength: sourceFooting.footingLength,
        footingWidth: sourceFooting.footingWidth,
        footingDepth: sourceFooting.footingDepth,
        concreteGrade: sourceFooting.concreteGrade,
        footingMixRatio: sourceFooting.footingMixRatio,
        pccLength: sourceFooting.pccLength,
        pccWidth: sourceFooting.pccWidth,
        pccThickness: sourceFooting.pccThickness,
        pccMixRatio: sourceFooting.pccMixRatio,
        sandFillLength: sourceFooting.sandFillLength,
        sandFillWidth: sourceFooting.sandFillWidth,
        sandFillDepth: sourceFooting.sandFillDepth,
        excavationLength: sourceFooting.excavationLength,
        excavationWidth: sourceFooting.excavationWidth,
        excavationDepth: sourceFooting.excavationDepth,
        rebar: sourceFooting.rebar ? { ...sourceFooting.rebar } : undefined,
        plinthLevel: sourceFooting.plinthLevel,
        foundationBedLevel: sourceFooting.foundationBedLevel
      }));
      return {
        ...prev,
        foundation: {
          ...curF,
          footings: updatedFootings
        }
      };
    });
  };

  const handleResetFootingDefaults = (footingId: string) => {
    const cfg = DEFAULT_FOUNDATION_CONFIG;
    handleUpdateFooting(footingId, {
      columnStubHeight: cfg.defaultColumnStubHeight,
      columnStubWidth: cfg.defaultColumnStubWidthIn,
      columnStubDepth: cfg.defaultColumnStubDepthIn,
      columnStubConcreteGrade: 'M20',
      columnStubMixRatio: '1:1.5:3',
      columnStubRebar: {
        mainBarDiaMm: cfg.defaultStubMainBarDiaMm,
        mainBarCount: cfg.defaultStubMainBarCount,
        stirrupDiaMm: cfg.defaultStubStirrupDiaMm,
        stirrupSpacingMm: cfg.defaultStubStirrupSpacingMm,
        coverMm: cfg.defaultStubCoverMm
      },
      footingLength: cfg.defaultFootingLength,
      footingWidth: cfg.defaultFootingWidth,
      footingDepth: cfg.defaultFootingDepth,
      concreteGrade: 'M20',
      footingMixRatio: cfg.defaultFootingMixRatio,
      pccLength: cfg.defaultFootingLength + 2 * cfg.defaultPccOffset,
      pccWidth: cfg.defaultFootingWidth + 2 * cfg.defaultPccOffset,
      pccThickness: cfg.defaultPccThickness,
      pccMixRatio: cfg.defaultPccMixRatio,
      sandFillLength: cfg.defaultFootingLength + 2 * cfg.defaultPccOffset,
      sandFillWidth: cfg.defaultFootingWidth + 2 * cfg.defaultPccOffset,
      sandFillDepth: cfg.defaultSandFillDepth,
      excavationLength: cfg.defaultFootingLength + 2 * cfg.defaultPccOffset + 1.0,
      excavationWidth: cfg.defaultFootingWidth + 2 * cfg.defaultPccOffset + 1.0,
      excavationDepth: cfg.defaultExcavationDepth,
      rebar: {
        mainBarDiaMm: cfg.defaultMainBarDiaMm,
        mainBarCount: cfg.defaultMainBarCount,
        distBarDiaMm: cfg.defaultDistBarDiaMm,
        distBarCount: cfg.defaultDistBarCount,
        coverMm: cfg.defaultCoverMm,
        hookLengthMm: 150
      },
      plinthLevel: cfg.defaultPlinthLevel,
      foundationBedLevel: -(cfg.defaultColumnStubHeight + cfg.defaultFootingDepth + cfg.defaultPccThickness + cfg.defaultSandFillDepth)
    });
  };

  const handleBeamToggle = (enabled: boolean) => {
    setBeamEnabled(enabled);
    const updatedBeam: RCCRingBeamConfig = {
      height: beamHeight,
      heightUnit: 'ft',
      width: beamWidth,
      widthUnit: 'in',
      depth: beamDepth,
      depthUnit: 'in',
      enabled
    };
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => fl.id === activeFloorId ? {
        ...fl,
        ringBeam: updatedBeam
      } : fl);
      return {
        ...prev,
        ringBeam: updatedBeam,
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
    const updatedBeam: RCCRingBeamConfig = {
      height: safeH,
      heightUnit: 'ft',
      width: safeW,
      widthUnit: 'in',
      depth: safeD,
      depthUnit: 'in',
      enabled: true
    };
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => fl.id === activeFloorId ? {
        ...fl,
        ringBeam: updatedBeam
      } : fl);
      return {
        ...prev,
        ringBeam: updatedBeam,
        floors: updatedFloors
      };
    });
  };

  const handleFullBeamToggle = (enabled: boolean) => {
    setFullBeamEnabled(enabled);
    const updatedFullBeam: RCCFullRingBeamConfig = {
      enabled,
      thicknessFt: fullBeamThickness
    };
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => fl.id === activeFloorId ? {
        ...fl,
        fullRingBeam: updatedFullBeam
      } : fl);
      return {
        ...prev,
        fullRingBeam: updatedFullBeam,
        floors: updatedFloors
      };
    });
  };

  const handleFullBeamThicknessChange = (thickness: number) => {
    const safeT = Math.max(0.1, isNaN(thickness) ? 1 : thickness);
    setFullBeamThickness(safeT);
    setFullBeamEnabled(true);
    const updatedFullBeam: RCCFullRingBeamConfig = {
      enabled: true,
      thicknessFt: safeT
    };
    setModel(prev => {
      const updatedFloors = prev.floors.map(fl => fl.id === activeFloorId ? {
        ...fl,
        fullRingBeam: updatedFullBeam
      } : fl);
      return {
        ...prev,
        fullRingBeam: updatedFullBeam,
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

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPlacingFooting) {
          setIsPlacingFooting(false);
          setFoundationMouse(null);
        }
        if (draggingFootingId) {
          setDraggingFootingId(null);
        }
      }
    };
    const handleWindowMouseUp = () => {
      if (draggingFootingId) {
        setDraggingFootingId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchend', handleWindowMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchend', handleWindowMouseUp);
    };
  }, [isPlacingFooting, draggingFootingId]);

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
    setModel(prev => {
      const updatedPillars = (prev.pillars || []).map(p => (p.floorId === activeFloorId && p.id === selectedPillarId) ? { ...p, ...changes } : p);
      const updatedFloors = prev.floors.map(fl => fl.id === activeFloorId ? {
        ...fl,
        pillars: (fl.pillars || []).map(p => p.id === selectedPillarId ? { ...p, ...changes } : p)
      } : fl);

      let updatedFoundation = prev.foundation;
      if (isGroundFloor && changes.position && updatedFoundation && updatedFoundation.footings) {
        updatedFoundation = {
          ...updatedFoundation,
          footings: updatedFoundation.footings.map(f => f.pillarId === selectedPillarId ? { ...f, position: changes.position } : f)
        };
      }

      return {
        ...prev,
        pillars: updatedPillars,
        floors: updatedFloors,
        foundation: updatedFoundation
      };
    });
  };

  const handleApplyToAllPillars = () => {
    const commonConfig: CommonPillarConfig = {
      shape: pillarShape,
      width: pillarWidth,
      depth: pillarShape === 'circular' ? pillarWidth : pillarDepth,
      height: pillarHeight,
      unit: pillarWdUnit,
      heightUnit: model.buildingUnit,
      placementType: pillarPlacement,
      alignment: pillarAlignment,
      finish: pillarFinish,
      customOffsetX: pillarAlignment === 'custom_offset' ? customOffsetX : undefined,
      customOffsetY: pillarAlignment === 'custom_offset' ? customOffsetY : undefined,
    };

    const applyRes = applyPillarConfigToAll(model, commonConfig, {
      scope: applyPillarScope,
      activeFloorId
    });

    setModel(applyRes.model);
    setShowApplyAllConfirm(false);
    const scopeLabel = applyPillarScope === 'all' ? 'across all floors' : (activeFloor?.name || 'current floor');
    setApplyAllSuccessNotice(`✓ Pillar settings applied to ${applyRes.affectedCount} RCC pillars on ${scopeLabel}. Positions and IDs preserved.`);
    setTimeout(() => {
      setApplyAllSuccessNotice(null);
    }, 6000);
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    if (activeMode === 'foundation') {
      const fCoords = getFoundationCoords(e, foundationSnapMode);
      if (isPlacingFooting) {
        setFoundationMouse(fCoords);
      }
      if (draggingFootingId && dragStartMouse && dragStartFootingPos) {
        const rawCoords = getFoundationCoords(e, 'free');
        if (rawCoords) {
          const dx = rawCoords.x - dragStartMouse.x;
          const dy = rawCoords.y - dragStartMouse.y;
          let newX = dragStartFootingPos.x + dx;
          let newY = dragStartFootingPos.y + dy;

          if (foundationSnapMode === '0.5') {
            newX = Math.round(newX / 0.5) * 0.5;
            newY = Math.round(newY / 0.5) * 0.5;
          } else if (foundationSnapMode === '1.0') {
            newX = Math.round(newX / 1.0) * 1.0;
            newY = Math.round(newY / 1.0) * 1.0;
          } else if (foundationSnapMode === 'free') {
            newX = Number(newX.toFixed(2));
            newY = Number(newY.toFixed(2));
          }

          handleUpdateFooting(draggingFootingId, {
            position: { x: newX, y: newY }
          });
        }
      }
      return;
    }
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
    if (activeMode === 'foundation') {
      if (isPlacingFooting) {
        const fCoords = getFoundationCoords(e, foundationSnapMode);
        if (fCoords) {
          handleCreateManualFooting(fCoords);
        }
        return;
      }
      // In foundation mode, clicking empty canvas clears footing selection
      setSelectedFootingId(null);
      return;
    }
    if (activeMode === 'plaster') {
      setSelectedWallForPlasterId(null);
      return;
    }
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
        const d1 = Math.hypot(w.start.x - placeCoord.x, w.start.y - placeCoord.y);
        const d2 = Math.hypot(w.end.x - placeCoord.x, w.end.y - placeCoord.y);
        return d1 <= snapDist || d2 <= snapDist;
      }).map(w => w.id);

      const newPillar: Pillar = {
        id: `pillar-${activeFloorId}-${Date.now()}`,
        name: pillarName,
        floorId: activeFloorId,
        verticalColumnId: `col-${Date.now()}`,
        width: pillarWidth,
        depth: pillarDepth,
        height: pillarHeight,
        count: 1,
        unit: pillarWdUnit,
        heightUnit: model.buildingUnit,
        position: placeCoord,
        placementType: pillarPlacement,
        alignment: pillarAlignment,
        shape: pillarShape,
        finish: pillarFinish,
        continueToFloors: pillarContinue,
        includeInEstimate: pillarIncludeEst,
        showRebar: pillarShowRebar,
        showBeam: pillarShowBeam,
        customOffsetX: pillarAlignment === 'custom_offset' ? customOffsetX : undefined,
        customOffsetY: pillarAlignment === 'custom_offset' ? customOffsetY : undefined,
        connectedWallIds: connectedWallIds
      };

      // If continue is all, add to all floors at the exact same location
      setModel(prev => {
        const targetFloors = pillarContinue === 'all' 
          ? prev.floors 
          : prev.floors.filter(f => f.id === activeFloorId);
        
        const newPillarsToAdd: Pillar[] = targetFloors.map(fl => ({
          ...newPillar,
          id: `pillar-${fl.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          floorId: fl.id,
          height: fl.height
        }));

        // Propagate to foundation if pillar added to ground floor
        let updatedFoundation = prev.foundation;
        if (targetFloors.some(f => f.id === 'floor-0' || f.level === 0) && autoCreateStub && prev.foundation && prev.foundation.enabled) {
          const gfInstance = newPillarsToAdd.find(p => p.floorId === 'floor-0' || prev.floors.find(f => f.id === p.floorId)?.level === 0) || newPillar;
          const newFooting: FoundationFooting = {
            id: `footing-${gfInstance.id}`,
            pillarId: gfInstance.id,
            pillarName: gfInstance.name,
            floorId: 'floor-0',
            hasFoundationPillar: true,
            foundationPillarId: `FP-${gfInstance.name || gfInstance.id}`,
            position: placeCoord,
            foundationType: 'isolated',
            excavationLength: 5,
            excavationWidth: 5,
            excavationDepth: 3.83,
            excavationUnit: model.buildingUnit,
            sandFillLength: 4,
            sandFillWidth: 4,
            sandFillDepth: 0.5,
            sandFillUnit: model.buildingUnit,
            sandCompactionFactor: 1.15,
            sandFillCompactionFactor: 1.15,
            pccLength: 4,
            pccWidth: 4,
            pccThickness: 0.33,
            pccUnit: model.buildingUnit,
            pccMixRatio: '1:4:8',
            footingLength: 3,
            footingWidth: 3,
            footingDepth: 1,
            footingUnit: model.buildingUnit,
            concreteGrade: 'M20',
            footingMixRatio: '1:1.5:3',
            columnStubHeight: 2,
            columnStubWidth: pillarWidth,
            columnStubDepth: pillarDepth,
            columnStubUnit: pillarWdUnit,
            columnStubConcreteGrade: 'M20',
            columnStubMixRatio: '1:1.5:3',
            columnStubRebar: {
              mainBarDiaMm: 16,
              mainBarCount: 4,
              stirrupDiaMm: 8,
              stirrupSpacingMm: 150,
              coverMm: 40
            },
            plinthLevel: 0,
            foundationBedLevel: -3.83,
            rebar: {
              mainBarDiaMm: 12,
              mainBarCount: 6,
              distBarDiaMm: 12,
              distBarCount: 6,
              coverMm: 50,
              hookLengthMm: 150
            },
            enabled: true,
            includeInEstimate: true
          };
          updatedFoundation = {
            ...prev.foundation,
            footings: [...(prev.foundation.footings || []), newFooting]
          };
        }

        return {
          ...prev,
          pillars: [...(prev.pillars || []), ...newPillarsToAdd],
          floors: prev.floors.map(fl => {
            const addedForFloor = newPillarsToAdd.filter(np => np.floorId === fl.id);
            return addedForFloor.length > 0
              ? { ...fl, pillars: [...(fl.pillars || []), ...addedForFloor] }
              : fl;
          }),
          foundation: updatedFoundation
        };
      });

      setPillarName(`P${(model.pillars?.length || 0) + 2}`);
    }
  };

  const handleWallClick = (e: React.MouseEvent, wall: Wall) => {
    e.stopPropagation(); // Prevent SVG click from firing
    if (activeMode === 'foundation') return;
    if (activeMode === 'plaster') {
      setSelectedWallForPlasterId(wall.id);
      return;
    }
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
    if (activeMode === 'foundation') return;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Interactive Wall & Pillar Editor</h2>
          <p className="mt-1 text-sm text-gray-600">
            Draw walls and place RCC columns with precise corner alignment to build a 100% physically accurate 3D model.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsSaveModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-sm hover:shadow-md text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            <Save className="w-4 h-4 mr-1.5" />
            <span>Save Plan</span>
          </button>
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg shadow-sm text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <FolderClock className="w-4 h-4 mr-1.5 text-orange-600" />
            <span>Saved History</span>
          </button>
        </div>
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

      {/* TOP NAVIGATION: STRUCTURE MODE, BUILDING FLOORS & FINISH / MATERIAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-2.5 gap-3 bg-white px-2 pt-2 rounded-t-lg">
        {/* 1. STRUCTURE */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
            Structure
          </span>
          <button
            type="button"
            onClick={() => {
              setActiveMode('foundation');
              setSelectedPillarId(null);
              setDrawingStart(null);
              setCurrentMouse(null);
            }}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-all shadow-sm border",
              activeMode === 'foundation'
                ? "bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400/50"
                : "bg-amber-50/90 text-amber-900 border-amber-300 hover:bg-amber-100 hover:border-amber-400"
            )}
            title="Switch to Structural Foundation / Base Mode"
          >
            <LandPlot className={cn("w-4 h-4", activeMode === 'foundation' ? "text-white" : "text-amber-700")} />
            <span>Base / Foundation</span>
            {model.foundation?.enabled && (
              <span className={cn(
                "ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold",
                activeMode === 'foundation' ? "bg-amber-800 text-amber-100" : "bg-amber-200 text-amber-900"
              )}>
                {model.foundation?.footings?.length || 0}
              </span>
            )}
          </button>
        </div>

        {/* Separator Divider */}
        <div className="hidden md:block h-7 w-px bg-gray-300"></div>

        {/* 2. BUILDING FLOORS */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded border border-gray-200 shrink-0">
            Floors
          </span>
          <div className="flex items-center space-x-1.5 overflow-x-auto">
            {model.floors.map((f, idx) => {
              const isSelected = activeMode === 'floor' && activeFloorId === f.id;

              return (
                <div
                  key={f.id}
                  className={cn(
                    "flex items-center px-3.5 py-2 rounded-lg transition-all text-sm font-semibold whitespace-nowrap border cursor-pointer",
                    isSelected
                      ? "bg-orange-600 text-white border-orange-700 shadow-sm"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900"
                  )}
                  onClick={() => {
                    setActiveMode('floor');
                    setActiveFloorId(f.id);
                    setSelectedFootingId(null);
                    setSelectedPillarId(null);
                    setDrawingStart(null);
                    setCurrentMouse(null);
                    if (activeTool === 'foundation') {
                      setActiveTool('wall');
                    }
                  }}
                >
                  <button
                    type="button"
                    className="focus:outline-none"
                  >
                    {f.name}
                  </button>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleRemoveFloor(f.id); 
                      }}
                      className={cn(
                        "ml-2 rounded-full p-0.5 hover:bg-black/15 transition-colors",
                        isSelected ? "text-white" : "text-gray-400 hover:text-red-500"
                      )}
                      title="Remove Floor"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={handleAddFloor}
              className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center whitespace-nowrap shadow-sm"
              title="Add a new building floor level"
            >
              + Add Floor
            </button>
          </div>
        </div>

        {/* Separator Divider */}
        <div className="hidden md:block h-7 w-px bg-gray-300"></div>

        {/* 3. FINISH / MATERIAL MODE */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider bg-teal-100/80 px-2 py-0.5 rounded border border-teal-300 shrink-0">
            Finish / Material
          </span>
          <button
            type="button"
            onClick={() => {
              setActiveMode('plaster');
              setSelectedPillarId(null);
              setSelectedFootingId(null);
              setDrawingStart(null);
              setCurrentMouse(null);
            }}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-all shadow-sm border whitespace-nowrap",
              activeMode === 'plaster'
                ? "bg-teal-700 text-white border-teal-800 shadow-md ring-2 ring-teal-400/50"
                : "bg-teal-50/90 text-teal-900 border-teal-300 hover:bg-teal-100 hover:border-teal-400"
            )}
            title="Switch to Plaster / Cement Wall Finish Construction Tool"
          >
            <Paintbrush className={cn("w-4 h-4", activeMode === 'plaster' ? "text-white" : "text-teal-700")} />
            <span>Plaster / Cement Finish</span>
            {model.plaster?.enabled && (
              <span className={cn(
                "ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold",
                activeMode === 'plaster' ? "bg-teal-900 text-teal-100" : "bg-teal-200 text-teal-900"
              )}>
                ON
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 min-h-[600px]">
        
        {/* TOOLBOX: Dedicated Foundation Editor vs Floor Tools */}
        {activeMode === 'foundation' ? (
          /* Dedicated Foundation / Base Mode Left Panel */
          <div className="w-full lg:w-80 flex flex-col space-y-3 bg-amber-50/40 p-3.5 rounded-lg border border-amber-200 overflow-y-auto max-h-[calc(100vh-120px)] min-h-[580px] shadow-sm">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2">
              <div className="flex items-center gap-1.5">
                <LandPlot className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">BASE / FOUNDATION</span>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded",
                model.foundation?.enabled ? "bg-amber-600 text-white" : "bg-gray-200 text-gray-600"
              )}>
                {model.foundation?.enabled ? "ENABLED" : "DISABLED"}
              </span>
            </div>

            {/* Foundation Settings */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide block">Foundation Settings</span>

              {/* [✓] Enable Foundation / Base */}
              <label className="flex items-center space-x-2 text-xs text-gray-800 font-semibold cursor-pointer bg-white p-2 rounded-md border border-amber-200 shadow-xs">
                <input 
                  type="checkbox" 
                  checked={model.foundation?.enabled === true} 
                  onChange={e => {
                    const val = e.target.checked;
                    setModel(prev => ({
                      ...prev,
                      foundation: {
                        ...(prev.foundation || DEFAULT_FOUNDATION_CONFIG),
                        enabled: val
                      }
                    }));
                  }} 
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4" 
                />
                <span>Enable Foundation / Base</span>
              </label>

              {/* Auto-create Foundation Pillar Stub Toggle */}
              <label className="flex items-start space-x-2 text-[11px] text-gray-700 font-semibold cursor-pointer bg-white p-2 rounded-md border border-amber-200 shadow-xs">
                <input 
                  type="checkbox" 
                  checked={autoCreateStub} 
                  onChange={e => setAutoCreateStub(e.target.checked)} 
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 mt-0.5" 
                />
                <div className="flex-1">
                  <span>Auto-create Foundation Pillar Stub</span>
                  <span className="block text-[9px] text-gray-400 font-normal">
                    {autoCreateStub ? "ON: Footings auto-receive RCC column stubs" : "OFF: Generate footings only (add stubs manually)"}
                  </span>
                </div>
              </label>

              {/* Manual Foundation / Footing Placement Tool */}
              <div className="space-y-1.5 bg-white p-2.5 rounded-md border border-amber-300 shadow-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsPlacingFooting(prev => {
                      const next = !prev;
                      if (next) {
                        setPillarNotice({
                          msg: "Placement mode ON: Click anywhere on 2D canvas to place a footing. Press Esc to exit.",
                          type: 'info'
                        });
                      } else {
                        setFoundationMouse(null);
                      }
                      return next;
                    });
                  }}
                  className={cn(
                    "w-full py-2.5 px-3 text-xs font-bold rounded-md shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                    isPlacingFooting
                      ? "bg-amber-600 text-white ring-2 ring-amber-400 ring-offset-1 animate-pulse"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  )}
                  title="Click to activate manual footing placement on 2D canvas"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isPlacingFooting ? "Placing Mode Active (Click Canvas)" : "+ Add Foundation / Footing"}</span>
                </button>

                {/* Snapping Options: Free, 0.5 ft, 1.0 ft, Pillar */}
                <div className="pt-0.5">
                  <div className="flex justify-between items-center text-[10px] text-gray-600 font-semibold mb-1">
                    <span>Placement Snapping:</span>
                    <span className="font-mono text-amber-700 font-bold uppercase">{foundationSnapMode}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['free', '0.5', '1.0', 'pillar'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setFoundationSnapMode(mode)}
                        className={cn(
                          "py-1 text-[10px] font-bold rounded border transition-colors cursor-pointer text-center",
                          foundationSnapMode === mode
                            ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                        )}
                        title={
                          mode === 'free' ? "Exact pointer coordinate (no snapping)" :
                          mode === '0.5' ? "Snap to 0.5 ft grid" :
                          mode === '1.0' ? "Snap to 1.0 ft grid" :
                          "Snap to closest Ground Floor Pillar"
                        }
                      >
                        {mode === 'free' ? 'Free' : mode === 'pillar' ? 'Pillar' : `${mode} ft`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Auto Generate Foundations */}
              <button
                type="button"
                onClick={handleAutoGenerateFoundations}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-md shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Align & generate isolated RCC footings + PCC base for all Ground Floor pillars (Preserves manual footings)"
              >
                <Sparkles className="w-4 h-4" />
                <span>Auto Generate Foundations</span>
              </button>

              {/* Summary Counts & Missing Stub Warnings */}
              {footingsList.length > 0 && (() => {
                const activeStubsCount = footingsList.filter(f => f.hasFoundationPillar !== false && (f.columnStubHeight === undefined || f.columnStubHeight > 0)).length;
                const missingFootings = footingsList.filter(f => f.hasFoundationPillar === false || f.columnStubHeight === 0);
                return (
                  <div className="bg-white/90 p-2 rounded border border-amber-200 space-y-1.5 text-[10px]">
                    <div className="flex justify-between items-center font-bold text-gray-800">
                      <span>Foundation Footings: <span className="font-mono text-amber-700 font-black">{footingsList.length}</span></span>
                      <span>Foundation Pillars: <span className="font-mono text-sky-700 font-black">{activeStubsCount}</span></span>
                    </div>
                    {missingFootings.length > 0 && (
                      <div className="text-[9px] text-amber-950 bg-amber-100/90 p-1.5 rounded border border-amber-300 flex items-start gap-1 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <span>
                          <b>Warning:</b> {missingFootings.map(f => f.pillarName || f.id).join(', ')} {missingFootings.length === 1 ? 'has' : 'have'} no foundation column stub.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Notice Banner */}
              {pillarNotice && (
                <div className={cn(
                  "text-[10px] p-2 rounded border flex justify-between items-start gap-1.5 animate-fadeIn",
                  pillarNotice.type === 'error' ? "bg-red-50 text-red-800 border-red-200" :
                  pillarNotice.type === 'info' ? "bg-sky-50 text-sky-800 border-sky-200" :
                  "bg-emerald-50 text-emerald-800 border-emerald-200"
                )}>
                  <span>{pillarNotice.msg}</span>
                  <button type="button" onClick={() => setPillarNotice(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {/* COMMON FOOTING SIZE / MASTER FOUNDATION SIZE CONTROL */}
              <div className="bg-white p-3 rounded-lg border-2 border-amber-300 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-xs font-black text-gray-900 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={model.foundation?.useCommonFootingSize === true} 
                      onChange={e => {
                        const checked = e.target.checked;
                        if (checked) {
                          const hasDiff = footingsList.length > 1 && footingsList.some(f => 
                            f.footingLength !== footingsList[0].footingLength || 
                            f.footingWidth !== footingsList[0].footingWidth || 
                            f.footingDepth !== footingsList[0].footingDepth
                          );
                          if (hasDiff) {
                            setShowDifferentSizesPrompt(true);
                          } else {
                            handleToggleCommonSize(true);
                          }
                        } else {
                          handleToggleCommonSize(false);
                        }
                      }} 
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer" 
                    />
                    <span className="flex items-center gap-1.5">
                      <span>Use Common Footing Size</span>
                    </span>
                  </label>
                  <span className={cn(
                    "text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide",
                    model.foundation?.useCommonFootingSize 
                      ? "bg-amber-100 text-amber-900 border border-amber-300" 
                      : "bg-gray-100 text-gray-600 border border-gray-200"
                  )}>
                    {model.foundation?.useCommonFootingSize ? "Common: ON" : "Individual Mode"}
                  </span>
                </div>

                {/* Conflict Resolver when turning ON from different sizes (Requirement 12) */}
                {showDifferentSizesPrompt && (
                  <div className="bg-amber-50 border border-amber-300 p-2.5 rounded text-[11px] space-y-2 animate-fadeIn">
                    <div className="flex items-start gap-1.5 text-amber-950 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>Footing sizes are currently different. Choose a common size:</span>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {selectedFooting && (
                        <button
                          type="button"
                          onClick={() => handleToggleCommonSize(true, {
                            length: selectedFooting.footingLength || 4,
                            width: selectedFooting.footingWidth || 4,
                            depth: selectedFooting.footingDepth || 1
                          })}
                          className="w-full text-left py-1 px-2 bg-white hover:bg-amber-100 rounded border border-amber-300 font-semibold text-[10px] text-amber-900 flex justify-between cursor-pointer"
                        >
                          <span>Use Selected Footing ({selectedFooting.pillarName || selectedFooting.id})</span>
                          <span className="font-mono font-bold">{selectedFooting.footingLength}'×{selectedFooting.footingWidth}'×{selectedFooting.footingDepth}'</span>
                        </button>
                      )}
                      {footingsList.length > 0 && footingsList[0].id !== selectedFooting?.id && (
                        <button
                          type="button"
                          onClick={() => handleToggleCommonSize(true, {
                            length: footingsList[0].footingLength || 4,
                            width: footingsList[0].footingWidth || 4,
                            depth: footingsList[0].footingDepth || 1
                          })}
                          className="w-full text-left py-1 px-2 bg-white hover:bg-amber-100 rounded border border-amber-300 font-semibold text-[10px] text-amber-900 flex justify-between cursor-pointer"
                        >
                          <span>Use {footingsList[0].pillarName || footingsList[0].id} Size</span>
                          <span className="font-mono font-bold">{footingsList[0].footingLength}'×{footingsList[0].footingWidth}'×{footingsList[0].footingDepth}'</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleToggleCommonSize(true, { length: 5, width: 5, depth: 1.5 })}
                        className="w-full text-left py-1 px-2 bg-white hover:bg-amber-100 rounded border border-amber-300 font-semibold text-[10px] text-amber-900 flex justify-between cursor-pointer"
                      >
                        <span>Use Standard 5' × 5' × 1.5'</span>
                        <span className="font-mono font-bold">5'×5'×1.5'</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Common Size Controls & Live Summary when ON */}
                {model.foundation?.useCommonFootingSize && (() => {
                  const commonSize = model.foundation?.commonFootingSize || {
                    length: model.foundation?.defaultFootingLength || 4,
                    width: model.foundation?.defaultFootingWidth || 4,
                    depth: model.foundation?.defaultFootingDepth || 1
                  };
                  const fEst = result?.foundationEstimate;
                  const totalConcreteCft = fEst?.totalFootingRccVolumeCft ?? (footingsList.length * commonSize.length * commonSize.width * commonSize.depth);
                  const totalSteelKg = fEst?.totalSteelKg ?? 0;
                  const totalCost = fEst?.totalCost ?? 0;

                  return (
                    <div className="space-y-2 pt-1 border-t border-amber-100">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-black text-amber-950 uppercase tracking-wide">
                          COMMON FOOTING SIZE
                        </span>
                        <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono font-bold">
                          Applied to {footingsList.length} Footings
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <div>
                          <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Length ({model.buildingUnit})</label>
                          <input 
                            type="number" step="0.25" min="1" max="25"
                            value={commonSize.length}
                            onChange={e => handleUpdateCommonSize('length', Math.max(0.5, Number(e.target.value)))}
                            className="block w-full px-1.5 py-1 text-xs border border-amber-300 rounded bg-white font-bold text-gray-900 focus:ring-amber-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Width ({model.buildingUnit})</label>
                          <input 
                            type="number" step="0.25" min="1" max="25"
                            value={commonSize.width}
                            onChange={e => handleUpdateCommonSize('width', Math.max(0.5, Number(e.target.value)))}
                            className="block w-full px-1.5 py-1 text-xs border border-amber-300 rounded bg-white font-bold text-gray-900 focus:ring-amber-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Depth ({model.buildingUnit})</label>
                          <input 
                            type="number" step="0.1" min="0.2" max="10"
                            value={commonSize.depth}
                            onChange={e => handleUpdateCommonSize('depth', Math.max(0.2, Number(e.target.value)))}
                            className="block w-full px-1.5 py-1 text-xs border border-amber-300 rounded bg-white font-bold text-gray-900 focus:ring-amber-500 font-mono"
                          />
                        </div>
                      </div>

                      {/* Helper text (Requirement 9) */}
                      <p className="text-[9px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                        Common size is applied to all foundation footings. Changing any footing size will synchronize all footings.
                      </p>

                      {/* Requirement 46: Calculation Summary */}
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 p-2 rounded border border-amber-200 space-y-1 text-[10px]">
                        <div className="font-bold text-amber-950 flex justify-between border-b border-amber-200/70 pb-0.5">
                          <span>Common Footing Size:</span>
                          <span className="font-mono text-amber-800 font-extrabold">{commonSize.length}' × {commonSize.width}' × {commonSize.depth}'</span>
                        </div>
                        <div className="flex justify-between text-gray-700">
                          <span>Applied Footings:</span>
                          <span className="font-mono font-bold text-gray-900">{footingsList.length}</span>
                        </div>
                        <div className="flex justify-between text-gray-700">
                          <span>Total Footing Concrete:</span>
                          <span className="font-mono font-bold text-amber-800">{totalConcreteCft.toFixed(1)} cft</span>
                        </div>
                        {totalSteelKg > 0 && (
                          <div className="flex justify-between text-gray-700">
                            <span>Total Footing Steel:</span>
                            <span className="font-mono font-bold text-sky-800">{totalSteelKg.toFixed(1)} kg</span>
                          </div>
                        )}
                        {totalCost > 0 && (
                          <div className="flex justify-between font-bold text-emerald-800 pt-0.5 border-t border-amber-200/70">
                            <span>Total Foundation Cost:</span>
                            <span className="font-mono">₹{Math.round(totalCost).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Select Footing */}
            {footingsList.length > 0 && (
              <div className="border-t border-amber-200 pt-2 space-y-2">
                <label className="block text-[10px] font-bold text-gray-700 uppercase">
                  Select Footing ({footingsList.length} Total):
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-white rounded border border-amber-100">
                  {footingsList.map(f => {
                    const isCurrent = selectedFooting?.id === f.id;
                    const hasStub = f.hasFoundationPillar !== false && (f.columnStubHeight === undefined || f.columnStubHeight > 0);
                    const isManual = f.isManual === true || !f.pillarId;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFootingId(f.id)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer",
                          isCurrent 
                            ? "bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-400" 
                            : isManual
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                              : hasStub
                                ? "bg-gray-50 text-gray-700 border-gray-200 hover:bg-amber-100 hover:border-amber-300"
                                : "bg-amber-50/60 text-amber-800 border-dashed border-amber-300 hover:bg-amber-100"
                        )}
                        title={isManual ? `${f.pillarName || f.id} (Manual Footing)` : `${f.pillarName || f.id} (Pillar Connected)`}
                      >
                        <span>{f.pillarName || f.id}</span>
                        {isManual && (
                          <span className="text-[8px] bg-emerald-200 text-emerald-900 px-1 py-0.2 rounded font-normal">manual</span>
                        )}
                        {!hasStub && !isManual && (
                          <span className="text-[8px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-normal">no stub</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* EXACT REQUIRED TOOLS: [ + Add Foundation Pillar ] and [ Delete Foundation Pillar ] */}
                <div className="space-y-1 bg-white p-2 rounded border border-amber-200 shadow-xs">
                  <span className="text-[10px] font-black text-gray-700 uppercase tracking-wider block">
                    Foundation Pillar Tools
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={handleAddFoundationPillar}
                      className="py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] shadow-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      title="Add an RCC column stub between selected footing and Ground Floor pillar"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Foundation Pillar</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleInitiateDeleteFoundationPillar}
                      className="py-2 px-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-[11px] shadow-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      title="Delete only the foundation column stub and reinforcement cage for selected footing"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Foundation Pillar</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footing Properties & Structural Level Customization */}
            {selectedFooting ? (() => {
              const hasStub = selectedFooting.hasFoundationPillar !== false && (selectedFooting.columnStubHeight === undefined || selectedFooting.columnStubHeight > 0);
              const stubH = hasStub ? (selectedFooting.columnStubHeight !== undefined ? selectedFooting.columnStubHeight : 2.0) : 0.0;
              const stubW = selectedFooting.columnStubWidth || 9;
              const stubD = selectedFooting.columnStubDepth || 9;
              const effSize = getEffectiveFootingSize(selectedFooting, model.foundation);
              const fL = effSize.length;
              const fW = effSize.width;
              const fD = effSize.depth;
              const pccL = selectedFooting.pccLength || (fL + 1.0);
              const pccW = selectedFooting.pccWidth || (fW + 1.0);
              const pccT = selectedFooting.pccThickness || 0.33;
              const sandL = selectedFooting.sandFillLength || pccL;
              const sandW = selectedFooting.sandFillWidth || pccW;
              const sandD = selectedFooting.sandFillDepth || 0.5;
              const sandFactor = selectedFooting.sandCompactionFactor || selectedFooting.sandFillCompactionFactor || 1.15;
              const excL = selectedFooting.excavationLength || (pccL + 1.0);
              const excW = selectedFooting.excavationWidth || (pccW + 1.0);
              const totalDepth = stubH + fD + pccT + sandD;
              const excD = selectedFooting.excavationDepth || totalDepth;
              const plinthL = selectedFooting.plinthLevel || 0.0;
              const bedLevel = selectedFooting.foundationBedLevel !== undefined ? selectedFooting.foundationBedLevel : -totalDepth;
              const rebar = selectedFooting.rebar || { mainBarDiaMm: 12, mainBarCount: 6, distBarDiaMm: 12, distBarCount: 6, coverMm: 50 };
              const stubRebar = selectedFooting.columnStubRebar || { mainBarDiaMm: 16, mainBarCount: 4, stirrupDiaMm: 8, stirrupSpacingMm: 150, coverMm: 40 };
              const fIdx = footingsList.findIndex(f => f.id === selectedFooting.id);
              const fpId = selectedFooting.foundationPillarId || `FP${(fIdx >= 0 ? fIdx + 1 : 1)}`;

              const isManual = selectedFooting.isManual === true || !selectedFooting.pillarId;
              const gfPillars = (model.pillars || []).filter(p => !p.floorId || p.floorId === 'floor-0' || p.floorId === 'ground');
              const linkedPillar = gfPillars.find(p => p.id === selectedFooting.pillarId || p.name === selectedFooting.pillarName);

              const isOverlapping = footingsList.some(otherF => {
                if (otherF.id === selectedFooting.id) return false;
                const p1 = selectedFooting.position || { x: 0, y: 0 };
                const p2 = otherF.position || { x: 0, y: 0 };
                const otherEff = getEffectiveFootingSize(otherF, model.foundation);
                const minSpacing = (fL + otherEff.length) / 2;
                return Math.hypot(p1.x - p2.x, p1.y - p2.y) < minSpacing;
              });
              const isOutsideFootprint = (selectedFooting.position?.x ?? 0) < 0 || (selectedFooting.position?.x ?? 0) > model.buildingLength ||
                (selectedFooting.position?.y ?? 0) < 0 || (selectedFooting.position?.y ?? 0) > model.buildingWidth;

              return (
                <div className="space-y-3 bg-white p-3 rounded-md border border-amber-200 shadow-sm text-xs">
                  {/* Selected Footing Header & Actions */}
                  <div className="bg-amber-100/80 border border-amber-300 rounded-md p-2.5 flex justify-between items-center">
                    <div>
                      <div className="text-[11px] font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-600 inline-block animate-pulse"></span>
                        <span>FOUNDATION {selectedFooting.pillarName || selectedFooting.id}</span>
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.2 rounded font-normal font-sans",
                          isManual ? "bg-emerald-200 text-emerald-900 font-bold" : "bg-sky-200 text-sky-900"
                        )}>
                          {isManual ? "Manual Footing" : "Auto-Generated"}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-600 mt-0.5 font-mono">
                        ID: {selectedFooting.id}
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleDeleteFooting(selectedFooting.id)} 
                      className="text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded transition-colors border border-red-300 shadow-xs cursor-pointer"
                      title="Delete this foundation footing"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Foundation
                    </button>
                  </div>

                  {/* FOUNDATION POSITION (X, Z) - Live 2D & 3D coordinate editing */}
                  <div className="bg-white p-2.5 rounded border border-amber-200 shadow-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-gray-800 uppercase tracking-wider">
                        Foundation Position
                      </span>
                      <span className="text-[9px] text-gray-500 font-mono">2D & 3D live sync</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">X Position (ft)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={selectedFooting.position?.x ?? 0}
                          onChange={e => {
                            const val = Number(e.target.value);
                            handleUpdateFooting(selectedFooting.id, {
                              position: { x: val, y: selectedFooting.position?.y ?? 0 }
                            });
                          }}
                          className="w-full px-2 py-1 text-xs font-mono font-bold border rounded bg-white text-gray-900 border-gray-300 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Z Position (ft)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={selectedFooting.position?.y ?? 0}
                          onChange={e => {
                            const val = Number(e.target.value);
                            handleUpdateFooting(selectedFooting.id, {
                              position: { x: selectedFooting.position?.x ?? 0, y: val }
                            });
                          }}
                          className="w-full px-2 py-1 text-xs font-mono font-bold border rounded bg-white text-gray-900 border-gray-300 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* OPTIONAL LINK TO GROUND PILLAR & ALIGN */}
                  <div className="bg-white p-2.5 rounded border border-amber-200 shadow-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-gray-800 uppercase tracking-wider">
                        Optional Pillar Link
                      </span>
                      <span className="text-[9px] text-gray-500">
                        {linkedPillar ? `Linked to ${linkedPillar.name}` : "Independent"}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Linked Ground Pillar</label>
                        <select
                          value={selectedFooting.pillarId || ""}
                          onChange={e => {
                            const targetPId = e.target.value;
                            if (!targetPId) {
                              handleUpdateFooting(selectedFooting.id, {
                                pillarId: undefined,
                                pillarName: undefined
                              });
                            } else {
                              const foundPillar = gfPillars.find(p => p.id === targetPId);
                              handleUpdateFooting(selectedFooting.id, {
                                pillarId: targetPId,
                                pillarName: foundPillar?.name || targetPId
                              });
                            }
                          }}
                          className="w-full px-2 py-1 text-xs border rounded bg-white text-gray-800 border-gray-300 focus:ring-amber-500"
                        >
                          <option value="">None (Independent Footing)</option>
                          {gfPillars.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Pos: {p.position?.x?.toFixed(1) ?? 0}', {p.position?.y?.toFixed(1) ?? 0}')
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Align to Pillar button */}
                      <button
                        type="button"
                        disabled={!selectedFooting.pillarId || !linkedPillar}
                        onClick={() => {
                          if (linkedPillar?.position) {
                            handleUpdateFooting(selectedFooting.id, {
                              position: { x: linkedPillar.position.x, y: linkedPillar.position.y }
                            });
                            setPillarNotice({
                              msg: `Aligned footing ${selectedFooting.pillarName || selectedFooting.id} to pillar ${linkedPillar.name} at (${linkedPillar.position.x}', ${linkedPillar.position.y}').`,
                              type: 'success'
                            });
                          }
                        }}
                        className={cn(
                          "w-full py-1.5 px-2 text-[11px] font-bold rounded border transition-colors flex items-center justify-center gap-1 cursor-pointer",
                          selectedFooting.pillarId && linkedPillar
                            ? "bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100"
                            : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        )}
                        title={selectedFooting.pillarId ? "Move this footing to linked pillar's exact coordinates" : "Select a linked pillar first to align"}
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Align to Pillar</span>
                      </button>
                    </div>
                  </div>

                  {/* Informational Structural Warnings */}
                  {(!selectedFooting.pillarId || isOverlapping || isOutsideFootprint) && (
                    <div className="space-y-1">
                      {!selectedFooting.pillarId && (
                        <div className="text-[9px] text-amber-900 bg-amber-50 p-2 rounded border border-amber-300 flex items-start gap-1 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>Footing is manually placed and not linked to a Ground Floor pillar.</span>
                        </div>
                      )}
                      {isOverlapping && (
                        <div className="text-[9px] text-orange-900 bg-orange-50 p-2 rounded border border-orange-300 flex items-start gap-1 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                          <span>Footing overlaps another footing.</span>
                        </div>
                      )}
                      {isOutsideFootprint && (
                        <div className="text-[9px] text-blue-900 bg-blue-50 p-2 rounded border border-blue-300 flex items-start gap-1 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                          <span>Manual footing is outside current building footprint.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* DEDICATED FOUNDATION PILLAR (COLUMN STUB) CARD */}
                  {!hasStub ? (
                    <div className="bg-amber-50/80 p-3 rounded-lg border-2 border-dashed border-amber-300 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-black text-amber-950 uppercase tracking-wide flex items-center gap-1">
                          <span>🏛️ FOUNDATION PILLAR ({fpId})</span>
                        </span>
                        <span className="text-[8px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">
                          NO PILLAR STUB
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-600 leading-relaxed">
                        No foundation column stub exists for this footing. Ground Floor pillar connects directly to footing top.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddFoundationPillar}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Foundation Pillar for this Footing</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-sky-50/70 p-3 rounded-lg border-2 border-sky-300 space-y-2.5 shadow-xs">
                      <div className="flex justify-between items-center border-b border-sky-200 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-sky-600 inline-block animate-pulse"></span>
                          <span className="text-[11px] font-black text-sky-950 uppercase tracking-wide">
                            FOUNDATION PILLAR: {fpId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] bg-sky-200 text-sky-900 font-bold px-1.5 py-0.5 rounded">
                            CONNECTED
                          </span>
                          <button
                            type="button"
                            onClick={handleInitiateDeleteFoundationPillar}
                            className="text-red-600 hover:text-red-800 text-[10px] font-bold flex items-center gap-0.5 hover:bg-red-50 p-1 rounded transition-colors cursor-pointer"
                            title="Delete this foundation pillar stub only"
                          >
                            <Trash2 className="w-3 h-3" /> Remove Stub
                          </button>
                        </div>
                      </div>

                      {/* Structural Hierarchy Links & Position */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] bg-white p-2 rounded border border-sky-100 font-mono">
                        <div>
                          <span className="text-gray-500 block text-[9px] font-sans font-bold">LINKED FOOTING</span>
                          <span className="font-bold text-gray-800">{selectedFooting.pillarName ? `${selectedFooting.pillarName} (F${selectedFooting.id.replace(/\D/g, '') || '1'})` : selectedFooting.id}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[9px] font-sans font-bold">LINKED GROUND PILLAR</span>
                          <span className="font-bold text-indigo-700">{selectedFooting.pillarName || selectedFooting.pillarId || 'P1'}</span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-gray-100 flex justify-between">
                          <span className="text-gray-500 font-sans font-bold text-[9px]">AXIAL POSITION (X, Z):</span>
                          <span className="font-bold text-gray-700">X = {selectedFooting.position?.x?.toFixed(1) ?? 0}', Z = {selectedFooting.position?.y?.toFixed(1) ?? 0}'</span>
                        </div>
                      </div>

                      {/* Stub Dimensions & Elevation Levels */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-gray-700 uppercase">Stub Dimensions & Levels</label>
                          <span className="text-[9px] font-mono text-sky-700">Top: 0.00' (GL) • Bottom: -{stubH.toFixed(2)}'</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Height (ft)</label>
                            <input 
                              type="number" step="0.25" min="0.25" max="15"
                              value={stubH}
                              onChange={e => {
                                const val = Math.max(0.1, Number(e.target.value));
                                handleUpdateFooting(selectedFooting.id, { 
                                  columnStubHeight: val,
                                  excavationDepth: val + fD + pccT + sandD,
                                  foundationBedLevel: -(val + fD + pccT + sandD)
                                });
                              }}
                              className="block w-full px-1.5 py-1 text-xs border border-sky-300 rounded bg-white font-bold text-sky-950 focus:ring-sky-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Width (in)</label>
                            <input 
                              type="number" step="1" min="4" max="48"
                              value={stubW}
                              onChange={e => handleUpdateFooting(selectedFooting.id, { columnStubWidth: Math.max(4, Number(e.target.value)) })}
                              className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold text-gray-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Depth (in)</label>
                            <input 
                              type="number" step="1" min="4" max="48"
                              value={stubD}
                              onChange={e => handleUpdateFooting(selectedFooting.id, { columnStubDepth: Math.max(4, Number(e.target.value)) })}
                              className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold text-gray-900"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Concrete & Reinforcement */}
                      <div className="space-y-1.5 pt-1 border-t border-sky-200/70">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-gray-700 uppercase">Reinforcement & Concrete</label>
                          <select 
                            value={selectedFooting.columnStubConcreteGrade || 'M20'}
                            onChange={e => handleUpdateFooting(selectedFooting.id, { columnStubConcreteGrade: e.target.value as any })}
                            className="px-1.5 py-0.5 text-[9px] border rounded bg-white font-bold text-sky-900"
                          >
                            <option value="M20">M20 Grade</option>
                            <option value="M25">M25 Grade</option>
                            <option value="M30">M30 Grade</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Main Bar Diameter</label>
                            <select 
                              value={stubRebar.mainBarDiaMm || 16}
                              onChange={e => handleUpdateFooting(selectedFooting.id, { columnStubRebar: { ...stubRebar, mainBarDiaMm: Number(e.target.value) } })}
                              className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                            >
                              <option value={12}>12 mm</option>
                              <option value={16}>16 mm (Standard)</option>
                              <option value={20}>20 mm (Heavy)</option>
                              <option value={25}>25 mm</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Main Bar Count</label>
                            <input 
                              type="number" min="4" max="16" step="2"
                              value={stubRebar.mainBarCount || 4}
                              onChange={e => handleUpdateFooting(selectedFooting.id, { columnStubRebar: { ...stubRebar, mainBarCount: Math.max(4, Number(e.target.value)) } })}
                              className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Tie Stirrup Dia</label>
                            <select 
                              value={stubRebar.stirrupDiaMm || 8}
                              onChange={e => handleUpdateFooting(selectedFooting.id, { columnStubRebar: { ...stubRebar, stirrupDiaMm: Number(e.target.value) } })}
                              className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                            >
                              <option value={8}>8 mm</option>
                              <option value={10}>10 mm</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Tie Spacing (mm)</label>
                            <input 
                              type="number" min="50" max="300" step="10"
                              value={stubRebar.stirrupSpacingMm || 150}
                              onChange={e => handleUpdateFooting(selectedFooting.id, { columnStubRebar: { ...stubRebar, stirrupSpacingMm: Math.max(50, Number(e.target.value)) } })}
                              className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Cover (mm)</label>
                            <input 
                              type="number" min="20" max="60" step="5"
                              value={stubRebar.coverMm || 40}
                              onChange={e => handleUpdateFooting(selectedFooting.id, { columnStubRebar: { ...stubRebar, coverMm: Math.max(20, Number(e.target.value)) } })}
                              className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 1. FOOTING SIZE */}
                  <div className={cn(
                    "p-2.5 rounded-lg border space-y-2 shadow-xs transition-colors",
                    model.foundation?.useCommonFootingSize ? "bg-amber-50/60 border-amber-300" : "bg-white border-amber-200"
                  )}>
                    <div className="flex justify-between items-center border-b border-amber-100 pb-1">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] font-black text-amber-950 uppercase tracking-wide flex items-center gap-1">
                          <span>📐 FOOTING SIZE</span>
                          <span className="text-[8px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold font-mono">({effSize.unit})</span>
                        </label>
                        {model.foundation?.useCommonFootingSize && (
                          <span className="text-[8px] bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded-full font-bold">
                            Using Common Size
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-mono text-gray-600 font-bold">
                        {fL}' × {fW}' × {fD}'
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Length</label>
                        <input 
                          type="number" step="0.25" min="1" max="25"
                          value={fL}
                          onChange={e => {
                            const val = Math.max(0.5, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { 
                              footingLength: val,
                              pccLength: val + 1,
                              excavationLength: val + 2
                            });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-amber-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Width</label>
                        <input 
                          type="number" step="0.25" min="1" max="25"
                          value={fW}
                          onChange={e => {
                            const val = Math.max(0.5, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { 
                              footingWidth: val,
                              pccWidth: val + 1,
                              excavationWidth: val + 2
                            });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-amber-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Depth</label>
                        <input 
                          type="number" step="0.1" min="0.2" max="10"
                          value={fD}
                          onChange={e => {
                            const val = Math.max(0.2, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { 
                              footingDepth: val,
                              excavationDepth: stubH + val + pccT + sandD,
                              foundationBedLevel: -(stubH + val + pccT + sandD)
                            });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-amber-500 font-mono"
                        />
                      </div>
                    </div>
                    {model.foundation?.useCommonFootingSize && (
                      <p className="text-[8.5px] text-amber-900 bg-amber-100/70 p-1 rounded font-medium">
                        ℹ️ Common size is applied: changing values here automatically synchronizes all {footingsList.length} footings.
                      </p>
                    )}
                  </div>

                  {/* 2. FOUNDATION LEVELS */}
                  <div className="bg-sky-50/50 p-2.5 rounded-lg border border-sky-200 space-y-2 shadow-xs">
                    <div className="flex justify-between items-center border-b border-sky-200 pb-1">
                      <label className="text-[10px] font-black text-sky-950 uppercase tracking-wide flex items-center gap-1">
                        <span>🏛️ FOUNDATION LEVELS</span>
                        <span className="text-[8px] bg-sky-200 text-sky-800 px-1.5 py-0.2 rounded font-bold font-mono">({selectedFooting.footingUnit || 'ft'})</span>
                      </label>
                      <span className="text-[9px] font-bold text-sky-700 font-mono">
                        Bed: -{totalDepth.toFixed(2)} ft
                      </span>
                    </div>

                    {/* KEY CONTROL: Column Stub Height */}
                    <div className="bg-white p-2 rounded border-2 border-sky-400 shadow-xs">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-black text-sky-950 flex items-center gap-1">
                          <span>COLUMN STUB HEIGHT</span>
                          <span className={cn(
                            "text-[8px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider",
                            hasStub ? "bg-sky-600 text-white" : "bg-gray-200 text-gray-700"
                          )}>
                            {hasStub ? "Key Control" : "No Pillar Stub"}
                          </span>
                        </label>
                        <span className="text-[10px] font-bold text-sky-700 font-mono">
                          {hasStub ? `${stubH.toFixed(2)} ft` : "0.00 ft"}
                        </span>
                      </div>
                      {hasStub ? (
                        <>
                          <input 
                            type="number" step="0.25" min="0.25" max="15"
                            value={stubH}
                            onChange={e => {
                              const val = Math.max(0.1, Number(e.target.value));
                              handleUpdateFooting(selectedFooting.id, { 
                                columnStubHeight: val,
                                excavationDepth: val + fD + pccT + sandD,
                                foundationBedLevel: -(val + fD + pccT + sandD)
                              });
                            }}
                            className="block w-full px-2 py-1 text-xs border border-sky-300 rounded bg-sky-50/40 font-bold text-sky-950 focus:ring-sky-500"
                            title="Vertical RCC stub between Footing top and Ground Floor level"
                          />
                          <span className="text-[8px] text-sky-700/80 mt-0.5 block">Sub-grade pillar connecting Footing top to Ground Floor level</span>
                        </>
                      ) : (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[9px] text-gray-500 italic">Direct connection without column stub</span>
                          <button
                            type="button"
                            onClick={handleAddFoundationPillar}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Add Stub
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Footing Depth</label>
                        <input 
                          type="number" step="0.1" min="0.2" max="10"
                          value={fD}
                          onChange={e => {
                            const val = Math.max(0.2, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { 
                              footingDepth: val,
                              excavationDepth: stubH + val + pccT + sandD,
                              foundationBedLevel: -(stubH + val + pccT + sandD)
                            });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">PCC Thickness</label>
                        <input 
                          type="number" step="0.05" min="0.1" max="3"
                          value={pccT}
                          onChange={e => {
                            const val = Math.max(0.1, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { 
                              pccThickness: val,
                              excavationDepth: stubH + fD + val + sandD,
                              foundationBedLevel: -(stubH + fD + val + sandD)
                            });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Sand Fill Depth</label>
                        <input 
                          type="number" step="0.1" min="0.1" max="5"
                          value={sandD}
                          onChange={e => {
                            const val = Math.max(0.1, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { 
                              sandFillDepth: val,
                              excavationDepth: stubH + fD + pccT + val,
                              foundationBedLevel: -(stubH + fD + pccT + val)
                            });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Foundation Bed Level</label>
                        <input 
                          type="number" step="0.25"
                          value={bedLevel}
                          onChange={e => {
                            const targetBed = Number(e.target.value);
                            handleUpdateFooting(selectedFooting.id, { 
                              foundationBedLevel: targetBed,
                              excavationDepth: Math.abs(targetBed)
                            });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold font-mono text-red-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Plinth Level</label>
                        <input 
                          type="number" step="0.25" min="-5" max="10"
                          value={plinthL}
                          onChange={e => handleUpdateFooting(selectedFooting.id, { plinthLevel: Number(e.target.value) })}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Ground Floor Level</label>
                        <input 
                          type="text" readOnly
                          value="0.00 ft (GL)"
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-gray-100 font-semibold text-gray-500 font-mono cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Foundation Section Live Schematic */}
                    <div className="bg-slate-900 text-white p-2 rounded border border-slate-800 space-y-1 font-mono text-[8.5px]">
                      <div className="flex justify-between items-center text-amber-400 font-bold uppercase tracking-wider text-[8px] border-b border-slate-800 pb-0.5">
                        <span>📐 Foundation Section View</span>
                        <span className="text-emerald-400">Total: -{totalDepth.toFixed(2)}'</span>
                      </div>
                      <div className="flex justify-between bg-slate-800/80 px-1.5 py-0.2 rounded border-l-2 border-emerald-400">
                        <span className="text-slate-300">Ground Level (GL)</span>
                        <span className="text-emerald-400">0.00'</span>
                      </div>
                      {hasStub ? (
                        <div className="flex justify-between bg-sky-950/70 px-1.5 py-0.2 rounded border-l-2 border-sky-400">
                          <span className="text-sky-200">│ Column Stub ({stubW}"×{stubD}")</span>
                          <span className="text-sky-300 font-bold">{stubH.toFixed(2)}'</span>
                        </div>
                      ) : (
                        <div className="flex justify-between bg-slate-800/40 px-1.5 py-0.2 rounded border-l-2 border-dashed border-slate-600">
                          <span className="text-slate-400">│ Column Stub</span>
                          <span className="text-slate-400 italic">None (Direct Connection)</span>
                        </div>
                      )}
                      <div className="flex justify-between bg-amber-950/70 px-1.5 py-0.2 rounded border-l-2 border-amber-500">
                        <span className="text-amber-200">┌ RCC Footing</span>
                        <span className="text-amber-300 font-bold">{fD.toFixed(2)}'</span>
                      </div>
                      <div className="flex justify-between bg-slate-800/60 px-1.5 py-0.2 rounded border-l-2 border-slate-400">
                        <span className="text-slate-300">┌ Plain PCC Base</span>
                        <span className="text-slate-300 font-bold">{pccT.toFixed(2)}'</span>
                      </div>
                      <div className="flex justify-between bg-yellow-950/70 px-1.5 py-0.2 rounded border-l-2 border-yellow-600">
                        <span className="text-yellow-200">~~~~ Sand Bed Fill</span>
                        <span className="text-yellow-300 font-bold">{sandD.toFixed(2)}'</span>
                      </div>
                      <div className="flex justify-between bg-stone-900 px-1.5 py-0.2 rounded border-l-2 border-stone-600">
                        <span className="text-stone-400">════ Bed Level</span>
                        <span className="text-stone-400 font-bold">-{totalDepth.toFixed(2)}'</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. PCC / BASE CONCRETE */}
                  <div className="bg-white p-2.5 rounded-lg border border-gray-200 space-y-2 shadow-xs">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                      <label className="text-[10px] font-black text-gray-800 uppercase tracking-wide">
                        🧱 PCC / BASE CONCRETE
                      </label>
                      <span className="text-[9px] font-mono text-gray-500">
                        {pccL}' × {pccW}'
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">PCC Length</label>
                        <input 
                          type="number" step="0.25" min="1" max="30"
                          value={pccL}
                          onChange={e => handleUpdateFooting(selectedFooting.id, { pccLength: Math.max(0.5, Number(e.target.value)) })}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">PCC Width</label>
                        <input 
                          type="number" step="0.25" min="1" max="30"
                          value={pccW}
                          onChange={e => handleUpdateFooting(selectedFooting.id, { pccWidth: Math.max(0.5, Number(e.target.value)) })}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">PCC Thickness</label>
                        <input 
                          type="number" step="0.05" min="0.1" max="3"
                          value={pccT}
                          onChange={e => {
                            const val = Math.max(0.1, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { 
                              pccThickness: val,
                              excavationDepth: stubH + fD + val + sandD,
                              foundationBedLevel: -(stubH + fD + val + sandD)
                            });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-gray-700 mb-0.5">PCC Mix</label>
                      <select 
                        value={selectedFooting.pccMixRatio || '1:4:8'}
                        onChange={e => handleUpdateFooting(selectedFooting.id, { pccMixRatio: e.target.value as any })}
                        className="block w-full px-2 py-1 text-xs border rounded bg-white font-semibold text-gray-800"
                      >
                        <option value="1:4:8">1:4:8 (Standard Lean Base)</option>
                        <option value="1:3:6">1:3:6 (Heavy Bedding)</option>
                        <option value="1:2:4">1:2:4 (Nominal Mix)</option>
                      </select>
                    </div>
                  </div>

                  {/* 4. EXCAVATION */}
                  <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200 space-y-2 shadow-xs">
                    <div className="flex justify-between items-center border-b border-amber-200/60 pb-1">
                      <label className="text-[10px] font-black text-amber-950 uppercase tracking-wide">
                        🚜 EXCAVATION
                      </label>
                      <span className="text-[9px] font-mono text-amber-800">
                        Pit: {excL}' × {excW}'
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Length ({selectedFooting.excavationUnit || 'ft'})</label>
                        <input 
                          type="number" step="0.25" min="1" max="40"
                          value={excL}
                          onChange={e => handleUpdateFooting(selectedFooting.id, { excavationLength: Math.max(1, Number(e.target.value)) })}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Width ({selectedFooting.excavationUnit || 'ft'})</label>
                        <input 
                          type="number" step="0.25" min="1" max="40"
                          value={excW}
                          onChange={e => handleUpdateFooting(selectedFooting.id, { excavationWidth: Math.max(1, Number(e.target.value)) })}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Depth ({selectedFooting.excavationUnit || 'ft'})</label>
                        <input 
                          type="number" step="0.25" min="1" max="30"
                          value={excD}
                          onChange={e => {
                            const val = Math.max(0.5, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { 
                              excavationDepth: val,
                              foundationBedLevel: -val
                            });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. SAND FILL */}
                  <div className="bg-yellow-50/40 p-2.5 rounded-lg border border-yellow-200 space-y-2 shadow-xs">
                    <div className="flex justify-between items-center border-b border-yellow-200/60 pb-1">
                      <label className="text-[10px] font-black text-yellow-950 uppercase tracking-wide">
                        🏖️ SAND FILL
                      </label>
                      <span className="text-[9px] font-mono text-yellow-800">
                        Depth: {sandD.toFixed(2)} ft
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Sand Fill Depth (ft)</label>
                        <input 
                          type="number" step="0.1" min="0.1" max="5"
                          value={sandD}
                          onChange={e => {
                            const val = Math.max(0.1, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { 
                              sandFillDepth: val,
                              excavationDepth: stubH + fD + pccT + val,
                              foundationBedLevel: -(stubH + fD + pccT + val)
                            });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Compaction Factor</label>
                        <input 
                          type="number" step="0.05" min="1.0" max="1.5"
                          value={sandFactor}
                          onChange={e => {
                            const val = Math.max(1.0, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { 
                              sandCompactionFactor: val,
                              sandFillCompactionFactor: val
                            });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 6. FOUNDATION REINFORCEMENT */}
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-200 space-y-2 shadow-xs">
                    <div className="flex justify-between items-center border-b border-indigo-100 pb-1">
                      <label className="text-[10px] font-black text-indigo-950 uppercase tracking-wide">
                        🔩 FOUNDATION REINFORCEMENT
                      </label>
                      <span className="text-[9px] font-mono text-indigo-700">
                        {selectedFooting.concreteGrade || 'M20'} • Fe500
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Main Bar Diameter</label>
                        <select 
                          value={rebar.mainBarDiaMm || 12}
                          onChange={e => {
                            const dia = Number(e.target.value);
                            handleUpdateFooting(selectedFooting.id, { rebar: { ...rebar, mainBarDiaMm: dia } });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        >
                          <option value={8}>8 mm</option>
                          <option value={10}>10 mm</option>
                          <option value={12}>12 mm</option>
                          <option value={16}>16 mm</option>
                          <option value={20}>20 mm</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Main Bar Count</label>
                        <input 
                          type="number" min="2" max="50"
                          value={rebar.mainBarCount || 6}
                          onChange={e => {
                            const cnt = Math.max(2, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { rebar: { ...rebar, mainBarCount: cnt } });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Distribution Bar Diameter</label>
                        <select 
                          value={rebar.distBarDiaMm || 12}
                          onChange={e => {
                            const dia = Number(e.target.value);
                            handleUpdateFooting(selectedFooting.id, { rebar: { ...rebar, distBarDiaMm: dia } });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        >
                          <option value={8}>8 mm</option>
                          <option value={10}>10 mm</option>
                          <option value={12}>12 mm</option>
                          <option value={16}>16 mm</option>
                          <option value={20}>20 mm</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Distribution Bar Count</label>
                        <input 
                          type="number" min="2" max="50"
                          value={rebar.distBarCount || 6}
                          onChange={e => {
                            const cnt = Math.max(2, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { rebar: { ...rebar, distBarCount: cnt } });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Concrete Cover (mm)</label>
                        <input 
                          type="number" min="20" max="100" step="5"
                          value={rebar.coverMm || 50}
                          onChange={e => {
                            const cov = Math.max(10, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { rebar: { ...rebar, coverMm: cov } });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Stub Stirrup Spacing</label>
                        <input 
                          type="number" min="50" max="300" step="10"
                          value={stubRebar.stirrupSpacingMm || 150}
                          onChange={e => {
                            const sp = Math.max(50, Number(e.target.value));
                            handleUpdateFooting(selectedFooting.id, { columnStubRebar: { ...stubRebar, stirrupSpacingMm: sp } });
                          }}
                          className="block w-full px-1.5 py-1 text-xs border rounded bg-white font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="space-y-2 pt-1 border-t border-amber-200">
                    <button
                      type="button"
                      onClick={() => handleUpdateFooting(selectedFooting.id, {})}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md text-xs shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title="Apply and synchronize all changes live to 3D model and quantities"
                    >
                      <Check className="w-4 h-4" />
                      <span>Apply Changes</span>
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyToAllFootings(selectedFooting)}
                        className="py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[10px] shadow-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Apply these dimensions and levels to ALL footings in this building"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Apply to All</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetFootingDefaults(selectedFooting.id)}
                        className="py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded text-[10px] border border-gray-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Reset this footing to recommended engineering defaults"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Defaults</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="text-[10px] text-gray-500 italic p-3 bg-white rounded border border-amber-100 leading-relaxed">
                {(model.foundation?.footings && model.foundation.footings.length > 0)
                  ? "Click any footing on the 2D canvas or select a button above to inspect and customize its parameters."
                  : "No footings generated yet. Click 'Auto Generate Foundations' above to create aligned footings below Ground Floor pillars."}
              </div>
            )}

            <div className="bg-amber-100/60 text-amber-900 p-2.5 rounded text-[9px] leading-relaxed border border-amber-200">
              <b>Structural Engineering Notice:</b><br/>
              Foundation dimensions, reinforcement bar schedule, and soil bearing depth must be verified by a licensed structural engineer according to IS 456 / IS 1904.
            </div>
          </div>
        ) : activeMode === 'plaster' ? (
          /* Dedicated Plaster / Cement Finish Left Panel */
          <div className="w-full lg:w-80 flex flex-col space-y-3 bg-teal-50/30 p-3.5 rounded-lg border border-teal-200 overflow-y-auto max-h-[calc(100vh-120px)] min-h-[580px] shadow-sm">
            <div className="flex items-center justify-between border-b border-teal-200 pb-2">
              <div className="flex items-center gap-1.5">
                <Paintbrush className="w-4 h-4 text-teal-700" />
                <div>
                  <span className="text-xs font-bold text-teal-950 uppercase tracking-wider block">PLASTER / CEMENT FINISH</span>
                  <span className="text-[9px] font-semibold text-teal-700">Editing: {activeFloor?.name || 'Current Floor'}</span>
                </div>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded",
                plasterConfig.enabled ? "bg-teal-700 text-white" : "bg-gray-200 text-gray-600"
              )}>
                {plasterConfig.enabled ? "ENABLED" : "DISABLED"}
              </span>
            </div>

            {/* 1. MASTER TOGGLE & SCOPE */}
            <div className="space-y-2 bg-white p-2.5 rounded-lg border border-teal-200 shadow-xs">
              <label className="flex items-center space-x-2 text-xs text-gray-800 font-bold cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={plasterConfig.enabled !== false} 
                  onChange={e => handleUpdatePlasterConfig({ enabled: e.target.checked })} 
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4" 
                />
                <span>Enable Plaster Finish</span>
              </label>

              {/* Plaster Scope Buttons: Inner | Outer | Both (Req 4) */}
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wide">
                  Plaster Scope
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['both', 'inner_only', 'outer_only'] as const).map(s => {
                    const label = s === 'both' ? 'Both' : s === 'inner_only' ? 'Inner' : 'Outer';
                    const isSel = plasterConfig.scope === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          handleUpdatePlasterConfig({
                            scope: s,
                            inner: {
                              ...plasterConfig.inner,
                              enabled: s === 'both' || s === 'inner_only'
                            },
                            outer: {
                              ...plasterConfig.outer,
                              enabled: s === 'both' || s === 'outer_only'
                            }
                          });
                        }}
                        className={cn(
                          "py-1 px-1.5 text-[10px] font-bold rounded border text-center transition-all cursor-pointer",
                          isSel 
                            ? "bg-teal-700 text-white border-teal-800 shadow-xs" 
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Surface Target Selector (Req 8) */}
              <div className="pt-1.5 border-t border-teal-100">
                <label className="block text-[10px] font-bold text-gray-700 mb-1 uppercase tracking-wide">
                  Apply to Surfaces:
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { id: 'all', label: 'All Walls' },
                    { id: 'external', label: 'External Walls' },
                    { id: 'internal', label: 'Internal Walls' },
                    { id: 'selected', label: selectedWallForPlasterId ? `Selected (${allWalls.find(w => w.id === selectedWallForPlasterId)?.name || 'Wall'})` : 'Selected Wall' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPlasterTarget(t.id as any)}
                      className={cn(
                        "py-1 px-1.5 text-[10px] font-bold rounded border text-center transition-all cursor-pointer",
                        plasterTarget === t.id
                          ? "bg-teal-700 text-white border-teal-800 shadow-xs"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Apply & Remove Action Buttons (Req 10 & 11) */}
              <div className="pt-2 border-t border-teal-100 space-y-1.5">
                <span className="block text-[9.5px] font-extrabold text-teal-950 uppercase tracking-wide">
                  Manual Surface Application
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={handleApplyInnerPlaster}
                    className="py-1 px-1 text-[9px] font-bold bg-teal-600 hover:bg-teal-700 text-white rounded shadow-xs transition-colors text-center cursor-pointer"
                    title="Apply Inner Plaster with current settings to eligible walls"
                  >
                    Apply Inner
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyOuterPlaster}
                    className="py-1 px-1 text-[9px] font-bold bg-sky-600 hover:bg-sky-700 text-white rounded shadow-xs transition-colors text-center cursor-pointer"
                    title="Apply Outer Plaster with current settings to exterior walls"
                  >
                    Apply Outer
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyRccPlaster}
                    className="py-1 px-1 text-[9px] font-bold bg-slate-700 hover:bg-slate-800 text-white rounded shadow-xs transition-colors text-center cursor-pointer"
                    title="Apply 6mm RCC Column Plaster to exposed columns"
                  >
                    Apply Column
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyRccSideBeamPlaster}
                    className="py-1 px-1 text-[9px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-xs transition-colors text-center cursor-pointer"
                    title="Apply 6mm RCC Side Beam Plaster to exposed beam side faces"
                  >
                    Apply Side Beam
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={handleRemoveInnerPlaster}
                    className="py-1 px-1 text-[9px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded transition-colors text-center cursor-pointer"
                    title="Remove Inner Plaster finishing layer (walls remain intact)"
                  >
                    Remove Inner
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveOuterPlaster}
                    className="py-1 px-1 text-[9px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded transition-colors text-center cursor-pointer"
                    title="Remove Outer Plaster finishing layer (walls remain intact)"
                  >
                    Remove Outer
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveRccPlaster}
                    className="py-1 px-1 text-[9px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded transition-colors text-center cursor-pointer"
                    title="Remove RCC Column Plaster layer (pillars remain intact)"
                  >
                    Remove Column
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveRccSideBeamPlaster}
                    className="py-1 px-1 text-[9px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded transition-colors text-center cursor-pointer"
                    title="Remove RCC Side Beam Plaster layer (beams remain intact)"
                  >
                    Remove Side Beam
                  </button>
                </div>
              </div>

              {/* Common Settings Toggles (Req 13, 14, 15 & 28) */}
              <div className="pt-2 border-t border-teal-100 space-y-1">
                <label className="flex items-center space-x-2 text-[10px] font-bold text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCommonInner}
                    onChange={e => {
                      setUseCommonInner(e.target.checked);
                      handleUpdatePlasterConfig({ useCommonInnerSettings: e.target.checked });
                    }}
                    className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                  />
                  <span>Use Common Inner Plaster Settings</span>
                </label>
                <label className="flex items-center space-x-2 text-[10px] font-bold text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCommonOuter}
                    onChange={e => {
                      setUseCommonOuter(e.target.checked);
                      handleUpdatePlasterConfig({ useCommonOuterSettings: e.target.checked });
                    }}
                    className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Use Common Outer Plaster Settings</span>
                </label>
                <label className="flex items-center space-x-2 text-[10px] font-bold text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCommonRccSideBeam}
                    onChange={e => {
                      setUseCommonRccSideBeam(e.target.checked);
                      handleUpdatePlasterConfig({ useCommonRccSideBeamSettings: e.target.checked });
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Use Common RCC Side Beam Plaster Settings</span>
                </label>
              </div>
            </div>

            {/* 2. INNER MASONRY PLASTER CARD (Req 5) */}
            <div className="bg-white p-2.5 rounded-lg border border-teal-200 space-y-2 shadow-xs">
              <div className="flex justify-between items-center border-b border-teal-100 pb-1">
                <label className="flex items-center space-x-1.5 text-[11px] font-black text-teal-950 uppercase tracking-wide cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={plasterConfig.inner.enabled}
                    onChange={e => handleUpdatePlasterConfig({
                      inner: { ...plasterConfig.inner, enabled: e.target.checked }
                    })}
                    className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                  />
                  <span>🏠 Inner Plaster</span>
                </label>
                <span className="text-[9px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                  {plasterConfig.inner.thickness} {plasterConfig.inner.unit} • {plasterConfig.inner.mixRatio}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">
                    Thickness ({plasterConfig.inner.unit})
                  </label>
                  <div className="flex gap-1">
                    <input 
                      type="number" step="0.5" min="1" max="100"
                      value={plasterConfig.inner.thickness}
                      onChange={e => handleUpdatePlasterConfig({
                        inner: { ...plasterConfig.inner, thickness: Math.max(1, Number(e.target.value)) }
                      })}
                      className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-teal-500 font-mono"
                    />
                    <select
                      value={plasterConfig.inner.unit}
                      onChange={e => handleUpdatePlasterConfig({
                        inner: { ...plasterConfig.inner, unit: e.target.value as PlasterUnit }
                      })}
                      className="px-1 py-1 text-[10px] border border-gray-300 rounded bg-gray-50 font-bold"
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Mix Ratio</label>
                  <select
                    value={plasterConfig.inner.mixRatio}
                    onChange={e => handleUpdatePlasterConfig({
                      inner: { ...plasterConfig.inner, mixRatio: e.target.value }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-teal-500"
                  >
                    <option value="1:3">1:3 (Rich)</option>
                    <option value="1:4">1:4 (Standard)</option>
                    <option value="1:5">1:5 (Medium)</option>
                    <option value="1:6">1:6 (Internal Masonry)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Wastage %</label>
                  <input 
                    type="number" step="1" min="0" max="25"
                    value={plasterConfig.inner.wastagePercent}
                    onChange={e => handleUpdatePlasterConfig({
                      inner: { ...plasterConfig.inner, wastagePercent: Math.max(0, Number(e.target.value)) }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Rate (₹/m²)</label>
                  <input 
                    type="number" step="1" min="0"
                    value={plasterConfig.inner.ratePerSqM || 180}
                    onChange={e => handleUpdatePlasterConfig({
                      inner: { ...plasterConfig.inner, ratePerSqM: Math.max(0, Number(e.target.value)) }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-teal-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 3. OUTER MASONRY PLASTER CARD (Req 6) */}
            <div className="bg-white p-2.5 rounded-lg border border-sky-200 space-y-2 shadow-xs">
              <div className="flex justify-between items-center border-b border-sky-100 pb-1">
                <label className="flex items-center space-x-1.5 text-[11px] font-black text-sky-950 uppercase tracking-wide cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={plasterConfig.outer.enabled}
                    onChange={e => handleUpdatePlasterConfig({
                      outer: { ...plasterConfig.outer, enabled: e.target.checked }
                    })}
                    className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>🌤️ Outer Plaster</span>
                </label>
                <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                  {plasterConfig.outer.thickness} {plasterConfig.outer.unit} • {plasterConfig.outer.mixRatio}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">
                    Thickness ({plasterConfig.outer.unit})
                  </label>
                  <div className="flex gap-1">
                    <input 
                      type="number" step="0.5" min="1" max="100"
                      value={plasterConfig.outer.thickness}
                      onChange={e => handleUpdatePlasterConfig({
                        outer: { ...plasterConfig.outer, thickness: Math.max(1, Number(e.target.value)) }
                      })}
                      className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-sky-500 font-mono"
                    />
                    <select
                      value={plasterConfig.outer.unit}
                      onChange={e => handleUpdatePlasterConfig({
                        outer: { ...plasterConfig.outer, unit: e.target.value as PlasterUnit }
                      })}
                      className="px-1 py-1 text-[10px] border border-gray-300 rounded bg-gray-50 font-bold"
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Mix Ratio</label>
                  <select
                    value={plasterConfig.outer.mixRatio}
                    onChange={e => handleUpdatePlasterConfig({
                      outer: { ...plasterConfig.outer, mixRatio: e.target.value }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-sky-500"
                  >
                    <option value="1:3">1:3 (Weather Shield)</option>
                    <option value="1:4">1:4 (Standard Outer)</option>
                    <option value="1:5">1:5 (Medium)</option>
                    <option value="1:6">1:6 (Dry Zone)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Wastage %</label>
                  <input 
                    type="number" step="1" min="0" max="25"
                    value={plasterConfig.outer.wastagePercent}
                    onChange={e => handleUpdatePlasterConfig({
                      outer: { ...plasterConfig.outer, wastagePercent: Math.max(0, Number(e.target.value)) }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-sky-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Rate (₹/m²)</label>
                  <input 
                    type="number" step="1" min="0"
                    value={plasterConfig.outer.ratePerSqM || 220}
                    onChange={e => handleUpdatePlasterConfig({
                      outer: { ...plasterConfig.outer, ratePerSqM: Math.max(0, Number(e.target.value)) }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-sky-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 4. RCC COLUMN PLASTER CARD */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-2 shadow-xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                <label className="flex items-center space-x-1.5 text-[11px] font-black text-slate-800 uppercase tracking-wide cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={plasterConfig.rcc?.enabled !== false}
                    onChange={e => handleUpdatePlasterConfig({
                      rcc: { ...(plasterConfig.rcc || {}), enabled: e.target.checked }
                    })}
                    className="rounded text-slate-600 focus:ring-slate-500 w-3.5 h-3.5"
                  />
                  <span>🏛️ RCC Column Plaster</span>
                </label>
                <span className="text-[9px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {plasterConfig.rcc?.thickness || 6} mm • {plasterConfig.rcc?.mixRatio || '1:4'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Thickness (mm)</label>
                  <input 
                    type="number" step="1" min="3" max="25"
                    value={plasterConfig.rcc?.thickness || 6}
                    onChange={e => handleUpdatePlasterConfig({
                      rcc: { ...(plasterConfig.rcc || {}), thickness: Math.max(1, Number(e.target.value)) }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-slate-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Mix Ratio</label>
                  <select
                    value={plasterConfig.rcc?.mixRatio || '1:4'}
                    onChange={e => handleUpdatePlasterConfig({
                      rcc: { ...(plasterConfig.rcc || {}), mixRatio: e.target.value }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-slate-500"
                  >
                    <option value="1:3">1:3 (High Adhesion)</option>
                    <option value="1:4">1:4 (CPWD RCC Standard)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Wastage %</label>
                  <input 
                    type="number" step="1" min="0" max="25"
                    value={plasterConfig.rcc?.wastagePercent || 5}
                    onChange={e => handleUpdatePlasterConfig({
                      rcc: { ...(plasterConfig.rcc || {}), wastagePercent: Math.max(0, Number(e.target.value)) }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-slate-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Rate (₹/m²)</label>
                  <input 
                    type="number" step="1" min="0"
                    value={plasterConfig.rcc?.ratePerSqM || 160}
                    onChange={e => handleUpdatePlasterConfig({
                      rcc: { ...(plasterConfig.rcc || {}), ratePerSqM: Math.max(0, Number(e.target.value)) }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-slate-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 5. RCC SIDE BEAM PLASTER CARD (Requirement 23) */}
            <div className="bg-white p-2.5 rounded-lg border border-emerald-300 space-y-2 shadow-xs">
              <div className="flex justify-between items-center border-b border-emerald-100 pb-1">
                <label className="flex items-center space-x-1.5 text-[11px] font-black text-emerald-950 uppercase tracking-wide cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={plasterConfig.rccSideBeam?.enabled !== false}
                    onChange={e => handleUpdatePlasterConfig({
                      rccSideBeam: { ...(plasterConfig.rccSideBeam || DEFAULT_PLASTER_CONFIG.rccSideBeam), enabled: e.target.checked }
                    })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>🏗️ RCC Side Beam Plaster</span>
                </label>
                <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {plasterConfig.rccSideBeam?.thickness || 6} {plasterConfig.rccSideBeam?.unit || 'mm'} • {plasterConfig.rccSideBeam?.mixRatio || '1:4'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">
                    Thickness ({plasterConfig.rccSideBeam?.unit || 'mm'})
                  </label>
                  <div className="flex gap-1">
                    <input 
                      type="number" step="0.5" min="1" max="50"
                      value={plasterConfig.rccSideBeam?.thickness || 6}
                      onChange={e => handleUpdatePlasterConfig({
                        rccSideBeam: { ...(plasterConfig.rccSideBeam || DEFAULT_PLASTER_CONFIG.rccSideBeam), thickness: Math.max(1, Number(e.target.value)) }
                      })}
                      className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-emerald-500 font-mono"
                    />
                    <select
                      value={plasterConfig.rccSideBeam?.unit || 'mm'}
                      onChange={e => handleUpdatePlasterConfig({
                        rccSideBeam: { ...(plasterConfig.rccSideBeam || DEFAULT_PLASTER_CONFIG.rccSideBeam), unit: e.target.value as PlasterUnit }
                      })}
                      className="px-1 py-1 text-[10px] border border-gray-300 rounded bg-gray-50 font-bold"
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Mix Ratio</label>
                  <select
                    value={plasterConfig.rccSideBeam?.mixRatio || '1:4'}
                    onChange={e => handleUpdatePlasterConfig({
                      rccSideBeam: { ...(plasterConfig.rccSideBeam || DEFAULT_PLASTER_CONFIG.rccSideBeam), mixRatio: e.target.value }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-emerald-500"
                  >
                    <option value="1:3">1:3 (High Adhesion)</option>
                    <option value="1:4">1:4 (Standard 1:4)</option>
                    <option value="1:5">1:5 (Medium)</option>
                    <option value="1:6">1:6 (Lean)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Wastage %</label>
                  <input 
                    type="number" step="1" min="0" max="25"
                    value={plasterConfig.rccSideBeam?.wastagePercent ?? 5}
                    onChange={e => handleUpdatePlasterConfig({
                      rccSideBeam: { ...(plasterConfig.rccSideBeam || DEFAULT_PLASTER_CONFIG.rccSideBeam), wastagePercent: Math.max(0, Number(e.target.value)) }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Rate (₹/m²)</label>
                  <input 
                    type="number" step="1" min="0"
                    value={plasterConfig.rccSideBeam?.ratePerSqM ?? 160}
                    onChange={e => handleUpdatePlasterConfig({
                      rccSideBeam: { ...(plasterConfig.rccSideBeam || DEFAULT_PLASTER_CONFIG.rccSideBeam), ratePerSqM: Math.max(0, Number(e.target.value)) }
                    })}
                    className="block w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-gray-900 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>
              <div className="text-[9px] text-emerald-800 bg-emerald-50/60 p-1.5 rounded border border-emerald-200">
                Covers exposed horizontal side surfaces (Side Face A &amp; B) of RCC beams. Slab contact face (top) and soffit face (bottom) are excluded.
              </div>
            </div>

            {/* 5. ESTIMATION FACTORS & LABOUR */}
            <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200 space-y-2 shadow-xs">
              <div className="flex justify-between items-center border-b border-amber-200/70 pb-1">
                <label className="text-[10px] font-black text-amber-950 uppercase tracking-wide">
                  ⚙️ Estimation Factors & Labour
                </label>
                <span className="text-[8.5px] font-mono text-amber-800">IS 1200 / CPWD</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5" title="Dry mortar multiplier (IS 1200 recommends 1.30–1.35)">
                    Dry Mortar Factor
                  </label>
                  <input 
                    type="number" step="0.01" min="1.0" max="2.0"
                    value={plasterConfig.dryVolumeFactor || 1.33}
                    onChange={e => handleUpdatePlasterConfig({ dryVolumeFactor: Math.max(1.0, Number(e.target.value)) })}
                    className="block w-full px-1.5 py-1 text-xs border border-amber-300 rounded bg-white font-bold text-gray-900 focus:ring-amber-500 font-mono"
                  />
                  <span className="text-[8px] text-amber-800/80 block mt-0.5">Default 1.33 (editable)</span>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">
                    Mason Productivity (m²/day)
                  </label>
                  <input 
                    type="number" step="0.5" min="1" max="50"
                    value={plasterConfig.plasterMasonProductivitySqMPerDay || 10}
                    onChange={e => handleUpdatePlasterConfig({ plasterMasonProductivitySqMPerDay: Math.max(1, Number(e.target.value)) })}
                    className="block w-full px-1.5 py-1 text-xs border border-amber-300 rounded bg-white font-bold text-gray-900 focus:ring-amber-500 font-mono"
                  />
                  <span className="text-[8px] text-amber-800/80 block mt-0.5">Default 10 m²/day</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Mason Wage (₹/day)</label>
                  <input 
                    type="number" step="25" min="0"
                    value={plasterConfig.plasterMasonWage || 850}
                    onChange={e => handleUpdatePlasterConfig({ plasterMasonWage: Math.max(0, Number(e.target.value)) })}
                    className="block w-full px-1.5 py-1 text-xs border border-amber-300 rounded bg-white font-bold text-gray-900 focus:ring-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Helper Wage (₹/day)</label>
                  <input 
                    type="number" step="25" min="0"
                    value={plasterConfig.plasterHelperWage || 550}
                    onChange={e => handleUpdatePlasterConfig({ plasterHelperWage: Math.max(0, Number(e.target.value)) })}
                    className="block w-full px-1.5 py-1 text-xs border border-amber-300 rounded bg-white font-bold text-gray-900 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 6. SELECTED WALL OVERRIDE INSPECTOR (Req 12 & 61) */}
            {(() => {
              const selWall = allWalls.find(w => w.id === selectedWallForPlasterId);
              if (!selWall) {
                return (
                  <div className="text-[10px] text-teal-800 italic p-3 bg-teal-50/40 rounded border border-teal-200 leading-relaxed">
                    💡 Click any wall on the 2D canvas to inspect its surface area and customize wall-specific plaster overrides.
                  </div>
                );
              }

              const isExt = activeFloor?.externalWalls.some(w => w.id === selWall.id);
              const wLength = selWall.dimensions?.length || 0;
              const wHeight = selWall.dimensions?.height || activeFloor?.height || 10;
              const grossAreaSqFt = wLength * wHeight;
              const openingsAreaSqFt = (selWall.openings || []).reduce((acc, op) => acc + (op.width * op.height), 0);
              const netAreaSqFt = Math.max(0, grossAreaSqFt - openingsAreaSqFt);
              const overrides = selWall.plasterOverrides || {};

              return (
                <div className="bg-teal-50/70 p-2.5 rounded-lg border-2 border-teal-400 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center border-b border-teal-200 pb-1">
                    <div>
                      <span className="text-[11px] font-black text-teal-950 block">
                        SELECTED WALL: {selWall.name || selWall.id}
                      </span>
                      <span className="text-[9px] text-teal-700 font-semibold">
                        Floor: {activeFloor?.name || 'Ground Floor'} • {isExt ? 'External Wall' : 'Internal Partition'} ({wLength}' × {wHeight}')
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedWallForPlasterId(null)}
                      className="p-1 text-teal-700 hover:text-teal-900 rounded cursor-pointer"
                      title="Deselect wall"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[9px] bg-white p-1.5 rounded border border-teal-200">
                    <div>
                      <span className="text-gray-500">Gross Area:</span>
                      <span className="font-bold text-gray-800 ml-1">{grossAreaSqFt.toFixed(1)} sq ft</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Openings Deduct:</span>
                      <span className="font-bold text-rose-700 ml-1">-{openingsAreaSqFt.toFixed(1)} sq ft</span>
                    </div>
                    <div className="col-span-2 border-t border-gray-100 pt-0.5">
                      <span className="text-teal-900 font-semibold">Net Plaster Face Area:</span>
                      <span className="font-bold text-teal-800 ml-1 font-mono">{netAreaSqFt.toFixed(1)} sq ft</span>
                    </div>
                  </div>

                  {/* Inner Override for this wall */}
                  <div className="space-y-1 bg-white p-2 rounded border border-teal-200">
                    <label className="flex items-center justify-between text-[10px] font-bold text-gray-800 cursor-pointer">
                      <span>Inner Plaster (Face A)</span>
                      <input
                        type="checkbox"
                        checked={overrides.inner?.enabled ?? plasterConfig.inner.enabled}
                        onChange={e => handleUpdateWallPlasterOverride(selWall.id, { innerEnabled: e.target.checked })}
                        className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[8px] font-medium text-gray-500">Thickness (mm)</label>
                        <input
                          type="number" step="1" min="1" max="100"
                          value={overrides.inner?.thickness ?? plasterConfig.inner.thickness}
                          onChange={e => handleUpdateWallPlasterOverride(selWall.id, { innerThickness: Number(e.target.value) })}
                          className="block w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded font-bold font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-medium text-gray-500">Mix Ratio</label>
                        <input
                          type="text"
                          value={overrides.inner?.mixRatio ?? plasterConfig.inner.mixRatio}
                          onChange={e => handleUpdateWallPlasterOverride(selWall.id, { innerMix: e.target.value })}
                          className="block w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded font-bold"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <div>
                        <label className="block text-[8px] font-medium text-gray-500">Wastage (%)</label>
                        <input
                          type="number" step="1" min="0" max="25"
                          value={overrides.inner?.wastagePercent ?? plasterConfig.inner.wastagePercent}
                          onChange={e => handleUpdateWallPlasterOverride(selWall.id, { innerWastage: Number(e.target.value) })}
                          className="block w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-medium text-gray-500">Rate (₹/m²)</label>
                        <input
                          type="number" step="1" min="0"
                          value={overrides.inner?.ratePerSqM ?? plasterConfig.inner.ratePerSqM}
                          onChange={e => handleUpdateWallPlasterOverride(selWall.id, { innerRate: Number(e.target.value) })}
                          className="block w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Outer Override (External walls) */}
                  {isExt ? (
                    <div className="space-y-1 bg-white p-2 rounded border border-sky-200">
                      <label className="flex items-center justify-between text-[10px] font-bold text-gray-800 cursor-pointer">
                        <span>Outer Plaster (Exterior Face)</span>
                        <input
                          type="checkbox"
                          checked={overrides.outer?.enabled ?? plasterConfig.outer.enabled}
                          onChange={e => handleUpdateWallPlasterOverride(selWall.id, { outerEnabled: e.target.checked })}
                          className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[8px] font-medium text-gray-500">Thickness (mm)</label>
                          <input
                            type="number" step="1" min="1" max="100"
                            value={overrides.outer?.thickness ?? plasterConfig.outer.thickness}
                            onChange={e => handleUpdateWallPlasterOverride(selWall.id, { outerThickness: Number(e.target.value) })}
                            className="block w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded font-bold font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-medium text-gray-500">Mix Ratio</label>
                          <input
                            type="text"
                            value={overrides.outer?.mixRatio ?? plasterConfig.outer.mixRatio}
                            onChange={e => handleUpdateWallPlasterOverride(selWall.id, { outerMix: e.target.value })}
                            className="block w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded font-bold"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <div>
                          <label className="block text-[8px] font-medium text-gray-500">Wastage (%)</label>
                          <input
                            type="number" step="1" min="0" max="25"
                            value={overrides.outer?.wastagePercent ?? plasterConfig.outer.wastagePercent}
                            onChange={e => handleUpdateWallPlasterOverride(selWall.id, { outerWastage: Number(e.target.value) })}
                            className="block w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-medium text-gray-500">Rate (₹/m²)</label>
                          <input
                            type="number" step="1" min="0"
                            value={overrides.outer?.ratePerSqM ?? plasterConfig.outer.ratePerSqM}
                            onChange={e => handleUpdateWallPlasterOverride(selWall.id, { outerRate: Number(e.target.value) })}
                            className="block w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[9px] text-teal-800 bg-teal-100/60 p-1.5 rounded">
                      ℹ️ Internal partition wall: both Face A & Face B receive Inner Plaster finish.
                    </div>
                  )}

                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setModel(prev => ({
                          ...prev,
                          floors: prev.floors.map(fl => ({
                            ...fl,
                            externalWalls: fl.externalWalls.map(w => w.id === selWall.id ? { ...w, plasterOverrides: undefined } : w),
                            internalWalls: fl.internalWalls.map(w => w.id === selWall.id ? { ...w, plasterOverrides: undefined } : w)
                          }))
                        }));
                      }}
                      className="flex-1 py-1 text-[10px] font-bold text-gray-700 bg-white hover:bg-gray-100 rounded border border-gray-300 transition-colors cursor-pointer text-center"
                    >
                      Reset to Common
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleUpdateWallPlasterOverride(selWall.id, { innerEnabled: false, outerEnabled: false });
                      }}
                      className="flex-1 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors cursor-pointer text-center"
                    >
                      Remove Finish
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 8. LIVE PLASTER STATS */}
            {result?.plasterEstimate && (
              <div className="bg-gradient-to-br from-teal-50 to-emerald-50/60 p-2.5 rounded-lg border border-teal-200 space-y-1.5 shadow-xs text-[10px]">
                <div className="font-bold text-teal-950 flex justify-between border-b border-teal-200/70 pb-1">
                  <span>Plaster Surface Estimate</span>
                  <span className="font-mono text-teal-800 font-extrabold">{result.plasterEstimate.totalNetPlasterAreaSqFt.toFixed(1)} sq ft</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-gray-700">
                  <div>Cement: <span className="font-bold text-teal-900">{result.plasterEstimate.totalCementBags.toFixed(1)} bags</span></div>
                  <div>Sand: <span className="font-bold text-amber-900">{result.plasterEstimate.totalSandCft.toFixed(1)} cft</span></div>
                  <div>Labour Cost: <span className="font-bold text-gray-900">₹{Math.round(result.plasterEstimate.costs.labour).toLocaleString()}</span></div>
                  <div>Plaster Cost: <span className="font-bold text-emerald-800">₹{Math.round(result.plasterEstimate.costs.total).toLocaleString()}</span></div>
                </div>
              </div>
            )}

            {/* 9. ENGINEERING NOTICE */}
            <div className="bg-teal-100/50 text-teal-900 p-2 rounded text-[9px] leading-relaxed border border-teal-200">
              <b>Civil Engineering Standard:</b><br/>
              Plaster thickness (12mm inner, 15mm outer, 6mm RCC) conforms to IS 1200 / CPWD specifications. Plaster materials (cement & sand) are strictly tracked separately from brick masonry mortar.
            </div>
          </div>
        ) : (
          <div className="w-full lg:w-64 flex flex-col space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-y-auto max-h-[700px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Tools ({activeFloor?.name || 'Floor'})
              </span>
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

                {/* 2D / 3D Precision Coordinate Reference */}
                {selectedPillarId && (
                  <div className="grid grid-cols-2 gap-2 bg-orange-50/70 p-2 rounded-lg border border-orange-200">
                    <div>
                      <label className="block text-[9px] font-bold text-orange-900">Position X ({model.buildingUnit})</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={pillarPosX} 
                        onChange={e => {
                          const val = Number(e.target.value);
                          setPillarPosX(val);
                          updateActiveFloorPillar({ position: { x: val, y: pillarPosZ } });
                        }} 
                        className="block w-full px-1.5 py-0.5 text-xs font-mono font-bold text-orange-950 bg-white border border-orange-300 rounded focus:ring-orange-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-orange-900">Position Z ({model.buildingUnit})</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={pillarPosZ} 
                        onChange={e => {
                          const val = Number(e.target.value);
                          setPillarPosZ(val);
                          updateActiveFloorPillar({ position: { x: pillarPosX, y: val } });
                        }} 
                        className="block w-full px-1.5 py-0.5 text-xs font-mono font-bold text-orange-950 bg-white border border-orange-300 rounded focus:ring-orange-500" 
                      />
                    </div>
                  </div>
                )}

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

                {/* Apply to All Pillars Section */}
                <div className="pt-2 border-t border-gray-200 mt-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-orange-600" />
                      <span>Apply to All Pillars</span>
                    </span>
                  </div>

                  <div className="bg-gray-50 p-2 rounded border border-gray-200 space-y-1">
                    <label className="block text-[9px] font-bold text-gray-600">Apply Scope:</label>
                    <div className="flex items-center space-x-3 text-xs text-gray-800">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input 
                          type="radio" 
                          name="pillarApplyScope" 
                          value="current"
                          checked={applyPillarScope === 'current'}
                          onChange={() => setApplyPillarScope('current')}
                          className="text-orange-600 focus:ring-orange-500 h-3.5 w-3.5"
                        />
                        <span className="text-[10px] font-medium text-gray-700">Current Floor</span>
                      </label>
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input 
                          type="radio" 
                          name="pillarApplyScope" 
                          value="all"
                          checked={applyPillarScope === 'all'}
                          onChange={() => setApplyPillarScope('all')}
                          className="text-orange-600 focus:ring-orange-500 h-3.5 w-3.5"
                        />
                        <span className="text-[10px] font-medium text-gray-700">All Floors</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowApplyAllConfirm(true)}
                    className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
                    title="Apply current pillar shape, dimensions, and alignment to all pillars in the selected scope without changing their positions or IDs"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Apply to All Pillars</span>
                  </button>

                  {applyAllSuccessNotice && (
                    <div className="flex items-start space-x-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded text-[10px] text-emerald-800 animate-in fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1 font-medium leading-tight">{applyAllSuccessNotice}</div>
                    </div>
                  )}
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
                  • RCC Full Ring Beam: <b>{fullBeamEnabled ? `+${fullBeamThickness} ft (Continuous Joint)` : 'OFF'}</b><br/>
                  • Normal Ring Beam: <b>{beamEnabled ? `Active (+${beamHeight} ft)` : 'OFF'}</b><br/>
                  • Total Floor Height: <b>{10 + (fullBeamEnabled ? fullBeamThickness : 0) + (beamEnabled ? beamHeight : 0)} ft</b>
                </div>
              </div>
            )}

            <button 
              onClick={() => { 
                setActiveTool('delete'); 
                setDrawingStart(null); 
              }}
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
              {activeTool === 'delete' && "Click on a wall, opening, or RCC pillar to delete it."}
            </div>
            {activeTool === 'pillar' && pillarPreview.message && (
               <div className={cn("mt-2 text-[10px] p-2 rounded border font-medium", pillarPreview.valid ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
                  {pillarPreview.message}
               </div>
            )}
          </div>
        )}

        {/* INTERACTIVE CANVAS */}
        <div className={cn(
          "flex-1 bg-gray-50 border border-gray-300 rounded-lg overflow-hidden relative shadow-inner",
          activeMode === 'foundation' && isPlacingFooting ? "cursor-crosshair" :
          activeMode === 'foundation' && draggingFootingId ? "cursor-grabbing" :
          activeMode === 'foundation' ? "cursor-default" : "cursor-crosshair"
        )}>
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

              {/* Walls Rendering */}
              {activeMode === 'foundation' ? (
                /* Structural Reference Walls in Foundation Mode */
                (() => {
                  const gf = model.floors[0];
                  if (!gf) return null;
                  const allGfWalls = [...gf.externalWalls, ...gf.internalWalls];
                  return allGfWalls.map(w => {
                    if (!w.start || !w.end) return null;
                    return (
                      <line
                        key={`foundation-ref-wall-${w.id}`}
                        x1={w.start.x} y1={w.start.y} x2={w.end.x} y2={w.end.y}
                        stroke="#cbd5e1"
                        strokeWidth="0.35"
                        strokeDasharray="0.8,0.4"
                        pointerEvents="none"
                      />
                    );
                  });
                })()
              ) : (
                <>
                  {/* External Walls with Geometric Segmentation against Pillars */}
                  {activeFloor?.externalWalls.map(w => {
                     const floorPillars = (model.pillars || []).filter(p => p.floorId === activeFloorId);
                     const segments = splitWallByPillars(w, floorPillars, model.buildingUnit);
                     const tInches = w.dimensions?.thickness || model.externalWallThickness || 9;
                     const tFeet = convertUnit(tInches, 'in', model.buildingUnit);
                     const isSelectedPlaster = activeMode === 'plaster' && selectedWallForPlasterId === w.id;

                     return (
                     <g key={w.id} onClick={(e) => handleWallClick(e, w)} className={activeTool !== 'wall' || activeMode === 'plaster' ? "cursor-pointer" : ""}>
                        {segments.map((seg, sIdx) => {
                          const dx = seg.end.x - seg.start.x;
                          const dy = seg.end.y - seg.start.y;
                          const len = Math.hypot(dx, dy);
                          const nx = len > 0 ? -dy / len : 0;
                          const ny = len > 0 ? dx / len : 0;
                          const offset = (tFeet / 2) + 0.15;

                          return (
                            <React.Fragment key={`${w.id}-seg-${sIdx}`}>
                              {/* Selected wall highlight */}
                              {isSelectedPlaster && (
                                <line 
                                  x1={seg.start.x} y1={seg.start.y} x2={seg.end.x} y2={seg.end.y} 
                                  stroke="#14b8a6" strokeWidth={tFeet + 0.4} strokeLinecap="butt" 
                                  opacity="0.55"
                                />
                              )}
                              {/* Brick Wall Core */}
                              <line 
                                x1={seg.start.x} y1={seg.start.y} x2={seg.end.x} y2={seg.end.y} 
                                stroke="#991b1b" strokeWidth={tFeet} strokeLinecap="butt" 
                                className={activeTool !== 'wall' || activeMode === 'plaster' ? "hover:stroke-red-500 transition-colors" : ""}
                              />
                              {/* 2D Plaster Finish Indicator Lines */}
                              {activeMode === 'plaster' && len > 0 && (() => {
                                const isWallOuterPlaster = (w.plasterOverrides?.outer?.enabled !== undefined ? w.plasterOverrides.outer.enabled : plasterConfig.outer.enabled) && (plasterConfig.scope === 'both' || plasterConfig.scope === 'outer_only') && plasterConfig.enabled !== false;
                                const isWallInnerPlaster = (w.plasterOverrides?.inner?.enabled !== undefined ? w.plasterOverrides.inner.enabled : plasterConfig.inner.enabled) && (plasterConfig.scope === 'both' || plasterConfig.scope === 'inner_only') && plasterConfig.enabled !== false;

                                return (
                                  <>
                                    {/* Outer Plaster Line (Sky/Cyan) */}
                                    {isWallOuterPlaster && (
                                      <line 
                                        x1={seg.start.x + nx * offset} y1={seg.start.y + ny * offset}
                                        x2={seg.end.x + nx * offset} y2={seg.end.y + ny * offset}
                                        stroke="#0284c7" strokeWidth="0.18" strokeDasharray="0.6,0.3"
                                        pointerEvents="none"
                                      />
                                    )}
                                    {/* Inner Plaster Line (Teal) */}
                                    {isWallInnerPlaster && (
                                      <line 
                                        x1={seg.start.x - nx * offset} y1={seg.start.y - ny * offset}
                                        x2={seg.end.x - nx * offset} y2={seg.end.y - ny * offset}
                                        stroke="#0d9488" strokeWidth="0.18"
                                        pointerEvents="none"
                                      />
                                    )}
                                  </>
                                );
                              })()}
                            </React.Fragment>
                          );
                        })}
                     </g>
                     );
                  })}

                  {/* Internal / Custom Walls with Geometric Segmentation against Pillars */}
                  {activeFloor?.internalWalls.map(w => {
                     const floorPillars = (model.pillars || []).filter(p => p.floorId === activeFloorId);
                     const segments = splitWallByPillars(w, floorPillars, model.buildingUnit);
                     const tInches = w.dimensions?.thickness || 4.5;
                     const tFeet = convertUnit(tInches, 'in', model.buildingUnit);
                     const isSelectedPlaster = activeMode === 'plaster' && selectedWallForPlasterId === w.id;

                     return (
                     <g key={w.id} onClick={(e) => handleWallClick(e, w)} className={activeTool !== 'wall' || activeMode === 'plaster' ? "cursor-pointer" : ""}>
                        {segments.map((seg, sIdx) => {
                          const dx = seg.end.x - seg.start.x;
                          const dy = seg.end.y - seg.start.y;
                          const len = Math.hypot(dx, dy);
                          const nx = len > 0 ? -dy / len : 0;
                          const ny = len > 0 ? dx / len : 0;
                          const offset = (tFeet / 2) + 0.15;

                          return (
                            <React.Fragment key={`${w.id}-seg-${sIdx}`}>
                              {/* Selected wall highlight */}
                              {isSelectedPlaster && (
                                <line 
                                  x1={seg.start.x} y1={seg.start.y} x2={seg.end.x} y2={seg.end.y} 
                                  stroke="#14b8a6" strokeWidth={tFeet + 0.4} strokeLinecap="butt" 
                                  opacity="0.55"
                                />
                              )}
                              {/* Brick Wall Core */}
                              <line 
                                x1={seg.start.x} y1={seg.start.y} x2={seg.end.x} y2={seg.end.y} 
                                stroke="#b91c1c" strokeWidth={tFeet} strokeLinecap="butt" 
                                className={activeTool !== 'wall' || activeMode === 'plaster' ? "hover:stroke-red-400 transition-colors" : ""}
                              />
                              {/* 2D Plaster Finish Indicator Lines (Both faces inner teal for internal walls) */}
                              {activeMode === 'plaster' && len > 0 && (() => {
                                const isWallInnerPlaster = (w.plasterOverrides?.inner?.enabled !== undefined ? w.plasterOverrides.inner.enabled : plasterConfig.inner.enabled) && (plasterConfig.scope === 'both' || plasterConfig.scope === 'inner_only') && plasterConfig.enabled !== false;

                                return isWallInnerPlaster ? (
                                  <>
                                    <line 
                                      x1={seg.start.x + nx * offset} y1={seg.start.y + ny * offset}
                                      x2={seg.end.x + nx * offset} y2={seg.end.y + ny * offset}
                                      stroke="#0d9488" strokeWidth="0.18"
                                      pointerEvents="none"
                                    />
                                    <line 
                                      x1={seg.start.x - nx * offset} y1={seg.start.y - ny * offset}
                                      x2={seg.end.x - nx * offset} y2={seg.end.y - ny * offset}
                                      stroke="#0d9488" strokeWidth="0.18"
                                      pointerEvents="none"
                                    />
                                  </>
                                ) : null;
                              })()}
                            </React.Fragment>
                          );
                        })}
                     </g>
                     );
                  })}
                </>
              )}

              {/* Live Drawing Wall (Floor Mode Only) */}
              {activeMode === 'floor' && activeTool === 'wall' && drawingStart && currentMouse && (
                  <line 
                      x1={drawingStart.x} y1={drawingStart.y} 
                      x2={currentMouse.x} y2={currentMouse.y} 
                      stroke="orange" strokeWidth={internalWallThickness / 12} strokeDasharray="0.5,0.5" 
                  />
              )}

              {/* Openings (Floor Mode Only) */}
              {activeMode === 'floor' && allWalls.map(w => {
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
              
              {/* Pillar Live Preview (Floor Mode Only) */}
              {activeMode === 'floor' && activeTool === 'pillar' && currentMouse && (
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

              {/* Ground Floor Foundation Footings Rendering (PCC Base + RCC Footing) - In Foundation Mode Only */}
              {activeMode === 'foundation' && (model.foundation?.footings || []).map(f => {
                const effSize = getEffectiveFootingSize(f, model.foundation);
                const pccW = convertUnit(f.pccWidth || (effSize.width + 1), f.pccUnit || model.buildingUnit, model.buildingUnit);
                const pccL = convertUnit(f.pccLength || (effSize.length + 1), f.pccUnit || model.buildingUnit, model.buildingUnit);
                const fW = convertUnit(effSize.width, effSize.unit, model.buildingUnit);
                const fL = convertUnit(effSize.length, effSize.unit, model.buildingUnit);
                const stubW = convertUnit((f.columnStubWidth ?? 9) / 12, 'ft', model.buildingUnit);
                const stubD = convertUnit((f.columnStubDepth ?? 9) / 12, 'ft', model.buildingUnit);
                const posX = f.position?.x ?? 0;
                const posY = f.position?.y ?? 0;
                const isSelected = selectedFooting?.id === f.id;
                const hasPillar = f.hasFoundationPillar !== false && (f.columnStubHeight === undefined || f.columnStubHeight > 0);

                return (
                  <g 
                    key={`footing-svg-${f.id}`}
                    onMouseDown={(e) => handleFootingMouseDown(e, f)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFootingId(f.id);
                    }}
                    className={cn("cursor-pointer group", draggingFootingId === f.id ? "cursor-grabbing" : "cursor-grab")}
                  >
                    {/* PCC Lean Concrete Layer (Outer Dashed Outline) */}
                    <rect 
                      x={posX - pccL / 2} 
                      y={posY - pccW / 2} 
                      width={pccL} 
                      height={pccW} 
                      fill="#e2e8f0" 
                      fillOpacity="0.55"
                      stroke="#94a3b8" 
                      strokeWidth="0.18" 
                      strokeDasharray="0.6,0.3"
                      className="group-hover:stroke-amber-400 transition-colors"
                    />
                    {/* RCC Footing Body (Inner Solid Outline) */}
                    <rect 
                      x={posX - fL / 2} 
                      y={posY - fW / 2} 
                      width={fL} 
                      height={fW} 
                      fill={isSelected ? "#fed7aa" : "#dbeafe"} 
                      fillOpacity={isSelected ? "0.85" : "0.6"}
                      stroke={isSelected ? "#ea580c" : "#3b82f6"} 
                      strokeWidth={isSelected ? "0.35" : "0.2"}
                      className="hover:stroke-amber-600 transition-colors"
                    />
                    {/* Foundation Column Stub / Pillar Cross Section (only when stub exists) */}
                    {hasPillar && (
                      <g>
                        <rect 
                          x={posX - stubD / 2} 
                          y={posY - stubW / 2} 
                          width={stubD} 
                          height={stubW} 
                          fill={isSelected ? "#ea580c" : "#475569"} 
                          fillOpacity={isSelected ? "0.9" : "0.75"}
                          stroke={isSelected ? "#9a3412" : "#1e293b"} 
                          strokeWidth="0.14" 
                        />
                        <line 
                          x1={posX - stubD / 2} 
                          y1={posY - stubW / 2} 
                          x2={posX + stubD / 2} 
                          y2={posY + stubW / 2} 
                          stroke={isSelected ? "#fed7aa" : "#cbd5e1"} 
                          strokeWidth="0.06" 
                        />
                        <line 
                          x1={posX - stubD / 2} 
                          y1={posY + stubW / 2} 
                          x2={posX + stubD / 2} 
                          y2={posY - stubW / 2} 
                          stroke={isSelected ? "#fed7aa" : "#cbd5e1"} 
                          strokeWidth="0.06" 
                        />
                        {/* 'P' indicator inside column stub footprint */}
                        <text
                          x={posX}
                          y={posY}
                          transform={`scale(1, -1) translate(0, ${-posY * 2})`}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="0.32"
                          fill="#ffffff"
                          fontWeight="bold"
                          className="pointer-events-none select-none font-mono"
                        >
                          P
                        </text>
                      </g>
                    )}
                    {/* Footing Identification Label with Stub Status */}
                    <text 
                      x={posX} 
                      y={posY - fW / 2 - 0.4} 
                      transform={`scale(1, -1) translate(0, ${-(posY - fW / 2 - 0.4) * 2})`}
                      textAnchor="middle" 
                      fontSize="0.45" 
                      fill={isSelected ? "#c2410c" : "#1d4ed8"} 
                      fontWeight="bold"
                      className="pointer-events-none select-none font-mono"
                    >
                      {f.pillarName || f.id} ({effSize.length}'×{effSize.width}' | {hasPillar ? `Stub: ${f.columnStubHeight ?? 2}'` : 'No Stub'})
                    </text>
                  </g>
                );
              })}

              {/* Live Manual Footing Placement Preview (when isPlacingFooting is active) */}
              {activeMode === 'foundation' && isPlacingFooting && foundationMouse && (() => {
                const isCommon = model.foundation?.useCommonFootingSize && model.foundation?.commonFootingSize;
                const previewL = isCommon ? (model.foundation!.commonFootingSize!.length || 4.0) : (model.foundation?.defaultFootingLength || 4.0);
                const previewW = isCommon ? (model.foundation!.commonFootingSize!.width || 4.0) : (model.foundation?.defaultFootingWidth || 4.0);
                const previewPccL = previewL + 1.0;
                const previewPccW = previewW + 1.0;
                const pX = foundationMouse.x;
                const pY = foundationMouse.y;
                const nextLabel = getNextFootingLabel();

                return (
                  <g className="pointer-events-none select-none">
                    {/* PCC Lean Concrete Layer Preview (Outer Dashed Outline) */}
                    <rect 
                      x={pX - previewPccL / 2} 
                      y={pY - previewPccW / 2} 
                      width={previewPccL} 
                      height={previewPccW} 
                      fill="#94a3b8" 
                      fillOpacity="0.3"
                      stroke="#0284c7" 
                      strokeWidth="0.22" 
                      strokeDasharray="0.6,0.3"
                    />
                    {/* RCC Footing Body Preview (Inner Solid Outline) */}
                    <rect 
                      x={pX - previewL / 2} 
                      y={pY - previewW / 2} 
                      width={previewL} 
                      height={previewW} 
                      fill="#fed7aa" 
                      fillOpacity="0.75"
                      stroke="#ea580c" 
                      strokeWidth="0.35" 
                      strokeDasharray="0.5,0.2"
                    />
                    {/* Center Crosshair & Anchor */}
                    <line x1={pX - 1.2} y1={pY} x2={pX + 1.2} y2={pY} stroke="#ea580c" strokeWidth="0.12" />
                    <line x1={pX} y1={pY - 1.2} x2={pX} y2={pY + 1.2} stroke="#ea580c" strokeWidth="0.12" />
                    <circle cx={pX} cy={pY} r={0.25} fill="#ea580c" />
                    {/* Auto-stub preview */}
                    {autoCreateStub && (
                      <rect 
                        x={pX - 0.75 / 2} 
                        y={pY - 0.75 / 2} 
                        width={0.75} 
                        height={0.75} 
                        fill="#ea580c" 
                        fillOpacity="0.6"
                        stroke="#9a3412" 
                        strokeWidth="0.1" 
                      />
                    )}
                    {/* Preview Label Badge */}
                    <text 
                      x={pX} 
                      y={pY - previewW / 2 - 0.45} 
                      transform={`scale(1, -1) translate(0, ${-(pY - previewW / 2 - 0.45) * 2})`}
                      textAnchor="middle" 
                      fontSize="0.5" 
                      fill="#ea580c" 
                      fontWeight="bold"
                      className="font-mono"
                    >
                      [+] Click to Place {nextLabel} ({pX.toFixed(1)}', {pY.toFixed(1)}')
                    </text>
                  </g>
                );
              })()}

              {/* Concrete Pillars Rendering: Structural Reference in Foundation Mode vs Interactive in Floor Mode */}
              {activeMode === 'foundation' ? (
                /* Ground Floor Pillars as Structural Reference in Foundation Mode */
                (() => {
                  const gfId = model.floors[0]?.id || 'floor-0';
                  const gfPillars = (model.pillars || []).filter(p => p.position && (!p.floorId || p.floorId === gfId || p.floorId === 'floor-0' || p.floorId === 'ground'));
                  return gfPillars.map(p => {
                    const effPos = p.position!;
                    const drawW = convertUnit(p.width, p.unit, model.buildingUnit);
                    const drawD = convertUnit(p.depth, p.unit, model.buildingUnit);
                    return (
                      <g key={`foundation-pillar-ref-${p.id}`} className="pointer-events-none opacity-85">
                        {p.shape === 'circular' ? (
                          <circle cx={effPos.x} cy={effPos.y} r={Math.max(drawW, drawD) / 2} fill="#475569" stroke="#1e293b" strokeWidth="0.18" />
                        ) : (
                          <rect x={effPos.x - drawW / 2} y={effPos.y - drawD / 2} width={drawW} height={drawD} fill="#475569" stroke="#1e293b" strokeWidth="0.18" />
                        )}
                        <text 
                          x={effPos.x} y={effPos.y} 
                          transform={`scale(1, -1) translate(0, ${-effPos.y * 2})`}
                          textAnchor="middle" 
                          alignmentBaseline="middle" 
                          fontSize="0.45" 
                          fill="#ffffff" 
                          fontWeight="bold"
                          className="pointer-events-none select-none"
                        >
                          {p.name}
                        </text>
                      </g>
                    );
                  });
                })()
              ) : (
                /* Active Floor Concrete Pillars (Floor-Scoped, Interactive) */
                (model.pillars || []).filter(p => p.position && p.floorId === activeFloorId).map(p => {
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
                            foundation: (isGroundFloor && prev.foundation) ? {
                              ...prev.foundation,
                              footings: prev.foundation.footings.filter(f => f.pillarId !== targetId)
                            } : prev.foundation
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
                            setPillarPosX(p.position?.x ?? 0);
                            setPillarPosZ(p.position?.y ?? 0);
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
                })
              )}
            </g>
          </svg>

          {/* Selected Pillar Inspector Overlay (Floor Mode Only) */}
          {activeMode === 'floor' && selectedPillarId && (() => {
            const p = (model.pillars || []).find(item => item.id === selectedPillarId && item.floorId === activeFloorId);
            if (!p) return null;
            const floorObj = model.floors.find(f => f.id === p.floorId);
            const floorIdx = model.floors.findIndex(f => f.id === p.floorId);
            const floorElevation = floorIdx >= 0 ? floorIdx * 10 : 0;
            const floorAllWalls = floorObj ? [...floorObj.externalWalls, ...floorObj.internalWalls] : allWalls;
            const worldPos = getPillarWorldPosition(p, {
              buildingUnit: model.buildingUnit,
              buildingLength: model.buildingLength,
              buildingWidth: model.buildingWidth,
              floorElevation
            }, floorAllWalls);
            const validation = validatePillarPlacement(p, floorAllWalls, model);

            return (
              <div className="absolute top-4 left-4 z-20 bg-slate-900/95 text-white p-3.5 rounded-xl border border-slate-700 shadow-2xl max-w-xs text-xs space-y-2 backdrop-blur-md animate-in fade-in duration-150">
                <div className="flex justify-between items-center border-b border-slate-700 pb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                    <span className="font-bold text-orange-400 text-sm">{p.name || p.id} Concrete Column</span>
                  </div>
                  <button onClick={() => setSelectedPillarId(null)} className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"><X className="w-3.5 h-3.5" /></button>
                </div>
                
                <div className="space-y-1 text-slate-300">
                  <div><span className="text-slate-400">Pillar ID: </span><span className="font-mono text-cyan-200">{p.id}</span></div>
                  <div><span className="text-slate-400">Floor: </span><span className="font-semibold text-white">{floorObj?.name || 'Current Floor'}</span></div>
                  <div><span className="text-slate-400">Coordinates (2D): </span><span className="font-mono text-cyan-300 font-bold">X: {p.position?.x.toFixed(2)} {model.buildingUnit}, Z: {p.position?.y.toFixed(2)} {model.buildingUnit}</span></div>
                  <div><span className="text-slate-400">3D World: </span><span className="font-mono text-emerald-400 font-bold">X: {worldPos.x.toFixed(2)}m, Z: {worldPos.z.toFixed(2)}m (Y: {worldPos.y.toFixed(2)}m)</span></div>
                  <div><span className="text-slate-400">Dimensions: </span><span className="font-semibold text-white">{p.width} {p.unit} × {p.depth} {p.unit} × {p.height} {model.buildingUnit}</span></div>
                  <div><span className="text-slate-400">Alignment: </span><span className="capitalize font-mono text-cyan-300">{p.alignment?.replace('_', ' ') || 'Outside Corner'}</span></div>
                  <div><span className="text-slate-400">Structure: </span><span className="text-emerald-400 font-semibold">Floor-Isolated RCC Member</span></div>
                  <div><span className="text-slate-400">Verification: </span><span className={validation.isValid ? "text-emerald-400 font-mono font-semibold" : "text-amber-400 font-mono font-semibold"}>{validation.isValid ? "100% Coords Aligned (Drift: 0.000)" : validation.errors[0] || "Checking"}</span></div>
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

      {/* Confirmation Modal for Deleting Foundation Pillar */}
      {confirmDeletePillarFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-red-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-red-600 font-bold mb-2">
              <ShieldAlert className="w-5 h-5" />
              <h4 className="text-base font-bold text-gray-900">
                Delete foundation pillar {confirmDeletePillarFor.foundationPillarId || 'FP'}?
              </h4>
            </div>
            <p className="text-xs text-gray-600 mb-5 leading-relaxed">
              Are you sure you want to remove the foundation column stub for footing <b>{confirmDeletePillarFor.pillarName || confirmDeletePillarFor.id}</b>?
              <br /><br />
              <span className="text-gray-500 block bg-gray-50 p-2 rounded border border-gray-200">
                • Column stub concrete and starter rebar cage will be removed.<br />
                • Footing, PCC base, and Ground Floor pillar will remain intact.
              </span>
            </p>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePillarFor(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFoundationPillar}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Apply to All Pillars */}
      {showApplyAllConfirm && (() => {
        const targetPillars = (model.pillars || []).filter(p => {
          if (applyPillarScope === 'all') return true;
          return p.floorId === activeFloorId;
        });
        const targetCount = targetPillars.length;
        const scopeTitle = applyPillarScope === 'all' ? 'All Floors' : (activeFloor?.name || 'Current Floor');

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-orange-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 text-orange-600 font-bold mb-3">
                <Layers className="w-5 h-5 text-orange-600" />
                <h4 className="text-base font-bold text-gray-900">
                  Apply Pillar Settings to {scopeTitle}?
                </h4>
              </div>

              <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                Copy the current pillar configuration to all RCC pillars on <b>{scopeTitle}</b>:
              </p>

              <div className="bg-orange-50/70 border border-orange-200 rounded-lg p-3 text-xs space-y-1.5 mb-4">
                <div className="flex justify-between text-gray-700">
                  <span className="text-gray-500">Shape:</span>
                  <span className="font-bold capitalize">{pillarShape}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span className="text-gray-500">Dimensions:</span>
                  <span className="font-bold">{pillarWidth}&quot; × {pillarShape === 'circular' ? pillarWidth : pillarDepth}&quot; × {pillarHeight} {model.buildingUnit}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span className="text-gray-500">Alignment:</span>
                  <span className="font-bold capitalize">{pillarAlignment.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span className="text-gray-500">Placement Snap:</span>
                  <span className="font-bold capitalize">{pillarPlacement.replace(/_/g, ' ')}</span>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-[11px] text-gray-600 space-y-1 mb-5">
                <div className="font-bold text-gray-800">
                  • <span className="text-orange-600">{targetCount}</span> RCC pillars will be updated.
                </div>
                <div>• All pillar (X, Z) positions and unique IDs will remain strictly unchanged.</div>
                <div>• Foundation links, rebar cages, and estimates will update automatically.</div>
              </div>

              <div className="flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setShowApplyAllConfirm(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyToAllPillars}
                  className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 active:bg-orange-800 rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  Apply to All Pillars
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Save Project Modal */}
      <SaveProjectModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        model={model}
        brickType={brickType}
        settings={settings}
        result={result}
        defaultName={projectName || 'My Construction Plan'}
      />

      {/* Project History Modal */}
      <ProjectHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onLoadModel={(loadedModel) => setModel(loadedModel)}
      />
    </div>
  );
}
