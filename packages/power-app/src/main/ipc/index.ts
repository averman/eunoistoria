import { ProjectManager } from '../project-manager';
import { registerProjectHandlers } from './project';

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(projectManager: ProjectManager): void {
  registerProjectHandlers(projectManager);
}
