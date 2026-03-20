#!/usr/bin/env node
import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const isWatch = process.argv.includes('--watch');

const mainOptions = {
  entryPoints: {
    'main/index': path.join(projectRoot, 'src/main/index.ts'),
    'preload/index': path.join(projectRoot, 'src/preload/index.ts'),
  },
  outdir: path.join(projectRoot, 'out'),
  format: 'cjs',
  platform: 'node',
  target: 'ES2022',
  bundle: true,
  external: ['electron', 'better-sqlite3'],
  outExtension: { '.js': '.cjs' },
};

function createBootstrap() {
  const bootstrapCode = `// Bootstrap script - set up module resolution paths before loading main
const path = require('path');
const Module = require('module');

// Add workspace node_modules to module search paths
const workspaceRoot = path.resolve(__dirname, '../../..');
const workspaceNodeModules = path.join(workspaceRoot, 'node_modules');

Module.globalPaths.unshift(workspaceNodeModules);
if (!process.env.NODE_PATH) {
  process.env.NODE_PATH = workspaceNodeModules;
}

// Now load the actual entry point
require('./index.cjs');
`;
  const bootstrapPath = path.join(projectRoot, 'out/main/bootstrap.cjs');
  fs.writeFileSync(bootstrapPath, bootstrapCode);
}

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(mainOptions);
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(mainOptions);
      createBootstrap();
      console.log('Main process and preload built');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
