import { BuildingModel, BrickType, CalculatorSettings, CalculationResult } from './brickCalculator';

export interface SavedProjectSummary {
  id: string;
  name: string;
  totalBricks: number;
  totalCost: number;
  cementBags?: number | null;
  sandVolumeCft?: number | null;
  buildingLength: number;
  buildingWidth: number;
  buildingUnit: string;
  floorsCount: number;
  createdAt: string;
  updatedAt?: string;
  isLocalOnly?: boolean;
}

export interface FullProjectPayload {
  name: string;
  modelData: BuildingModel;
  totalBricks: number;
  totalCost: number;
  cementBags?: number;
  sandVolumeCft?: number;
  buildingLength: number;
  buildingWidth: number;
  buildingUnit: string;
  floorsCount: number;
  settingsData?: CalculatorSettings;
  brickTypeData?: BrickType;
  estimationData?: CalculationResult | null;
}

const LOCAL_STORAGE_KEY = 'brick_factory_saved_projects_v1';

// Save project to PostgreSQL with LocalStorage backup
export async function saveProjectToDatabase(payload: FullProjectPayload): Promise<{ success: boolean; message: string; isLocalFallback?: boolean }> {
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      // Also cache in localStorage for fast offline access
      saveToLocalBackup(data.project);
      return { success: true, message: 'Saved to PostgreSQL Cloud Database!' };
    }

    // If server responded with 503 (e.g. DATABASE_URL not yet configured) or 500:
    console.warn('PostgreSQL API returned notice:', data.error);
    const localItem = saveToLocalBackup({
      id: 'local_' + Date.now(),
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLocalOnly: true,
    });

    return {
      success: true,
      isLocalFallback: true,
      message: data.error?.includes('DATABASE_URL')
        ? 'Saved locally in browser! (Configure DATABASE_URL in .env to sync with cloud PostgreSQL)'
        : (data.error || 'Saved locally in browser.'),
    };
  } catch (err: any) {
    console.warn('Network issue reaching PostgreSQL API, saving locally:', err);
    saveToLocalBackup({
      id: 'local_' + Date.now(),
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLocalOnly: true,
    });
    return {
      success: true,
      isLocalFallback: true,
      message: 'Saved locally in browser cache.',
    };
  }
}

// Fetch all project summaries (merges PostgreSQL + local items)
export async function fetchAllProjects(): Promise<{ projects: SavedProjectSummary[]; dbConnected: boolean }> {
  let dbConnected = false;
  let remoteProjects: SavedProjectSummary[] = [];

  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    if (res.ok && data.success) {
      dbConnected = true;
      remoteProjects = data.projects || [];
    }
  } catch (e) {
    console.warn('Could not fetch from PostgreSQL API:', e);
  }

  // Retrieve local backups
  const localProjects: SavedProjectSummary[] = getLocalBackupList();

  // Merge unique by ID
  const map = new Map<string, SavedProjectSummary>();
  remoteProjects.forEach(p => map.set(p.id, p));
  localProjects.forEach(p => {
    if (!map.has(p.id)) {
      map.set(p.id, p);
    }
  });

  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return { projects: merged, dbConnected };
}

// Fetch single project with complete 3D & Sketch tree
export async function fetchProjectDetails(id: string): Promise<any | null> {
  if (id.startsWith('local_')) {
    return getLocalProjectById(id);
  }

  try {
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json();
    if (res.ok && data.success && data.project) {
      return data.project;
    }
  } catch (e) {
    console.warn('Failed to fetch from DB, checking local cache:', e);
  }

  return getLocalProjectById(id);
}

// Delete project
export async function deleteProjectFromDatabase(id: string): Promise<boolean> {
  deleteFromLocalBackup(id);

  if (id.startsWith('local_')) {
    return true;
  }

  try {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return res.ok && data.success;
  } catch (e) {
    console.warn('Failed to delete from DB:', e);
    return true;
  }
}

// Local storage helper functions
function getLocalBackupList(): SavedProjectSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return list.map((item: any) => ({
      id: item.id,
      name: item.name,
      totalBricks: item.totalBricks,
      totalCost: item.totalCost,
      cementBags: item.cementBags,
      sandVolumeCft: item.sandVolumeCft,
      buildingLength: item.buildingLength,
      buildingWidth: item.buildingWidth,
      buildingUnit: item.buildingUnit || 'ft',
      floorsCount: item.floorsCount || 1,
      createdAt: item.createdAt,
      isLocalOnly: Boolean(item.isLocalOnly),
    }));
  } catch {
    return [];
  }
}

function getLocalProjectById(id: string): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw);
    return list.find((p: any) => p.id === id) || null;
  } catch {
    return null;
  }
}

function saveToLocalBackup(project: any) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const existingIndex = list.findIndex((p: any) => p.id === project.id);
    if (existingIndex >= 0) {
      list[existingIndex] = project;
    } else {
      list.unshift(project);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 30))); // Keep last 30
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

function deleteFromLocalBackup(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    const updated = list.filter((p: any) => p.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage delete error:', e);
  }
}
