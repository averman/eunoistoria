import path from 'path';
import { app, BrowserWindow, Menu } from 'electron';
import { ProjectManager } from './project-manager';
import { registerIpcHandlers } from './ipc/index';

// Ensure Node can resolve external modules (better-sqlite3, etc) from workspace node_modules
if (process.env.NODE_PATH) {
  require('module').globalPaths.push(process.env.NODE_PATH);
}

// The built app should be safe to close for testing
process.env['ELECTRON_DISABLE_SANDBOX'] = 'true';

let mainWindow: any = null;
let projectManager: ProjectManager | null = null;

const createWindow = (): void => {
  const appDir = app.getAppPath();
  const outPath = path.join(appDir, 'out');
  const preloadPath = path.join(outPath, 'preload/index.cjs');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    mainWindow.loadURL(isDev);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(outPath, 'renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', () => {
  // Initialize ProjectManager before creating window
  projectManager = new ProjectManager();
  registerIpcHandlers(projectManager);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Create application menu
const template: any[] = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit();
        },
      },
    ],
  },
];

Menu.setApplicationMenu(Menu.buildFromTemplate(template));
