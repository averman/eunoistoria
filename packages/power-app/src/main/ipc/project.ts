import { ipcMain } from 'electron';
import { ProjectManager } from '../project-manager';
import type { ProjectInfo } from '../project-manager';

export function registerProjectHandlers(projectManager: ProjectManager): void {
  /**
   * project:new — Create a new project
   */
  ipcMain.handle('project:new', async (_event, input: { name: string }) => {
    try {
      const projectInfo = await projectManager.createProject(input);
      return projectInfo;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create project');
    }
  });

  /**
   * project:open — Open a .eunoistoria file
   */
  ipcMain.handle('project:open', async (_event, filePath?: string) => {
    try {
      const projectInfo = await projectManager.openProject(filePath);
      return projectInfo;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to open project');
    }
  });

  /**
   * project:save — Save current project (export to .eunoistoria)
   */
  ipcMain.handle('project:save', async () => {
    try {
      const result = await projectManager.save();
      if (!result.success) {
        throw new Error(result.error || 'Failed to save project');
      }
      return result;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save project');
    }
  });

  /**
   * project:getInfo — Get current project info
   */
  ipcMain.handle('project:getInfo', () => {
    try {
      return projectManager.getInfo();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get project info');
    }
  });

  /**
   * project:close — Close current project
   */
  ipcMain.handle('project:close', async () => {
    try {
      await projectManager.closeProject();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to close project');
    }
  });
}
