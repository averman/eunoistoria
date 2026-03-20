import * as fs from 'fs';
import * as path from 'path';
import { app, dialog } from 'electron';
import { FileFormat } from './file-format';
import { EngineManager } from './engine';
import type { Engine } from '../../../types/src/index';

interface ProjectMetadata {
  name: string;
  sourcePath: string | null;
  isDirty: boolean;
  createdAt: string;
  lastModifiedAt: string;
}

interface StateJson {
  lastActiveProjectUuid: string | null;
  projects: Record<string, ProjectMetadata>;
}

export interface ProjectInfo {
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

/**
 * ProjectManager handles project lifecycle: new, open, save, close
 * Manages state.json and working directory structure
 */
export class ProjectManager {
  private userDataPath: string;
  private state: StateJson;
  private currentProject: ProjectInfo | null = null;
  private engineManager: EngineManager;

  constructor(userDataPath?: string) {
    this.userDataPath = userDataPath || app.getPath('userData');
    this.engineManager = new EngineManager();
    this.state = this.loadState();
  }

  /**
   * Load state.json from disk, or create default if missing
   */
  private loadState(): StateJson {
    const statePath = path.join(this.userDataPath, 'state.json');

    try {
      if (fs.existsSync(statePath)) {
        const content = fs.readFileSync(statePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.error('Failed to load state.json:', err);
    }

    // Return default state
    return {
      lastActiveProjectUuid: null,
      projects: {},
    };
  }

  /**
   * Save state.json to disk
   */
  private saveState(): void {
    const statePath = path.join(this.userDataPath, 'state.json');
    fs.mkdirSync(this.userDataPath, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  /**
   * Generate unique project UUID
   */
  private generateUuid(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `proj_${timestamp}_${random}`;
  }

  /**
   * Create a new project
   */
  async createProject(input: CreateProjectInput): Promise<ProjectInfo> {
    const uuid = this.generateUuid();
    const now = new Date().toISOString();

    // Create working directory
    const projectDir = path.join(this.userDataPath, 'projects', uuid);
    fs.mkdirSync(projectDir, { recursive: true });

    // Initialize SQLite database with migrations
    const dbPath = path.join(projectDir, 'db.sqlite');
    const sqliteDataStore = (await import('../../../adapter-sqlite/src/index')).SqliteDataStore;
    const store = new sqliteDataStore(dbPath);

    // Run migrations to initialize schema
    await store.runMigrations?.();

    const projectInfo: ProjectInfo = {
      uuid,
      name: input.name,
      sourcePath: null,
      isDirty: false,
      createdAt: now,
      lastModifiedAt: now,
    };

    // Store in state.json
    this.state.projects[uuid] = projectInfo;
    this.state.lastActiveProjectUuid = uuid;
    this.saveState();

    // Set as current project
    this.currentProject = projectInfo;

    // Initialize engine for this project
    await this.engineManager.initializeEngine(uuid, this.userDataPath, uuid);

    return projectInfo;
  }

  /**
   * Open a .eunoistoria file
   */
  async openProject(filePath?: string): Promise<ProjectInfo> {
    // If no file path provided, show file picker
    let selectedPath = filePath;
    if (!selectedPath) {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: '.eunoistoria Files', extensions: ['eunoistoria'] }],
      });

      if (result.canceled || !result.filePaths[0]) {
        throw new Error('File selection canceled');
      }

      selectedPath = result.filePaths[0];
    }

    // Check if current project is dirty
    if (this.currentProject?.isDirty) {
      const response = await dialog.showMessageBox({
        type: 'question',
        title: 'Save before opening?',
        message: 'Your current project has unsaved changes. Save before opening a new project?',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
      });

      if (response.response === 0) {
        // Save
        await this.save();
      } else if (response.response === 2) {
        // Cancel
        throw new Error('Operation canceled');
      }
      // If "Don't Save", continue without saving
    }

    // Decode the .eunoistoria file
    const sqliteBuffer = await FileFormat.decode(selectedPath);

    // Create new working directory
    const uuid = this.generateUuid();
    const projectDir = path.join(this.userDataPath, 'projects', uuid);
    fs.mkdirSync(projectDir, { recursive: true });

    // Write SQLite database to working directory
    const dbPath = path.join(projectDir, 'db.sqlite');
    fs.writeFileSync(dbPath, sqliteBuffer);

    // Initialize SQLite connection to read project metadata
    const sqliteDataStore = (await import('../../../adapter-sqlite/src/index')).SqliteDataStore;
    const store = new sqliteDataStore(dbPath);

    const now = new Date().toISOString();

    const projectInfo: ProjectInfo = {
      uuid,
      name: path.basename(selectedPath, '.eunoistoria'),
      sourcePath: selectedPath,
      isDirty: false,
      createdAt: now,
      lastModifiedAt: now,
    };

    // Store in state.json
    this.state.projects[uuid] = projectInfo;
    this.state.lastActiveProjectUuid = uuid;
    this.saveState();

    // Set as current project
    this.currentProject = projectInfo;

    // Initialize engine for this project
    await this.engineManager.initializeEngine(uuid, this.userDataPath, uuid);

    return projectInfo;
  }

  /**
   * Save current project (export to .eunoistoria)
   */
  async save(): Promise<SaveResult> {
    if (!this.currentProject) {
      return { success: false, error: 'No project currently active' };
    }

    try {
      let targetPath = this.currentProject.sourcePath;

      // If no sourcePath, show Save As dialog
      if (!targetPath) {
        const result = await dialog.showSaveDialog({
          title: 'Export Project',
          defaultPath: `${this.currentProject.name}.eunoistoria`,
          filters: [{ name: '.eunoistoria Files', extensions: ['eunoistoria'] }],
        });

        if (result.canceled || !result.filePath) {
          throw new Error('Save canceled');
        }

        targetPath = result.filePath;
      }

      // Read current working directory SQLite
      const dbPath = path.join(this.userDataPath, 'projects', this.currentProject.uuid, 'db.sqlite');

      if (!fs.existsSync(dbPath)) {
        return { success: false, error: 'Database file not found' };
      }

      const sqliteBuffer = fs.readFileSync(dbPath);

      // Encode and write .eunoistoria file
      await FileFormat.encode(sqliteBuffer, targetPath);

      // Update project state
      const now = new Date().toISOString();
      this.currentProject.sourcePath = targetPath;
      this.currentProject.isDirty = false;
      this.currentProject.lastModifiedAt = now;

      // Update state.json
      this.state.projects[this.currentProject.uuid] = this.currentProject;
      this.saveState();

      return { success: true, filePath: targetPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get current project info
   */
  getInfo(): ProjectInfo | null {
    if (!this.currentProject) {
      return null;
    }

    // Verify working directory still exists
    const projectDir = path.join(this.userDataPath, 'projects', this.currentProject.uuid);
    if (!fs.existsSync(projectDir)) {
      // Clear state and return null
      delete this.state.projects[this.currentProject.uuid];
      if (this.state.lastActiveProjectUuid === this.currentProject.uuid) {
        this.state.lastActiveProjectUuid = null;
      }
      this.saveState();
      this.currentProject = null;
      return null;
    }

    return this.currentProject;
  }

  /**
   * Close current project
   */
  async closeProject(): Promise<void> {
    if (!this.currentProject) {
      return;
    }

    // Check if dirty
    if (this.currentProject.isDirty) {
      const response = await dialog.showMessageBox({
        type: 'question',
        title: 'Save before closing?',
        message: 'Your project has unsaved changes. Save before closing?',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
      });

      if (response.response === 0) {
        // Save
        await this.save();
      } else if (response.response === 2) {
        // Cancel
        throw new Error('Close canceled');
      }
      // If "Don't Save", continue without saving
    }

    // Close engine
    await this.engineManager.closeEngine();

    // Clear current project
    this.state.lastActiveProjectUuid = null;
    this.saveState();
    this.currentProject = null;
  }

  /**
   * Resume last active project on app launch
   */
  async resumeProject(): Promise<ProjectInfo | null> {
    const uuid = this.state.lastActiveProjectUuid;

    if (!uuid) {
      return null;
    }

    const metadata = this.state.projects[uuid];
    if (!metadata) {
      return null;
    }

    // Verify working directory exists
    const projectDir = path.join(this.userDataPath, 'projects', uuid);
    if (!fs.existsSync(projectDir)) {
      // Clear state
      delete this.state.projects[uuid];
      this.state.lastActiveProjectUuid = null;
      this.saveState();
      return null;
    }

    const projectInfo: ProjectInfo = {
      uuid,
      ...metadata,
    };

    this.currentProject = projectInfo;

    // Initialize engine for this project
    await this.engineManager.initializeEngine(uuid, this.userDataPath, uuid);

    return projectInfo;
  }

  /**
   * Mark current project as dirty
   */
  setDirty(isDirty: boolean): void {
    if (this.currentProject) {
      this.currentProject.isDirty = isDirty;
      this.currentProject.lastModifiedAt = new Date().toISOString();
      this.state.projects[this.currentProject.uuid] = this.currentProject;
      this.saveState();
    }
  }

  /**
   * Get engine for current project
   */
  getEngine(): any {
    return this.engineManager.getEngine();
  }
}
