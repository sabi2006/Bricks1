"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, CheckCircle2, AlertCircle, Loader2, Database, Building, Layers } from 'lucide-react';
import { BuildingModel, BrickType, CalculatorSettings, CalculationResult } from '@/lib/brickCalculator';
import { saveProjectToDatabase } from '@/lib/projectStorage';

interface SaveProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (projectName: string) => void;
  model: BuildingModel;
  brickType: BrickType;
  settings: CalculatorSettings;
  result: CalculationResult | null;
  defaultName?: string;
}

export function SaveProjectModal({
  isOpen,
  onClose,
  onSaved,
  model,
  brickType,
  settings,
  result,
  defaultName = 'My Construction Plan',
}: SaveProjectModalProps) {
  const [projectName, setProjectName] = useState(defaultName);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  if (!isOpen) return null;

  // Calculate quick metrics
  let totalWalls = 0;
  let totalOpenings = 0;
  model.floors.forEach(f => {
    totalWalls += (f.externalWalls.length + f.internalWalls.length);
    [...f.externalWalls, ...f.internalWalls].forEach(w => {
      totalOpenings += (w.openings?.length || 0);
    });
  });

  const totalBricks = result?.totalBricks || 0;
  const totalCost = result?.totalCost || 0;
  const cementBags = result?.cementBags || 0;
  const sandCft = result?.sandVolumeCft || 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await saveProjectToDatabase({
        name: projectName.trim(),
        modelData: model,
        totalBricks,
        totalCost,
        cementBags,
        sandVolumeCft: sandCft,
        buildingLength: model.buildingLength,
        buildingWidth: model.buildingWidth,
        buildingUnit: model.buildingUnit,
        floorsCount: model.floors.length,
        settingsData: settings,
        brickTypeData: brickType,
        estimationData: result,
      });

      if (res.success) {
        setStatusMessage({
          type: res.isLocalFallback ? 'info' : 'success',
          text: res.message,
        });
        setTimeout(() => {
          if (onSaved) onSaved(projectName.trim());
          onClose();
        }, 1200);
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Failed to save project.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error occurred while saving.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-slate-900"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-orange-600 rounded-lg text-white">
                <Save className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Save 3D Structure & Estimate</h3>
                <p className="text-xs text-slate-400">Store to Database History</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-4">
            {/* Project Name Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Ground Floor 2BHK Plan"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-hidden font-medium"
              />
            </div>

            {/* Structure Summary Preview Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2.5">
              <div className="font-bold text-slate-800 flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-orange-600" /> Structure Summary
                </span>
                <span className="text-slate-500 font-mono">
                  {model.buildingLength} × {model.buildingWidth} {model.buildingUnit}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-100">
                  <span>Floors:</span>
                  <span className="font-bold text-slate-900">{model.floors.length}</span>
                </div>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-100">
                  <span>Walls & Columns:</span>
                  <span className="font-bold text-slate-900">{totalWalls}w / {model.pillars?.length || 0}c</span>
                </div>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-100">
                  <span>Total Bricks:</span>
                  <span className="font-bold text-orange-600 font-mono">{totalBricks.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-100">
                  <span>Total Est. Cost:</span>
                  <span className="font-bold text-emerald-600 font-mono">₹{Math.round(totalCost).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Status Feedback Message */}
            {statusMessage && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : statusMessage.type === 'info'
                    ? 'bg-sky-50 text-sky-800 border border-sky-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                )}
                <span className="font-medium">{statusMessage.text}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>Save to History</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
