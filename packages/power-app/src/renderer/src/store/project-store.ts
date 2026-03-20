import { create } from 'zustand';

interface ProjectInfo {
  uuid: string;
  name: string;
  sourcePath: string | null;
  isDirty: boolean;
  createdAt: string;
  lastModifiedAt: string;
}

interface ProjectState {
  // State
  project: ProjectInfo | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProject: (p: ProjectInfo | null) => void;
  setLoading: (b: boolean) => void;
  setError: (msg: string | null) => void;

  // IPC wrappers
  createProject: (name: string) => Promise<void>;
  openProject: (filePath?: string) => Promise<void>;
  saveProject: () => Promise<void>;
  closeProject: () => Promise<void>;
  resumeProject: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  isLoading: false,
  error: null,

  setProject: (p) => set({ project: p }),
  setLoading: (b) => set({ isLoading: b }),
  setError: (msg) => set({ error: msg }),

  createProject: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const project = await window.eunoistoria.project.create({ name });
      set({ project, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      set({ error: message, isLoading: false });
    }
  },

  openProject: async (filePath?: string) => {
    set({ isLoading: true, error: null });
    try {
      const project = await window.eunoistoria.project.open(filePath);
      set({ project, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open project';
      set({ error: message, isLoading: false });
    }
  },

  saveProject: async () => {
    set({ error: null });
    try {
      const result = await window.eunoistoria.project.save();
      if (result.success && result.filePath) {
        const project = await window.eunoistoria.project.getInfo();
        set({ project });
      } else {
        set({ error: result.error || 'Failed to save project' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save project';
      set({ error: message });
    }
  },

  closeProject: async () => {
    set({ error: null });
    try {
      await window.eunoistoria.project.close();
      set({ project: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to close project';
      set({ error: message });
    }
  },

  resumeProject: async () => {
    set({ isLoading: true, error: null });
    try {
      const project = await window.eunoistoria.project.getInfo();
      set({ project, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume project';
      set({ error: message, isLoading: false });
    }
  },
}));
