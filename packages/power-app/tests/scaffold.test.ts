import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

const packageRoot = join(import.meta.dirname, '..');

describe('PA-001: Electron + Vite + React Scaffold', () => {
  it('TC-PA001-01: Main process entry file exists', () => {
    const mainPath = join(packageRoot, 'src', 'main', 'index.ts');
    expect(existsSync(mainPath)).toBe(true);
  });

  it('TC-PA001-02: Preload entry file exists', () => {
    const preloadPath = join(packageRoot, 'src', 'preload', 'index.ts');
    expect(existsSync(preloadPath)).toBe(true);
  });

  it('TC-PA001-03: Renderer React entry exists', () => {
    const rendererPath = join(packageRoot, 'src', 'renderer', 'src', 'main.tsx');
    expect(existsSync(rendererPath)).toBe(true);
  });

  it('TC-PA001-04: App component exists', () => {
    const appPath = join(packageRoot, 'src', 'renderer', 'src', 'App.tsx');
    expect(existsSync(appPath)).toBe(true);
  });

  it('TC-PA001-05: package.json declares required dependencies', () => {
    const packageJsonPath = join(packageRoot, 'package.json');
    expect(existsSync(packageJsonPath)).toBe(true);

    const packageJson = require(packageJsonPath);
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    expect(deps['electron']).toBeDefined();
    expect(deps['electron-vite']).toBeDefined();
    expect(deps['react']).toBeDefined();
    expect(deps['react-dom']).toBeDefined();
  });
});
