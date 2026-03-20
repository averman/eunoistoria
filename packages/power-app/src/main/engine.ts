import * as path from 'path';
import { createEngine } from '@eunoistoria/engine';
import { SqliteDataStore } from '@eunoistoria/adapter-sqlite';
import type { Engine } from '@eunoistoria/types';

/**
 * EngineManager handles lazy initialization of the engine singleton.
 * One engine instance per active project, managed by ProjectManager.
 */
export class EngineManager {
  private engine: Engine | null = null;
  private dataStore: SqliteDataStore | null = null;
  private currentProjectUuid: string | null = null;

  /**
   * Initialize or get the engine for a project
   * @param projectUuid - The project UUID
   * @param userDataPath - Path to userData directory
   * @param projectId - The project ID from the database
   * @returns The engine instance
   */
  async initializeEngine(
    projectUuid: string,
    userDataPath: string,
    projectId: string
  ): Promise<Engine> {
    // If engine already initialized for this project, return it
    if (this.currentProjectUuid === projectUuid && this.engine) {
      return this.engine;
    }

    // Close previous engine if any
    if (this.dataStore) {
      await this.dataStore.disconnect?.();
    }

    // Create new data store for this project
    const dbPath = path.join(userDataPath, 'projects', projectUuid, 'db.sqlite');

    this.dataStore = new SqliteDataStore(dbPath);
    this.engine = createEngine(this.dataStore);
    this.currentProjectUuid = projectUuid;

    return this.engine;
  }

  /**
   * Get the current engine (if initialized)
   */
  getEngine(): Engine | null {
    return this.engine;
  }

  /**
   * Get the current data store (if initialized)
   */
  getDataStore(): SqliteDataStore | null {
    return this.dataStore;
  }

  /**
   * Close the current engine and data store
   */
  async closeEngine(): Promise<void> {
    if (this.dataStore) {
      await this.dataStore.disconnect?.();
    }
    this.engine = null;
    this.dataStore = null;
    this.currentProjectUuid = null;
  }
}
