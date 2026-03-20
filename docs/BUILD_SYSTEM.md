# Build System Architecture

**Date:** 2026-03-20
**Decision Reference:** DEC-025
**Status:** ✅ Complete and tested

---

## Overview

The Eunoistoria monorepo uses a **source bundling architecture** where libraries are not independently built packages. Instead, they are collections of TypeScript source files that applications import and bundle at build time.

```
libraries (no build step)          applications (build everything)
├─ packages/engine/src/           Power App esbuild config:
├─ packages/adapter-sqlite/src/   ├─ bundle: true
├─ packages/types/src/            ├─ entryPoints: [main/index, preload/index]
└─ packages/sql-template/src/     ├─ external: [electron, better-sqlite3]
                                  └─ format: cjs (output)
```

### Key Principle

> **Libraries are source. Applications bundle.** No dist/ directories, no pre-built packages, no multi-step build process.

---

## Architecture Decisions

### Library Configuration

**What libraries DO:**
- Contain TypeScript source code (`src/`)
- Have local tests (`tests/`)
- Declare runtime dependencies in `package.json`
- NO build scripts, NO exports field, NO dist/ directories

**Example library package.json:**
```json
{
  "name": "@eunoistoria/engine",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@eunoistoria/types": "workspace:*"
  }
}
```

### Import Patterns

**Cross-library imports use relative paths:**
```typescript
// ✅ Correct
import { createEngine } from '../../types/src/index';

// ❌ Wrong (would be package imports, not source)
import { createEngine } from '@eunoistoria/types';
```

**Why relative paths?**
- Direct source references (no dist/ lookup)
- esbuild resolves them at compile time
- No runtime module resolution overhead
- Enables tree-shaking and optimization

### TypeScript Configuration

**tsconfig.base.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",  // For esbuild, not Node
    "composite": true,
    "strict": true
  }
}
```

**Why `moduleResolution: "bundler"`?**
- esbuild's native module resolution mode
- Relaxes `// .js` extension requirements for relative imports
- TypeScript understands bundler semantics (not Node's fs-based resolution)

---

## Build Pipeline

### Single Entry Point Per App

**Power App build process:**
```
pnpm build
├─ esbuild compile phase:
│  ├─ Entry: src/main/index.ts → out/main/index.cjs
│  │  └─ Transitive deps (engine, adapter-sqlite, types, sql-template)
│  ├─ Entry: src/preload/index.ts → out/preload/index.cjs
│  └─ Generate: out/main/bootstrap.cjs (NODE_PATH setup)
│
└─ Vite compile phase:
   └─ Renderer: src/renderer/index.html → out/renderer/
       (React + CSS assets with relative paths)
```

### esbuild Configuration

**scripts/build-main.js:**
```javascript
const mainOptions = {
  entryPoints: {
    'main/index': path.join(projectRoot, 'src/main/index.ts'),
    'preload/index': path.join(projectRoot, 'src/preload/index.ts'),
  },
  outdir: path.join(projectRoot, 'out'),
  format: 'cjs',           // ← CommonJS output
  platform: 'node',
  target: 'ES2022',
  bundle: true,            // ← Include all sources
  external: ['electron', 'better-sqlite3'],  // ← Only system deps
  outExtension: { '.js': '.cjs' },
};
```

**Why `bundle: true`?**
- All TypeScript sources (including libraries) compiled into single output files
- Single compilation context (esbuild sees full dependency graph)
- No runtime module resolution needed (code is already compiled)

**Why externalize `electron` and `better-sqlite3`?**
- **electron:** Node/Electron built-in, available at runtime
- **better-sqlite3:** Native module, must be installed separately (not bundled)

### Bootstrap Wrapper

**Problem:** CommonJS code with `require('better-sqlite3')` at top level needs module search paths set BEFORE module load.

**Solution:** `out/main/bootstrap.cjs` is generated at build time:
```javascript
// Runs FIRST, before main/index.cjs loads
const Module = require('module');
Module.globalPaths.unshift(require('path').join(__dirname, '../../..', 'node_modules'));

// NOW load the bundled app
require('./index.cjs');
```

**How Electron finds it:**
1. `package.json` → `"main": "out/main/bootstrap.cjs"`
2. Electron runs bootstrap → sets NODE_PATH → requires index.cjs
3. index.cjs has better-sqlite3 available in node_modules

### Renderer (Vite)

**vite.config.ts:**
```typescript
export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, 'src/renderer'),
  base: './',  // ← Relative asset paths for file:// URLs
  build: {
    outDir: path.join(__dirname, 'out/renderer'),
    emptyOutDir: true,
  },
});
```

**Why `base: './'`?**
- Electron loads HTML as file:// URL, not HTTP
- Absolute paths like `/assets/...` don't work with file:// protocol
- Relative paths (`./assets/...`) work everywhere

---

## Commands

### Development

```bash
# Watch mode: esbuild watches main/preload, Vite watches renderer
pnpm --filter @eunoistoria/power-app dev

# Alternatives:
pnpm dev                    # From power-app directory
cd packages/power-app && pnpm dev
```

### Production Build

```bash
# Full build: esbuild compile + Vite build
pnpm --filter @eunoistoria/power-app build

# Result: out/main/*.cjs + out/renderer/*
```

### Preview

```bash
# Launch Electron (requires pnpm build first)
pnpm --filter @eunoistoria/power-app preview
```

### VS Code

```
1. Open .vscode/launch.json
2. Select "Power App (Build + Preview)"
3. Press Play (F5)

Result: Auto-builds + launches Electron
```

---

## Module Resolution at Runtime

### NODE_PATH Environment Variable

**Set by bootstrap and VS Code launcher:**
```javascript
// In bootstrap.cjs
process.env.NODE_PATH = '/Users/averman/work/eunoistoria/node_modules';

// In VS Code run script
env: { ...process.env, NODE_PATH: path.join(workspaceFolder, 'node_modules') }
```

**Why needed?**
- esbuild output has `require('better-sqlite3')`
- Node needs to find this module from workspace node_modules
- Standard pnpm symlinks resolve correctly with NODE_PATH set

### Dependency Installation

```bash
# Install all (including native modules like better-sqlite3)
pnpm install

# better-sqlite3 lives at: node_modules/.pnpm/better-sqlite3@11.10.0/
# Symlinked as: node_modules/better-sqlite3
```

---

## TypeScript & Testing

### Library Tests (Isolated)

```bash
# Test engine in isolation (doesn't import app code)
pnpm --filter @eunoistoria/engine test

# Test sql-template
pnpm --filter @eunoistoria/sql-template test

# Tests run against src/ directly (no bundling)
```

### Power App Tests (Integration)

```bash
# Test power-app (can import from libraries)
pnpm --filter @eunoistoria/power-app test

# Tests can import engine, adapters, etc. as source
# vitest handles TypeScript compilation per test
```

### No tsc Build

Libraries don't use `tsc` to build because:
- esbuild handles TypeScript compilation
- No dist/ output needed
- Tests run directly against src/

---

## Troubleshooting

### "Cannot find module 'better-sqlite3'"

**Cause:** bootstrap.cjs not running before require.

**Fix:**
1. Verify `package.json` has `"main": "out/main/bootstrap.cjs"`
2. Verify bootstrap.cjs exists in out/main/
3. Verify `pnpm build` was run (generates bootstrap)
4. Check NODE_PATH is set when running Electron

### "Module resolution errors" in IDE

**Cause:** IDE doesn't understand bundler module resolution.

**Fix:**
- IDE correctly uses `tsconfig.base.json` with `moduleResolution: "bundler"`
- Errors are IDE-only (build works fine)
- Ignore IDE warnings; esbuild handles it correctly

### Renderer shows blank screen

**Cause:** Asset paths are absolute (`/assets/...`) instead of relative.

**Fix:**
1. Verify `vite.config.ts` has `base: './'`
2. Run `pnpm build` (regenerates HTML with relative paths)
3. Check `out/renderer/index.html` for `./assets/...` not `/assets/...`

### "ERR_FILE_NOT_FOUND" loading renderer HTML

**Cause:** Path to HTML is wrong (relative to app entry point).

**Fix:**
1. Verify `src/main/index.ts` calculates path as: `app.getAppPath() → out/renderer/index.html`
2. Test path calculation manually (log it)
3. Verify `out/renderer/index.html` exists after build

---

## Future Extensions

### Adding New App (Reader App)

```
packages/reader-app/
├─ src/
│  ├─ server/ (Fastify)
│  └─ ...
├─ package.json (declares engine, adapters deps)
├─ scripts/build.js (esbuild config for server build)
└─ vite.config.ts (if has web UI)
```

Follows same pattern:
- bundle: true
- external: [system deps only]
- direct source imports from libraries
- No pre-built libraries needed

### Publishing Libraries as npm Packages

If a library ever needs external publication:
1. Add `build` script: `tsc -b`
2. Add `exports` field to package.json
3. Add `dist/` to .gitignore
4. Publish to npm

No code changes needed (relative imports still work).

---

## Performance Notes

- **Build time:** ~500ms (esbuild) + ~500ms (Vite) = ~1s total
- **Bundle size:** ~1.2MB (esbuild) + ~150KB (Vite) gzipped
- **Runtime startup:** ~2-3s (Electron window creation + app init)
- **Hot module reload:** esbuild watches main/preload (~100ms rebuild), Vite watches renderer (~200ms)

---

## References

- **Decision:** DEC-025 (Monorepo Source Bundling)
- **CHANGELOG:** BUILD-001 entry
- **IMPLEMENTATION_TRACKER:** Phase 4a (BUILD-001 subsection)
