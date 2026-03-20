import { contextBridge, ipcRenderer } from 'electron';

interface ProjectInfo {
  uuid: string;
  name: string;
  sourcePath: string | null;
  isDirty: boolean;
  createdAt: string;
  lastModifiedAt: string;
}

interface SaveResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

interface CreateProjectInput {
  name: string;
}

const eunostoriaApi = {
  project: {
    create: (input: CreateProjectInput): Promise<ProjectInfo> =>
      ipcRenderer.invoke('project:new', input),
    open: (filePath?: string): Promise<ProjectInfo> =>
      ipcRenderer.invoke('project:open', filePath),
    save: (): Promise<SaveResult> => ipcRenderer.invoke('project:save'),
    getInfo: (): Promise<ProjectInfo | null> => ipcRenderer.invoke('project:getInfo'),
    close: (): Promise<void> => ipcRenderer.invoke('project:close'),
  },
};

contextBridge.exposeInMainWorld('eunoistoria', eunostoriaApi);
