"use client";

import { useCalculator } from "./CalculatorContext";
import { motion } from "framer-motion";
import { Settings2, Plus, Trash2, Maximize, Settings, AlignJustify } from "lucide-react";
import { Unit, DEFAULT_BRICK_SIZE, CalculatorMode, BrickSpecification } from "@/lib/brickCalculator";
import { BrickPreview } from "./VisualPreviews";

import { SimpleWallForm, RoomForm, CompoundWallForm, BalconyForm, BuildingForm } from './ProjectForms';

const predefinedBricks: BrickSpecification[] = [
  { id: "standard-red", productId: "standard-red", name: "Standard TN Red Brick", length: DEFAULT_BRICK_SIZE.lengthMm, width: DEFAULT_BRICK_SIZE.widthMm, height: DEFAULT_BRICK_SIZE.heightMm },
  { id: "modular-brick", productId: "modular-brick", name: "Modular Brick", length: 190, width: 90, height: 90 },
  { id: "fly-ash", productId: "fly-ash", name: "Fly Ash Brick", length: 230, width: 115, height: 75 },
  { id: "solid-block", productId: "solid-block", name: "Solid Concrete Block", length: 400, width: 200, height: 200 },
  { id: "hollow-block", productId: "hollow-block", name: "Hollow Concrete Block", length: 400, width: 200, height: 200 },
];

export default function CalculatorSettingsPanel() {
  const { 
    mode, setMode,
    difficulty, setDifficulty, 
    projectName, setProjectName,
    globalUnit, setGlobalUnit,
    walls, setWalls, updateWall, addWall, removeWall,
    addOpening, removeOpening,
    brickType, setBrickType,
    settings, updateSettings,
    hasCalculated, calculate
  } = useCalculator();

  const handleWallChange = (id: string, field: string, value: any) => {
    const wall = walls.find(w => w.id === id);
    if (!wall) return;
    updateWall(id, {
      dimensions: {
        ...wall.dimensions,
        [field]: value
      }
    });
  };

  const handleUnitChange = (id: string, newUnit: Unit) => {
    const wall = walls.find(w => w.id === id);
    if (!wall) return;
    const defaultThicknessUnit: Unit = newUnit === 'ft' ? 'in' : (newUnit === 'm' ? 'mm' : newUnit);
    const defaultThickness = newUnit === 'ft' ? 9 : (newUnit === 'm' ? 230 : 9);
    updateWall(id, {
      dimensions: {
        ...wall.dimensions,
        unit: newUnit,
        thicknessUnit: defaultThicknessUnit,
        thickness: defaultThickness
      }
    });
  };

  const activeWall = walls[0]; // For single wall mode

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 text-slate-900">
      
      {/* Header & Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Wall & Material Specifications</h2>
          <p className="text-sm text-slate-500 mt-1">Configure project dimensions and masonry details</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setDifficulty('basic')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${difficulty === 'basic' ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Basic Mode
          </button>
          <button 
            onClick={() => setDifficulty('advanced')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 ${difficulty === 'advanced' ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Settings2 className="h-4 w-4" /> Advanced
          </button>
        </div>
      </div>

      <div className="space-y-8">
        
        {/* Project Name (Advanced) */}
        {difficulty === 'advanced' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Project Name</label>
            <input 
              type="text" 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
              placeholder="e.g. AVM House - Ground Floor"
            />
          </div>
        )}

        {/* Project Type Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { id: 'simple', label: 'Simple Wall', icon: '🧱' },
            { id: 'multiple', label: 'Multiple Walls', icon: '📏' },
            { id: 'room', label: 'Room', icon: '🚪' },
            { id: 'bathroom', label: 'Bathroom', icon: '🚿' },
            { id: 'compound', label: 'Compound Wall', icon: '⛩️' },
            { id: 'balcony', label: 'Balcony / Parapet', icon: '🏢' },
            { id: 'building', label: 'Small Building', icon: '🏠' },
            { id: 'custom', label: 'Custom Project', icon: '🛠️' },
          ].map(type => (
            <button
              key={type.id}
              onClick={() => {
                setMode(type.id as CalculatorMode);
                // Pre-populate walls based on mode if needed
                if (type.id === 'room' || type.id === 'bathroom' || type.id === 'building') {
                  setWalls([
                    { ...walls[0], id: 'w1', name: 'Front Wall' },
                    { ...walls[0], id: 'w2', name: 'Right Wall' },
                    { ...walls[0], id: 'w3', name: 'Back Wall' },
                    { ...walls[0], id: 'w4', name: 'Left Wall' }
                  ]);
                } else if (type.id === 'balcony') {
                  setWalls([
                    { ...walls[0], id: 'w1', name: 'Front Parapet' },
                    { ...walls[0], id: 'w2', name: 'Right Parapet' },
                    { ...walls[0], id: 'w4', name: 'Left Parapet' } // only 3 sides typically
                  ]);
                } else if (type.id === 'compound') {
                  setWalls([{ ...walls[0], id: 'w1', name: 'Boundary Wall' }]);
                } else if (type.id === 'simple') {
                  setWalls([{ ...walls[0], id: 'w1', name: 'Main Wall' }]);
                }
              }}
              className={`p-4 rounded-2xl border-2 text-center transition-all ${mode === type.id ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'}`}
            >
              <div className="text-2xl mb-2">{type.icon}</div>
              <div className={`text-sm font-bold ${mode === type.id ? 'text-primary' : 'text-slate-700'}`}>{type.label}</div>
            </button>
          ))}
        </div>

        {/* Global Unit Selector */}
        <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span className="text-sm font-bold text-slate-700">Preferred Measurement Unit:</span>
          <select 
            value={globalUnit} 
            onChange={e => {
              const u = e.target.value as Unit;
              setGlobalUnit(u);
              setWalls(walls.map(w => ({ ...w, dimensions: { ...w.dimensions, unit: u } })));
            }}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="ft">Feet & Inches</option>
            <option value="m">Meters</option>
            <option value="cm">Centimeters</option>
          </select>
        </div>

        {/* Dynamic Forms based on mode */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 capitalize">{mode} Dimensions</h3>
          {mode === 'simple' && <SimpleWallForm />}
          {mode === 'room' && <RoomForm />}
          {mode === 'bathroom' && <RoomForm />}
          {mode === 'compound' && <CompoundWallForm />}
          {mode === 'balcony' && <BalconyForm />}
          {mode === 'building' && <BuildingForm />}
          {/* Default fallback for multiple/custom */}
          {(mode === 'multiple' || mode === 'custom') && (
            <>
              <div className="space-y-4">
                {walls.map((wall) => {
              const isFeet = wall.dimensions.unit === 'ft';
              return (
                <div key={wall.id} className="bg-slate-50 border border-slate-200 rounded-xl p-5 relative">
                  {mode === 'multiple' && (
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
                      <input 
                        type="text" 
                        value={wall.name} 
                        onChange={e => updateWall(wall.id, { name: e.target.value })}
                        className="bg-transparent font-bold text-slate-900 border-b border-dashed border-slate-400 focus:border-primary outline-none px-1 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <select 
                          value={wall.dimensions.unit}
                          onChange={(e) => handleUnitChange(wall.id, e.target.value as Unit)}
                          className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-900 focus:ring-1 focus:ring-primary"
                        >
                          <option value="ft">ft</option>
                          <option value="m">m</option>
                          <option value="in">in</option>
                          <option value="cm">cm</option>
                        </select>
                        {walls.length > 1 && (
                          <button onClick={() => removeWall(wall.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="Delete Wall">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                        Length ({wall.dimensions.unit})
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        value={wall.dimensions.length === 0 ? '' : wall.dimensions.length} 
                        onChange={e => handleWallChange(wall.id, 'length', e.target.value === '' ? 0 : Number(e.target.value))} 
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-slate-900 font-bold" 
                        placeholder="e.g. 10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                        Height ({wall.dimensions.unit})
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        value={wall.dimensions.height === 0 ? '' : wall.dimensions.height} 
                        onChange={e => handleWallChange(wall.id, 'height', e.target.value === '' ? 0 : Number(e.target.value))} 
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-slate-900 font-bold" 
                        placeholder="e.g. 10"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Thickness ({wall.dimensions.thicknessUnit || (isFeet ? 'in' : 'mm')})
                        </label>
                        <select 
                          value={wall.dimensions.thicknessUnit || (isFeet ? 'in' : 'mm')}
                          onChange={(e) => handleWallChange(wall.id, 'thicknessUnit', e.target.value as Unit)}
                          className="text-[10px] bg-slate-200 text-slate-800 font-bold rounded px-1.5 py-0.5 border-none"
                        >
                          <option value="in">in</option>
                          <option value="mm">mm</option>
                          <option value="cm">cm</option>
                          <option value="ft">ft</option>
                        </select>
                      </div>
                      <input 
                        type="number" 
                        min="0" 
                        value={wall.dimensions.thickness === 0 ? '' : wall.dimensions.thickness} 
                        onChange={e => handleWallChange(wall.id, 'thickness', e.target.value === '' ? 0 : Number(e.target.value))} 
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-slate-900 font-bold" 
                        placeholder={isFeet ? "e.g. 9" : "e.g. 230"}
                      />
                    </div>
                  </div>

                  {/* Quick Thickness Presets */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Presets:</span>
                    {isFeet ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            handleWallChange(wall.id, 'thickness', 4.5);
                            handleWallChange(wall.id, 'thicknessUnit', 'in');
                          }}
                          className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${wall.dimensions.thickness === 4.5 && (wall.dimensions.thicknessUnit === 'in' || !wall.dimensions.thicknessUnit) ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                        >
                          4.5" (Half Brick)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleWallChange(wall.id, 'thickness', 9);
                            handleWallChange(wall.id, 'thicknessUnit', 'in');
                          }}
                          className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${wall.dimensions.thickness === 9 && (wall.dimensions.thicknessUnit === 'in' || !wall.dimensions.thicknessUnit) ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                        >
                          9" (Standard 1 Brick)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleWallChange(wall.id, 'thickness', 13.5);
                            handleWallChange(wall.id, 'thicknessUnit', 'in');
                          }}
                          className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${wall.dimensions.thickness === 13.5 && (wall.dimensions.thicknessUnit === 'in' || !wall.dimensions.thicknessUnit) ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                        >
                          13.5" (1.5 Brick)
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            handleWallChange(wall.id, 'thickness', 115);
                            handleWallChange(wall.id, 'thicknessUnit', 'mm');
                          }}
                          className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${wall.dimensions.thickness === 115 ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                        >
                          115mm (11.5cm)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleWallChange(wall.id, 'thickness', 230);
                            handleWallChange(wall.id, 'thicknessUnit', 'mm');
                          }}
                          className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${wall.dimensions.thickness === 230 ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                        >
                          230mm (23cm)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleWallChange(wall.id, 'thickness', 345);
                            handleWallChange(wall.id, 'thicknessUnit', 'mm');
                          }}
                          className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${wall.dimensions.thickness === 345 ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                        >
                          345mm (34.5cm)
                        </button>
                      </>
                    )}
                  </div>

                  {/* Openings in Multi Wall Mode */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Doors & Windows</span>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => addOpening(wall.id, { id: Math.random().toString(), type: 'door', width: 3, height: 7, count: 1, unit: wall.dimensions.unit })}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded flex items-center gap-1 border border-slate-200"
                        >
                          <Plus className="h-3 w-3 text-primary" /> Door
                        </button>
                        <button 
                          type="button"
                          onClick={() => addOpening(wall.id, { id: Math.random().toString(), type: 'window', width: 4, height: 4, count: 1, unit: wall.dimensions.unit })}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded flex items-center gap-1 border border-slate-200"
                        >
                          <Plus className="h-3 w-3 text-primary" /> Window
                        </button>
                      </div>
                    </div>
                    {wall.openings && wall.openings.length > 0 && (
                      <div className="space-y-2">
                        {wall.openings.map((op, i) => (
                          <div key={op.id} className="flex items-center gap-2 bg-white border border-slate-300 p-2 rounded-lg">
                            <span className="text-xs font-bold w-14 capitalize text-slate-800">{op.type}</span>
                            <input 
                              type="number" 
                              min="0" 
                              value={op.width === 0 ? '' : op.width} 
                              onChange={e => {
                                const newOps = [...wall.openings];
                                newOps[i].width = e.target.value === '' ? 0 : Number(e.target.value);
                                updateWall(wall.id, { openings: newOps });
                              }} 
                              className="w-14 px-1.5 py-1 border border-slate-300 rounded text-xs text-slate-900 font-bold bg-white" 
                              placeholder="W" 
                            />
                            <span className="text-slate-400 text-xs">x</span>
                            <input 
                              type="number" 
                              min="0" 
                              value={op.height === 0 ? '' : op.height} 
                              onChange={e => {
                                const newOps = [...wall.openings];
                                newOps[i].height = e.target.value === '' ? 0 : Number(e.target.value);
                                updateWall(wall.id, { openings: newOps });
                              }} 
                              className="w-14 px-1.5 py-1 border border-slate-300 rounded text-xs text-slate-900 font-bold bg-white" 
                              placeholder="H" 
                            />
                            <span className="text-slate-500 text-xs ml-1 font-bold">Qty:</span>
                            <input 
                              type="number" 
                              min="1" 
                              value={op.count === 0 ? '' : op.count} 
                              onChange={e => {
                                const newOps = [...wall.openings];
                                newOps[i].count = e.target.value === '' ? 0 : Number(e.target.value);
                                updateWall(wall.id, { openings: newOps });
                              }} 
                              className="w-12 px-1.5 py-1 border border-slate-300 rounded text-xs text-slate-900 font-bold bg-white" 
                            />
                            <button onClick={() => removeOpening(wall.id, op.id)} className="ml-auto text-red-500 hover:text-red-700">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {mode === 'multiple' && (
            <button 
              onClick={() => addWall({ 
                id: Math.random().toString(), 
                name: `Wall ${walls.length + 1}`, 
                dimensions: { ...walls[walls.length - 1].dimensions }, 
                openings: [] 
              })}
              className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:text-primary hover:border-primary transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Plus className="h-5 w-5" /> Add Another Wall
            </button>
          )}
        </>
      )}
    </div>

    {/* Brick Selection */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <AlignJustify className="h-5 w-5 text-primary" /> Brick Type & Size
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {predefinedBricks.map(brick => (
              <button
                key={brick.id}
                type="button"
                onClick={() => setBrickType(brick)}
                className={`p-3 rounded-xl border text-xs font-bold transition-all text-left ${brickType.id === brick.id ? 'border-primary bg-primary/10 text-primary shadow-xs' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
              >
                <div>{brick.name}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{brick.length}×{brick.width}×{brick.height}mm</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Length (mm)</label>
              <input 
                type="number" 
                min="0" 
                value={brickType.length === 0 ? '' : brickType.length} 
                onChange={e => setBrickType({...brickType, length: e.target.value === '' ? 0 : Number(e.target.value), id: 'custom', productId: 'custom'})} 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-slate-900 font-bold" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Width (mm)</label>
              <input 
                type="number" 
                min="0" 
                value={brickType.width === 0 ? '' : brickType.width} 
                onChange={e => setBrickType({...brickType, width: e.target.value === '' ? 0 : Number(e.target.value), id: 'custom', productId: 'custom'})} 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-slate-900 font-bold" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Height (mm)</label>
              <input 
                type="number" 
                min="0" 
                value={brickType.height === 0 ? '' : brickType.height} 
                onChange={e => setBrickType({...brickType, height: e.target.value === '' ? 0 : Number(e.target.value), id: 'custom', productId: 'custom'})} 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-slate-900 font-bold" 
              />
            </div>
          </div>
          
          <BrickPreview />
        </div>

        {/* Basic Wastage */}
        <div className="pt-4 border-t border-slate-100">
           <label className="flex items-center justify-between text-sm font-bold text-slate-800 mb-3">
             Wastage Allowance
             <span className="text-primary bg-primary/10 px-2.5 py-1 rounded-md font-bold">{settings.wastagePercentage}%</span>
           </label>
           <input 
             type="range" 
             min="0" max="15" step="1"
             value={settings.wastagePercentage}
             onChange={e => updateSettings({ wastagePercentage: Number(e.target.value) })}
             className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
           />
           <div className="flex justify-between text-xs text-slate-500 mt-2 font-semibold">
             <span>0%</span>
             <span>5% (Recommended Standard)</span>
             <span>15%</span>
           </div>
        </div>

        {/* Advanced Settings */}
        {difficulty === 'advanced' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="pt-6 border-t border-slate-100 space-y-6"
          >
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" /> Advanced Estimation
            </h3>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-700 border-b pb-2">Construction Specs</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Horiz. Mortar (mm)</label>
                    <input 
                      type="number" 
                      value={settings.mortarJointHorizontal === 0 ? '' : settings.mortarJointHorizontal} 
                      onChange={e => updateSettings({mortarJointHorizontal: e.target.value === '' ? 0 : Number(e.target.value)})} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Vert. Mortar (mm)</label>
                    <input 
                      type="number" 
                      value={settings.mortarJointVertical === 0 ? '' : settings.mortarJointVertical} 
                      onChange={e => updateSettings({mortarJointVertical: e.target.value === '' ? 0 : Number(e.target.value)})} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Mortar Mix (Cement)</label>
                    <input 
                      type="number" 
                      value={settings.mixRatioCement === 0 ? '' : settings.mixRatioCement} 
                      onChange={e => updateSettings({mixRatioCement: e.target.value === '' ? 0 : Number(e.target.value)})} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Mortar Mix (Sand)</label>
                    <input 
                      type="number" 
                      value={settings.mixRatioSand === 0 ? '' : settings.mixRatioSand} 
                      onChange={e => updateSettings({mixRatioSand: e.target.value === '' ? 0 : Number(e.target.value)})} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold" 
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-700 border-b pb-2">Material Pricing (₹)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Price per Brick</label>
                    <input 
                      type="number" 
                      value={settings.brickPrice === 0 ? '' : settings.brickPrice} 
                      onChange={e => updateSettings({brickPrice: e.target.value === '' ? 0 : Number(e.target.value)})} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Cement per Bag</label>
                    <input 
                      type="number" 
                      value={settings.cementPrice === 0 ? '' : settings.cementPrice} 
                      onChange={e => updateSettings({cementPrice: e.target.value === '' ? 0 : Number(e.target.value)})} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Sand per m³</label>
                    <input 
                      type="number" 
                      value={settings.sandPrice === 0 ? '' : settings.sandPrice} 
                      onChange={e => updateSettings({sandPrice: e.target.value === '' ? 0 : Number(e.target.value)})} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Transport (Est.)</label>
                    <input 
                      type="number" 
                      value={settings.transportCost === 0 ? '' : settings.transportCost} 
                      onChange={e => updateSettings({transportCost: e.target.value === '' ? 0 : Number(e.target.value)})} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold" 
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Calculate Button */}
        <div className="pt-6 border-t border-slate-200 mt-8">
          <button
            onClick={() => {
              calculate();
              // Scroll to results on mobile smoothly
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }}
            className="w-full py-4 bg-primary hover:bg-[#F97316] text-white rounded-xl font-bold text-lg shadow-xl shadow-primary/30 transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {hasCalculated ? 'Recalculate Estimate' : 'Calculate Estimate'}
          </button>
          {!hasCalculated && (
             <p className="text-center text-xs text-slate-500 mt-3 font-medium">Click to view your estimate and 3D preview</p>
          )}
        </div>
      </div>
    </div>
  );
}
