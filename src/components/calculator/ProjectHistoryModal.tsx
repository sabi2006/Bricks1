"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  FolderClock, 
  Trash2, 
  ArrowRight, 
  Calendar, 
  Building, 
  Layers, 
  Loader2, 
  RefreshCw, 
  Database, 
  Check, 
  HardDrive,
  Save,
  CheckCircle2
} from 'lucide-react';
import { 
  fetchAllProjects, 
  fetchProjectDetails, 
  deleteProjectFromDatabase, 
  saveProjectToDatabase,
  SavedProjectSummary 
} from '@/lib/projectStorage';
import { useCalculator } from './CalculatorContext';

interface ProjectHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSuccess?: (name: string) => void;
  onLoadModel?: (model: any) => void;
}

export function ProjectHistoryModal({ isOpen, onClose, onLoadSuccess, onLoadModel }: ProjectHistoryModalProps) {
  const { loadProject, buildingModel, brickType, settings, result, projectName } = useCalculator();
  const [projects, setProjects] = useState<SavedProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingCurrent, setIsSavingCurrent] = useState(false);
  const [quickSaveNotice, setQuickSaveNotice] = useState<string | null>(null);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleQuickSaveCurrent = async (nameToUse?: string) => {
    if (!buildingModel) {
      alert('No building model is currently designed.');
      return;
    }
    const finalName = nameToUse?.trim() || searchQuery.trim() || projectName || 'My Building Plan';
    setIsSavingCurrent(true);
    try {
      const res = await saveProjectToDatabase({
        name: finalName,
        modelData: buildingModel,
        totalBricks: result?.totalBricks || 0,
        totalCost: result?.totalCost || 0,
        cementBags: result?.cementBags || 0,
        sandVolumeCft: result?.sandVolumeCft || 0,
        buildingLength: buildingModel.buildingLength,
        buildingWidth: buildingModel.buildingWidth,
        buildingUnit: buildingModel.buildingUnit,
        floorsCount: buildingModel.floors.length,
        settingsData: settings,
        brickTypeData: brickType,
        estimationData: result,
      });

      if (res.success) {
        setQuickSaveNotice(`Saved "${finalName}" successfully to Database!`);
        setSearchQuery('');
        await loadList();
        setTimeout(() => setQuickSaveNotice(null), 3500);
      } else {
        alert(res.message || 'Failed to save project.');
      }
    } catch (e: any) {
      alert('Save error: ' + e.message);
    } finally {
      setIsSavingCurrent(false);
    }
  };

  const loadList = async () => {
    setIsLoading(true);
    try {
      const res = await fetchAllProjects();
      setProjects(res.projects);
      setDbConnected(res.dbConnected);
    } catch (err) {
      console.error('Failed to load project history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadList();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectProject = async (projectSummary: SavedProjectSummary) => {
    setLoadingProjectId(projectSummary.id);
    try {
      const fullProject = await fetchProjectDetails(projectSummary.id);
      if (!fullProject || !fullProject.modelData) {
        alert('Could not load 3D model data for this project.');
        return;
      }

      loadProject({
        model: fullProject.modelData,
        settings: fullProject.settingsData,
        brickType: fullProject.brickTypeData,
        projectName: fullProject.name,
      });

      if (onLoadModel) {
        onLoadModel(fullProject.modelData);
      }

      if (onLoadSuccess) {
        onLoadSuccess(fullProject.name);
      }
      onClose();
    } catch (err) {
      console.error('Error restoring project:', err);
      alert('Error loading structure data.');
    } finally {
      setLoadingProjectId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this saved project?')) return;

    setDeletingId(id);
    try {
      await deleteProjectFromDatabase(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-slate-900"
        >
          {/* Modal Header */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-600 rounded-lg text-white">
                <FolderClock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  Building History & Saved 3D Plans
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Database className="w-3 h-3 text-emerald-400" />
                    {dbConnected ? 'PostgreSQL Cloud Sync Active' : 'Offline / Local Cache Active'}
                  </span>
                  <span>&bull;</span>
                  <span>{projects.length} Saved {projects.length === 1 ? 'Design' : 'Designs'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={loadList}
                disabled={isLoading}
                title="Refresh List"
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
            <input
              type="text"
              placeholder="Search saved designs by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Quick Save Alert Banner */}
          {quickSaveNotice && (
            <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{quickSaveNotice}</span>
            </div>
          )}

          {/* Projects List Container */}
          <div className="p-6 overflow-y-auto flex-1 space-y-3.5">
            {isLoading && projects.length === 0 ? (
              <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-3" />
                <p className="text-sm font-medium">Loading saved projects from database...</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
                <Building className="w-12 h-12 text-slate-300 mx-auto" />
                <div>
                  <p className="text-base font-bold text-slate-800">
                    {searchQuery ? `No saved plans match "${searchQuery}"` : "No Saved Plans Found"}
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    {searchQuery 
                      ? `Click below to save your current structure directly as "${searchQuery}".` 
                      : "Save your active structure to PostgreSQL history with one click."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickSaveCurrent(searchQuery)}
                  disabled={isSavingCurrent}
                  className="inline-flex items-center px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
                >
                  {isSavingCurrent ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      <span>Saving to Database...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      <span>Save Current Structure {searchQuery ? `as "${searchQuery}"` : "to Database"}</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              filteredProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => handleSelectProject(project)}
                  className="group relative bg-white hover:bg-orange-50/40 border border-slate-200 hover:border-orange-400 rounded-xl p-4 transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-orange-600 transition-colors truncate">
                        {project.name}
                      </h4>
                      {project.isLocalOnly ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <HardDrive className="w-2.5 h-2.5" /> Local
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Database className="w-2.5 h-2.5" /> Cloud
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(project.createdAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-400" />
                        {project.floorsCount} {project.floorsCount === 1 ? 'Floor' : 'Floors'}
                      </span>
                      <span className="font-mono text-slate-700">
                        {project.buildingLength}×{project.buildingWidth} {project.buildingUnit}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="bg-orange-100/70 text-orange-800 font-bold px-2 py-0.5 rounded font-mono">
                        🧱 {project.totalBricks.toLocaleString()} Bricks
                      </span>
                      <span className="bg-emerald-100/70 text-emerald-800 font-bold px-2 py-0.5 rounded font-mono">
                        ₹{Math.round(project.totalCost).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions Right Side */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={(e) => handleDelete(e, project.id)}
                      disabled={deletingId === project.id}
                      title="Delete design"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      {deletingId === project.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      disabled={loadingProjectId === project.id}
                      className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                    >
                      {loadingProjectId === project.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <span>Load in 3D</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Info */}
          <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
            <span>Clicking "Load in 3D" restores all walls, pillars, ring beams & cost estimates.</span>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition-colors border border-slate-300"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
