import React from 'react';
import { useCalculator } from './CalculatorContext';
import { Plus, Trash2 } from 'lucide-react';
import { Unit, Wall } from '@/lib/brickCalculator';

export function SimpleWallForm() {
  const { walls, updateWall, addOpening, removeOpening } = useCalculator();
  const wall = walls[0] || { dimensions: { length: 0, height: 0, thickness: 9, unit: 'ft', thicknessUnit: 'in' }, openings: [] };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Length ({wall.dimensions.unit})</label>
          <input 
            type="number" min="0" value={wall.dimensions.length || ''} 
            onChange={e => updateWall(wall.id, { dimensions: { ...wall.dimensions, length: Number(e.target.value) } })}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold" 
            placeholder="e.g. 20"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Height ({wall.dimensions.unit})</label>
          <input 
            type="number" min="0" value={wall.dimensions.height || ''} 
            onChange={e => updateWall(wall.id, { dimensions: { ...wall.dimensions, height: Number(e.target.value) } })}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold" 
            placeholder="e.g. 10"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Thickness ({wall.dimensions.thicknessUnit || 'in'})</label>
          <input 
            type="number" min="0" value={wall.dimensions.thickness || ''} 
            onChange={e => updateWall(wall.id, { dimensions: { ...wall.dimensions, thickness: Number(e.target.value) } })}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold" 
            placeholder="e.g. 9"
          />
        </div>
      </div>
      
      {/* Openings Section */}
      <div className="pt-4 border-t border-slate-100 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">Doors & Windows Deductions</h3>
        {wall.openings.length > 0 && (
          <div className="space-y-3 mb-4">
            {wall.openings.map((op, i) => (
              <div key={op.id} className="flex items-center gap-3 bg-slate-50 border border-slate-300 p-3 rounded-xl">
                <span className="text-sm font-bold w-16 capitalize text-slate-800">{op.type}</span>
                <input 
                  type="number" min="0" value={op.width || ''} 
                  onChange={e => {
                    const newOps = [...wall.openings];
                    newOps[i].width = Number(e.target.value);
                    updateWall(wall.id, { openings: newOps });
                  }} 
                  className="w-16 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold bg-white" placeholder="W" 
                />
                <span className="text-slate-400 text-xs font-bold">x</span>
                <input 
                  type="number" min="0" value={op.height || ''} 
                  onChange={e => {
                    const newOps = [...wall.openings];
                    newOps[i].height = Number(e.target.value);
                    updateWall(wall.id, { openings: newOps });
                  }} 
                  className="w-16 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold bg-white" placeholder="H" 
                />
                <span className="text-slate-600 text-xs font-bold ml-1">Qty:</span>
                <input 
                  type="number" min="1" value={op.count || ''} 
                  onChange={e => {
                    const newOps = [...wall.openings];
                    newOps[i].count = Number(e.target.value);
                    updateWall(wall.id, { openings: newOps });
                  }} 
                  className="w-14 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold bg-white" 
                />
                <span className="text-slate-500 text-xs font-semibold">{op.unit}</span>
                <button onClick={() => removeOpening(wall.id, op.id)} className="ml-auto text-red-500 hover:text-red-700 p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={() => addOpening(wall.id, { id: Math.random().toString(), type: 'door', width: 3, height: 7, count: 1, unit: wall.dimensions.unit })} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors border border-slate-200">
            + Add Door
          </button>
          <button type="button" onClick={() => addOpening(wall.id, { id: Math.random().toString(), type: 'window', width: 4, height: 4, count: 1, unit: wall.dimensions.unit })} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors border border-slate-200">
            + Add Window
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoomForm() {
  const { walls, updateWall, addOpening, removeOpening, globalUnit } = useCalculator();
  const wallN = walls[0];
  const wallE = walls[1] || walls[0];
  const wallS = walls[2] || walls[0];
  const wallW = walls[3] || walls[0];

  const handleRoomChange = (field: string, value: number) => {
    if (field === 'length') {
      updateWall(walls[0].id, { dimensions: { ...walls[0].dimensions, length: value } });
      if (walls[2]) updateWall(walls[2].id, { dimensions: { ...walls[2].dimensions, length: value } });
    }
    if (field === 'width') {
      if (walls[1]) updateWall(walls[1].id, { dimensions: { ...walls[1].dimensions, length: value } });
      if (walls[3]) updateWall(walls[3].id, { dimensions: { ...walls[3].dimensions, length: value } });
    }
    if (field === 'height' || field === 'thickness') {
      walls.forEach(w => updateWall(w.id, { dimensions: { ...w.dimensions, [field]: value } }));
    }
  };

  const roomWalls = walls.slice(0, 4);
  const allOpenings = roomWalls.flatMap(w => (w.openings || []).map(o => ({ ...o, sourceWallId: w.id })));

  const handleOpeningChange = (sourceWallId: string, openingId: string, field: string, value: any) => {
    const sourceWall = walls.find(w => w.id === sourceWallId);
    if (!sourceWall) return;

    if (field === 'wallSide') {
      const targetWall = roomWalls.find(w => w.name === value);
      if (targetWall && targetWall.id !== sourceWallId) {
        const opening = sourceWall.openings.find(o => o.id === openingId);
        if (opening) {
          removeOpening(sourceWallId, openingId);
          updateWall(targetWall.id, { openings: [...targetWall.openings, { ...opening, wallSide: value }] });
        }
      }
      return;
    }

    const newOps = sourceWall.openings.map(o => o.id === openingId ? { ...o, [field]: value } : o);
    updateWall(sourceWallId, { openings: newOps });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Room Length</label>
          <input 
            type="number" min="0" value={wallN.dimensions.length || ''} 
            onChange={e => handleRoomChange('length', Number(e.target.value))}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold" 
            placeholder="e.g. 12"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Room Width</label>
          <input 
            type="number" min="0" value={wallE.dimensions.length || ''} 
            onChange={e => handleRoomChange('width', Number(e.target.value))}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold" 
            placeholder="e.g. 10"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Room Height</label>
          <input 
            type="number" min="0" value={wallN.dimensions.height || ''} 
            onChange={e => handleRoomChange('height', Number(e.target.value))}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold" 
            placeholder="e.g. 10"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Wall Thickness</label>
          <input 
            type="number" min="0" value={wallN.dimensions.thickness || ''} 
            onChange={e => handleRoomChange('thickness', Number(e.target.value))}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold" 
            placeholder="e.g. 9"
          />
        </div>
      </div>
      
      <div className="pt-4 border-t border-slate-100 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">Doors & Windows Deductions</h3>
        {allOpenings.length > 0 && (
          <div className="space-y-3 mb-4">
            {allOpenings.map((op, i) => (
              <div key={op.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 border border-slate-300 p-3 rounded-xl flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold w-16 capitalize text-slate-800">{op.type}</span>
                  <input 
                    type="number" min="0" value={op.width || ''} 
                    onChange={e => handleOpeningChange(op.sourceWallId, op.id, 'width', Number(e.target.value))} 
                    className="w-16 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold bg-white" placeholder="W" 
                  />
                  <span className="text-slate-400 text-xs font-bold">x</span>
                  <input 
                    type="number" min="0" value={op.height || ''} 
                    onChange={e => handleOpeningChange(op.sourceWallId, op.id, 'height', Number(e.target.value))} 
                    className="w-16 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold bg-white" placeholder="H" 
                  />
                  <span className="text-slate-600 text-xs font-bold ml-1">Qty:</span>
                  <input 
                    type="number" min="1" value={op.count || ''} 
                    onChange={e => handleOpeningChange(op.sourceWallId, op.id, 'count', Number(e.target.value))} 
                    className="w-14 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold bg-white" 
                  />
                </div>
                
                <div className="flex items-center gap-2 flex-grow">
                  <select 
                    value={op.wallSide || 'Front Wall'} 
                    onChange={e => handleOpeningChange(op.sourceWallId, op.id, 'wallSide', e.target.value)}
                    className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 font-bold bg-white"
                  >
                    <option value="Front Wall">Front Wall</option>
                    <option value="Back Wall">Back Wall</option>
                    <option value="Left Wall">Left Wall</option>
                    <option value="Right Wall">Right Wall</option>
                  </select>

                  <select 
                    value={op.position || 'Center'} 
                    onChange={e => handleOpeningChange(op.sourceWallId, op.id, 'position', e.target.value)}
                    className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 font-bold bg-white"
                  >
                    <option value="Left">Left</option>
                    <option value="Center">Center</option>
                    <option value="Right">Right</option>
                    <option value="Custom Offset">Custom Offset</option>
                  </select>
                  
                  {op.position === 'Custom Offset' && (
                    <input 
                      type="number" min="0" step="0.1" value={op.customOffset || ''} 
                      onChange={e => handleOpeningChange(op.sourceWallId, op.id, 'customOffset', Number(e.target.value))} 
                      className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 font-bold bg-white" placeholder="Offset" 
                    />
                  )}
                  
                  <button onClick={() => removeOpening(op.sourceWallId, op.id)} className="ml-auto text-red-500 hover:text-red-700 p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={() => addOpening(wallN.id, { id: Math.random().toString(), type: 'door', width: 3, height: 7, count: 1, unit: globalUnit, wallSide: 'Front Wall', position: 'Center' })} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors border border-slate-200">
            + Main Door
          </button>
          <button type="button" onClick={() => addOpening(wallW.id, { id: Math.random().toString(), type: 'window', width: 4, height: 4, count: 1, unit: globalUnit, wallSide: 'Left Wall', position: 'Center' })} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors border border-slate-200">
            + Window
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2 font-medium">Select the exact room wall for each door and window. Openings are applied only to the wall you choose and are not repeated on all four walls.</p>
      </div>
    </div>
  );
}

// Compound Wall Form
export function CompoundWallForm() {
  const { walls, updateWall, pillars, setPillars, globalUnit, addOpening, removeOpening } = useCalculator();
  const wall = walls[0];

  const handlePillarChange = (field: string, value: number) => {
    if (pillars.length === 0) {
      setPillars([{ id: 'p1', width: 1, depth: 1, height: wall.dimensions.height, count: 10, unit: globalUnit }]);
    }
    const newPillars = [...(pillars.length ? pillars : [{ id: 'p1', width: 1, depth: 1, height: wall.dimensions.height, count: 10, unit: globalUnit }])];
    newPillars[0] = { ...newPillars[0], [field]: value };
    setPillars(newPillars);
  };

  const hasPillars = pillars.length > 0 && pillars[0].count > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Compound Length</label>
          <input 
            type="number" min="0" value={wall.dimensions.length || ''} 
            onChange={e => updateWall(wall.id, { dimensions: { ...wall.dimensions, length: Number(e.target.value) } })}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold" 
            placeholder="e.g. 100"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Wall Height</label>
          <input 
            type="number" min="0" value={wall.dimensions.height || ''} 
            onChange={e => {
              updateWall(wall.id, { dimensions: { ...wall.dimensions, height: Number(e.target.value) } });
              if (hasPillars) handlePillarChange('height', Number(e.target.value));
            }}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold" 
            placeholder="e.g. 6"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Thickness</label>
          <input 
            type="number" min="0" value={wall.dimensions.thickness || ''} 
            onChange={e => updateWall(wall.id, { dimensions: { ...wall.dimensions, thickness: Number(e.target.value) } })}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold" 
            placeholder="e.g. 9"
          />
        </div>
      </div>

      {/* Pillars Option */}
      <div className="pt-4 border-t border-slate-100">
        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input type="checkbox" checked={hasPillars} onChange={(e) => {
            if (e.target.checked) {
              setPillars([{ id: 'p1', width: 1.5, depth: 1.5, height: wall.dimensions.height, count: Math.max(2, Math.floor(wall.dimensions.length / 10)), unit: globalUnit }]);
            } else {
              setPillars([]);
            }
          }} className="w-4 h-4 accent-primary" />
          <span className="text-sm font-bold text-slate-800">Include Brick Pillars / Columns</span>
        </label>

        {hasPillars && (
          <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Pillar Width</label>
              <input 
                type="number" min="0" value={pillars[0]?.width || ''} 
                onChange={e => handlePillarChange('width', Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Pillar Depth</label>
              <input 
                type="number" min="0" value={pillars[0]?.depth || ''} 
                onChange={e => handlePillarChange('depth', Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">No. of Pillars</label>
              <input 
                type="number" min="0" value={pillars[0]?.count || ''} 
                onChange={e => handlePillarChange('count', Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-slate-900 font-bold text-sm" 
              />
            </div>
          </div>
        )}
      </div>

      {/* Openings Section */}
      <div className="pt-4 border-t border-slate-100 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">Gates & Windows Deductions</h3>
        {wall.openings && wall.openings.length > 0 && (
          <div className="space-y-3 mb-4">
            {wall.openings.map((op, i) => (
              <div key={op.id} className="flex items-center gap-3 bg-slate-50 border border-slate-300 p-3 rounded-xl">
                <span className="text-sm font-bold w-16 capitalize text-slate-800">{op.type}</span>
                <input 
                  type="number" min="0" value={op.width || ''} 
                  onChange={e => {
                    const newOps = [...wall.openings];
                    newOps[i].width = Number(e.target.value);
                    updateWall(wall.id, { openings: newOps });
                  }} 
                  className="w-16 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold bg-white" placeholder="W" 
                />
                <span className="text-slate-400 text-xs font-bold">x</span>
                <input 
                  type="number" min="0" value={op.height || ''} 
                  onChange={e => {
                    const newOps = [...wall.openings];
                    newOps[i].height = Number(e.target.value);
                    updateWall(wall.id, { openings: newOps });
                  }} 
                  className="w-16 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold bg-white" placeholder="H" 
                />
                <span className="text-slate-600 text-xs font-bold ml-1">Qty:</span>
                <input 
                  type="number" min="1" value={op.count || ''} 
                  onChange={e => {
                    const newOps = [...wall.openings];
                    newOps[i].count = Number(e.target.value);
                    updateWall(wall.id, { openings: newOps });
                  }} 
                  className="w-14 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold bg-white" 
                />
                <span className="text-slate-500 text-xs font-semibold">{op.unit}</span>
                <button onClick={() => removeOpening(wall.id, op.id)} className="ml-auto text-red-500 hover:text-red-700 p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={() => addOpening(wall.id, { id: Math.random().toString(), type: 'gate', width: 10, height: 6, count: 1, unit: globalUnit || wall.dimensions.unit })} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors border border-slate-200">
            + Add Gate
          </button>
          <button type="button" onClick={() => addOpening(wall.id, { id: Math.random().toString(), type: 'window', width: 4, height: 4, count: 1, unit: globalUnit || wall.dimensions.unit })} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors border border-slate-200">
            + Add Window
          </button>
        </div>
      </div>
    </div>
  );
}

// Balcony Form
export function BalconyForm() {
  const { walls, updateWall } = useCalculator();
  const wallN = walls[0];
  const wallE = walls[1] || walls[0];

  const handleBalconyChange = (field: string, value: number) => {
    if (field === 'length') {
      updateWall(walls[0].id, { dimensions: { ...walls[0].dimensions, length: value } });
    }
    if (field === 'width') {
      if (walls[1]) updateWall(walls[1].id, { dimensions: { ...walls[1].dimensions, length: value } });
      if (walls[3]) updateWall(walls[3].id, { dimensions: { ...walls[3].dimensions, length: value } });
    }
    if (field === 'height' || field === 'thickness') {
      walls.forEach(w => updateWall(w.id, { dimensions: { ...w.dimensions, [field]: value } }));
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Balcony Length</label>
        <input 
          type="number" min="0" value={wallN.dimensions.length || ''} 
          onChange={e => handleBalconyChange('length', Number(e.target.value))}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold" 
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Balcony Width</label>
        <input 
          type="number" min="0" value={wallE.dimensions.length || ''} 
          onChange={e => handleBalconyChange('width', Number(e.target.value))}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold" 
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Parapet Height</label>
        <input 
          type="number" min="0" value={wallN.dimensions.height || ''} 
          onChange={e => handleBalconyChange('height', Number(e.target.value))}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold" 
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Wall Thickness</label>
        <input 
          type="number" min="0" value={wallN.dimensions.thickness || ''} 
          onChange={e => handleBalconyChange('thickness', Number(e.target.value))}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold" 
        />
      </div>
    </div>
  );
}

export function BuildingForm() {
  const { walls, updateWall } = useCalculator();
  const wall = walls[0];

  return (
    <div className="space-y-6">
      <div className="bg-primary/10 text-primary p-4 rounded-xl border border-primary/20 text-sm font-bold">
        Note: The Small Building calculator provides a rough estimate of outer and inner walls based on standard layouts.
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Total Length</label>
          <input 
            type="number" min="0" value={wall.dimensions.length || ''} 
            onChange={e => updateWall(wall.id, { dimensions: { ...wall.dimensions, length: Number(e.target.value) } })}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Total Width</label>
          <input 
            type="number" min="0" value={walls[1]?.dimensions.length || ''} 
            onChange={e => {
              if (walls[1]) updateWall(walls[1].id, { dimensions: { ...walls[1].dimensions, length: Number(e.target.value) } });
            }}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Building Height</label>
          <input 
            type="number" min="0" value={wall.dimensions.height || ''} 
            onChange={e => walls.forEach(w => updateWall(w.id, { dimensions: { ...w.dimensions, height: Number(e.target.value) } }))}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">External Thickness</label>
          <input 
            type="number" min="0" value={wall.dimensions.thickness || ''} 
            onChange={e => updateWall(wall.id, { dimensions: { ...wall.dimensions, thickness: Number(e.target.value) } })}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold" 
          />
        </div>
      </div>
    </div>
  );
}
