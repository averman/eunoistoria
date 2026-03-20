# Build System Quick Start

**TL;DR:** Libraries are source-only. Apps bundle everything with esbuild at build time.

---

## Common Commands

```bash
# Install dependencies (once)
pnpm install

# Development (with watch + HMR)
pnpm --filter @eunoistoria/power-app dev

# Or from power-app directory:
cd packages/power-app && pnpm dev

# Build for production
pnpm --filter @eunoistoria/power-app build

# Launch app (must build first)
pnpm --filter @eunoistoria/power-app preview

# Quick build + preview
pnpm --filter @eunoistoria/power-app build && pnpm --filter @eunoistoria/power-app preview
```

---

## VS Code Setup

1. Open `.vscode/launch.json`
2. Click "Run and Debug" (left sidebar)
3. Select **"Power App (Build + Preview)"**
4. Press **F5** (or click green play button)

**Result:** Automatic build → Electron window opens

---

## Key Concepts

### Libraries (Not Packages)

- ✅ Have `src/` and `tests/` directories
- ✅ Declare dependencies in `package.json`
- ✅ Have `test` script only
- ❌ NO build script, NO dist/ directory, NO exports field

Examples:
- `packages/engine/`
- `packages/adapter-sqlite/`
- `packages/types/`
- `packages/sql-template/`

### Apps (Bundled)

- ✅ Import from libraries via relative paths: `../../library/src/index`
- ✅ Run esbuild with `bundle: true`
- ✅ Output single .cjs file (CommonJS)
- ✅ Have `build`, `dev`, `preview` scripts

Example:
- `packages/power-app/`

### Import Rules

```typescript
// ✅ Correct (library importing library)
import { MyType } from '../../types/src/index';

// ✅ Correct (app importing library)
import { createEngine } from '../../../engine/src/index';

// ❌ Wrong (won't work without dist/ build)
import { createEngine } from '@eunoistoria/engine';
```

---

## What Happens When You Run `pnpm build`

```
esbuild reads src/main/index.ts
  ├─ Imports src/main/engine.ts
  │   └─ Imports ../../../engine/src/index (follows relative path)
  │       └─ Imports ../../types/src/index (follows relative path)
  │           └─ (no further imports, stops)
  ├─ Imports src/main/project-manager.ts
  │   └─ Imports src/main/file-format.ts
  │   └─ Imports ../../../adapter-sqlite/src/index
  │       └─ Imports ../../sql-template/src/index (etc.)
  └─ All TypeScript → CommonJS

Result: out/main/index.cjs (~1.2MB, CommonJS, ready to run)

Vite reads src/renderer/index.html
  ├─ <script> loads React code
  └─ All bundled → out/renderer/assets/*

Result: out/renderer/index.html + ./assets/* (relative paths)
```

---

## Troubleshooting

### "Cannot find module 'better-sqlite3'"

```bash
# Make sure you ran pnpm install
pnpm install

# Make sure pnpm build was run (generates bootstrap)
pnpm --filter @eunoistoria/power-app build

# Make sure bootstrap.cjs exists
ls packages/power-app/out/main/bootstrap.cjs
```

### "White screen on app launch"

1. Check browser console (Cmd+Option+I in Electron)
2. Check if `out/renderer/index.html` exists
3. Make sure `vite.config.ts` has `base: './'`
4. Run build again: `pnpm --filter @eunoistoria/power-app build`

### TypeScript errors in IDE

- IDE errors about relative imports are OK
- Build will work (esbuild handles bundler resolution)
- Verify `tsconfig.base.json` has `moduleResolution: "bundler"`

---

## Adding New Code

### Add a Function to Engine

```typescript
// packages/engine/src/my-new-module.ts
import { SomeType } from '../../types/src/index';

export function myNewFunction() { /* ... */ }
```

Then in power-app:
```typescript
// packages/power-app/src/main/some-file.ts
import { myNewFunction } from '../../../engine/src/my-new-module';
```

### Import Chain Works Because

1. Power-app imports relative path to engine
2. esbuild traces the import and loads engine source
3. Engine's imports are relative too
4. esbuild traces all of them
5. Everything compiles to CommonJS once

---

## Testing

### Test a Library (Isolated)

```bash
pnpm --filter @eunoistoria/engine test
pnpm --filter @eunoistoria/sql-template test
```

Tests run against `src/` directly (no bundling).

### Test Power App (Integration)

```bash
pnpm --filter @eunoistoria/power-app test
```

Tests can import engine + other libraries.

---

## Performance

- **Build:** ~1 second (esbuild + Vite)
- **Dev mode:** Watch triggers rebuild in ~100ms
- **App startup:** ~2-3 seconds (Electron window)
- **Bundle size:** ~1.2MB main + ~150KB renderer

---

## See Also

- **Full architecture:** [docs/BUILD_SYSTEM.md](./BUILD_SYSTEM.md)
- **Decision details:** [docs/DECISION_LOG.md](./DECISION_LOG.md) (search DEC-025)
- **Changelog:** [CHANGELOG.md](../CHANGELOG.md) (search BUILD-001)
