"use client";

import { useCalculator } from "./CalculatorContext";
import { Maximize2, Layers } from "lucide-react";

export function WallPreview() {
  const { walls, mode } = useCalculator();
  
  // Show the first wall or combined representation
  const wall = walls[0];
  
  if (!wall) return null;
  
  // Aspect ratio calculation clamped to sane values
  const len = Math.max(0.1, Number(wall.dimensions.length) || 10);
  const hgt = Math.max(0.1, Number(wall.dimensions.height) || 10);
  const aspect = Math.min(4, Math.max(0.25, len / hgt));
  
  return (
    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-inner relative">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white text-sm font-bold flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" /> Visual Wall Preview
        </h3>
        {mode === 'multiple' && (
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Wall 1 of {walls.length}</span>
        )}
      </div>
      
      <div className="relative w-full h-44 bg-slate-950/70 rounded-xl flex items-center justify-center p-4 overflow-hidden border border-slate-800/80">
        {/* CSS Brick Pattern background */}
        <div 
          className="relative bg-[#a5402d] shadow-lg rounded-sm border-t border-r border-[#c15438]"
          style={{
            width: aspect >= 1 ? '85%' : `${aspect * 85}%`,
            height: aspect >= 1 ? `${(1 / aspect) * 85}%` : '85%',
            maxWidth: '90%',
            maxHeight: '85%',
            minHeight: '40px',
            minWidth: '40px',
            backgroundImage: `
              linear-gradient(335deg, rgba(255,255,255,0.08) 0%, transparent 20%),
              linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 16px 8px, 16px 8px',
            backgroundPosition: '0 0, 0 0, 8px 4px',
          }}
        >
          {/* Approximate Openings Overlay */}
          {wall.openings.map((op) => {
            const wRatio = (Number(op.width) / len) * 100;
            const hRatio = (Number(op.height) / hgt) * 100;
            
            return (
              <div 
                key={op.id} 
                className="absolute bg-slate-950 border border-slate-600/80 shadow-inner flex items-center justify-center"
                style={{
                  width: `${Math.min(90, Math.max(10, wRatio))}%`,
                  height: `${Math.min(90, Math.max(15, hRatio))}%`,
                  bottom: 0,
                  left: op.type === 'door' ? '12%' : '45%',
                  transform: op.type === 'window' ? 'translate(-50%, -40%)' : 'none'
                }}
              >
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                  {op.type === 'door' ? '🚪' : '🪟'} {op.count > 1 ? `x${op.count}` : ''}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Dimension Badges (Clean, no overlap) */}
        <div className="absolute bottom-2 left-3 bg-slate-900/90 border border-slate-700/80 text-[11px] font-medium text-slate-300 px-2 py-0.5 rounded shadow-sm">
          Length: <span className="text-white font-bold">{wall.dimensions.length} {wall.dimensions.unit}</span>
        </div>
        <div className="absolute top-2 right-3 bg-slate-900/90 border border-slate-700/80 text-[11px] font-medium text-slate-300 px-2 py-0.5 rounded shadow-sm">
          Height: <span className="text-white font-bold">{wall.dimensions.height} {wall.dimensions.unit}</span>
        </div>
      </div>
    </div>
  );
}

export function BrickPreview() {
  const { brickType } = useCalculator();
  
  return (
    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 shadow-sm relative">
      <h3 className="text-slate-800 text-sm font-bold flex items-center gap-2 mb-3">
        <Maximize2 className="h-4 w-4 text-primary" /> Selected Brick Dimensions
      </h3>
      
      <div className="flex flex-col items-center justify-center p-3">
        {/* 3D CSS Brick representation */}
        <div className="relative w-36 h-18 bg-[#b84830] rounded shadow-md border-t border-l border-[#d9664e] flex flex-col items-center justify-center text-white/90">
          <div className="text-xs font-black tracking-wider text-white/70">A V M</div>
          <div className="text-[10px] text-white/60 font-mono mt-0.5">{brickType.name}</div>
        </div>
        
        <div className="mt-4 flex items-center justify-center gap-3 text-xs font-bold text-slate-700 uppercase tracking-wider bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-xs">
          <span>{brickType.length}mm L</span>
          <span className="text-slate-300">•</span>
          <span>{brickType.width}mm W</span>
          <span className="text-slate-300">•</span>
          <span>{brickType.height}mm H</span>
        </div>
      </div>
    </div>
  );
}
