"use client";

import React, { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { 
  Wall, 
  BrickType, 
  CalculatorMode,
  CalculatorSettings, 
  calculateProject, 
  CalculationResult,
  Unit,
  Pillar,
  BuildingModel,
  DEFAULT_TN_RED_BRICK
} from "@/lib/brickCalculator";

export type { CalculatorMode };
type DifficultyLevel = 'basic' | 'advanced';
export type TabMode = 'standard' | 'visual';

interface CalculatorState {
  activeTab: TabMode;
  mode: CalculatorMode;
  difficulty: DifficultyLevel;
  projectName: string;
  globalUnit: Unit;
  walls: Wall[];
  pillars: Pillar[];
  brickType: BrickType;
  settings: CalculatorSettings;
  result: CalculationResult | null;
  hasCalculated: boolean;
  
  buildingModel: BuildingModel | null;
  
  // Actions
  setActiveTab: (tab: TabMode) => void;
  setMode: (mode: CalculatorMode) => void;
  setDifficulty: (diff: DifficultyLevel) => void;
  setProjectName: (name: string) => void;
  setGlobalUnit: (unit: Unit) => void;
  setWalls: (walls: Wall[]) => void;
  setPillars: (pillars: Pillar[]) => void;
  addWall: (wall: Wall) => void;
  updateWall: (id: string, wall: Partial<Wall>) => void;
  removeWall: (id: string) => void;
  addOpening: (wallId: string, opening: any) => void;
  removeOpening: (wallId: string, openingId: string) => void;
  setBrickType: (brick: BrickType) => void;
  updateSettings: (settings: Partial<CalculatorSettings>) => void;
  setBuildingModel: (model: BuildingModel | null) => void;
  loadProject: (projectData: {
    model: BuildingModel;
    settings?: Partial<CalculatorSettings>;
    brickType?: BrickType;
    projectName?: string;
  }) => void;
  calculate: () => void;
  reset: () => void;
}

const defaultBrick: BrickType = { ...DEFAULT_TN_RED_BRICK };

const defaultSettings: CalculatorSettings = {
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

const createDefaultWall = (): Wall => ({
  id: Math.random().toString(36).substr(2, 9),
  name: 'Main Wall',
  dimensions: { length: 10, height: 10, thickness: 9, unit: 'ft' as Unit, thicknessUnit: 'in' as Unit },
  openings: []
});

const CalculatorContext = createContext<CalculatorState | undefined>(undefined);

export function CalculatorProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabMode>('standard');
  const [mode, setMode] = useState<CalculatorMode>('simple');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('basic');
  const [projectName, setProjectName] = useState('My Construction Project');
  const [globalUnit, setGlobalUnit] = useState<Unit>('ft');
  const [walls, setWalls] = useState<Wall[]>([createDefaultWall()]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [brickType, setBrickType] = useState<BrickType>(defaultBrick);
  const [settings, setSettings] = useState<CalculatorSettings>(defaultSettings);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [buildingModel, setBuildingModel] = useState<BuildingModel | null>(null);

  const result = useMemo(() => {
    // Single Source of Truth Synchronization
    if (activeTab === 'visual' && buildingModel) {
      return calculateProject({ walls: [], pillars: buildingModel.pillars || [], buildingModel }, brickType, settings);
    }
    return calculateProject({ walls, pillars }, brickType, settings);
  }, [walls, pillars, buildingModel, brickType, settings, activeTab]);

  const calculate = () => {
    setHasCalculated(true);
  };

  const addWall = (wall: Wall) => setWalls(prev => [...prev, wall]);
  
  const updateWall = (id: string, updates: Partial<Wall>) => {
    setWalls(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  };
  
  const removeWall = (id: string) => {
    setWalls(prev => prev.filter(w => w.id !== id));
  };

  const addOpening = (wallId: string, opening: any) => {
    setWalls(prev => prev.map(w => {
      if (w.id === wallId) {
        return { ...w, openings: [...w.openings, opening] };
      }
      return w;
    }));
  };

  const removeOpening = (wallId: string, openingId: string) => {
    setWalls(prev => prev.map(w => {
      if (w.id === wallId) {
        return { ...w, openings: w.openings.filter(o => o.id !== openingId) };
      }
      return w;
    }));
  };

  const updateSettings = (newSettings: Partial<CalculatorSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const reset = () => {
    setActiveTab('standard');
    setMode('simple');
    setDifficulty('basic');
    setProjectName('My Construction Project');
    setGlobalUnit('ft');
    setWalls([createDefaultWall()]);
    setPillars([]);
    setBrickType(defaultBrick);
    setSettings(defaultSettings);
    setBuildingModel(null);
    setHasCalculated(false);
  };

  const loadProject = (projectData: {
    model: BuildingModel;
    settings?: Partial<CalculatorSettings>;
    brickType?: BrickType;
    projectName?: string;
  }) => {
    if (projectData.projectName) setProjectName(projectData.projectName);
    if (projectData.model) {
      setBuildingModel(projectData.model);
      if (projectData.model.buildingUnit) setGlobalUnit(projectData.model.buildingUnit);
    }
    if (projectData.settings) {
      setSettings(prev => ({ ...prev, ...projectData.settings }));
    }
    if (projectData.brickType) {
      setBrickType(projectData.brickType);
    }
    setActiveTab('visual');
    setHasCalculated(true);
  };

  return (
    <CalculatorContext.Provider value={{
      activeTab, mode, difficulty, projectName, globalUnit, walls, pillars, brickType, settings, result, hasCalculated, buildingModel,
      setActiveTab, setMode, setDifficulty, setProjectName, setGlobalUnit, setWalls, setPillars, addWall, updateWall, removeWall,
      addOpening, removeOpening, setBrickType, updateSettings, setBuildingModel, loadProject, calculate, reset
    }}>
      {children}
    </CalculatorContext.Provider>
  );
}

export function useCalculator() {
  const context = useContext(CalculatorContext);
  if (context === undefined) {
    throw new Error('useCalculator must be used within a CalculatorProvider');
  }
  return context;
}
