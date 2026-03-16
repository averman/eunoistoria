# Eunoistoria 

**The inquiry of a well-ordered mind.**

*Eunoistoria* is a portmanteau of two ancient Greek concepts:
- **Eunoia (εὔνοια):** "Well-mindedness" or "beautiful thinking." The state of mental equilibrium and the qualitative structuring of human cognition.
- **Historia (ἱστορία):** "Inquiry" or "knowledge acquired by investigation." The rigorous, systematic act of documenting.

Eunoistoria is an open-source, headless Content Management System (CMS) and extendable markdown editor. It is engineered to bridge the qualitative sprawl of human imagination with a mathematically rigorous, queryable database structure. It serves as a personal knowledge management architecture built explicitly for multiversal narrative generation and AI context window management.

---

## 🌟 Core Philosophy & Features

Standard word processors (Scrivener, Obsidian, Notion, Word) treat text linearly. They force complex, branching thoughts into monolithic timelines or messy folder hierarchies. Eunoistoria breaks this paradigm by strictly separating **Content** from **Structure**.

### 1. Composable Documents
Every piece of prose is an atomic "Leaf." Larger structures (Arcs, Volumes, Books) are "Compositions"—recursive trees of slots that point to Leaves. Compositions contain zero text; Leaves contain zero structure.

### 2. First-Class Variant Management
Version control usually implies linear progression (`v1` → `v2` → `final`). Eunoistoria introduces "Variant Groups," where parallel alternatives coexist as peers (e.g., `Chapter 3 Original`, `Chapter 3 Dark Ending`, `Chapter 3 Summary`). No version supersedes another.

### 3. Dynamic Context Assembly
Using a deterministic Rule Engine, Eunoistoria allows you to define "Presets." Presets evaluate document tags against runtime variables to automatically resolve the massive composition tree into a single, flat `.md` file.

---

## 🎯 Pragmatic Use Cases

Why build a composable markdown editor? Eunoistoria directly solves two massive friction points in modern long-form writing:

### The AI Context Window Bottleneck
Writing a 200-chapter series with an AI assistant requires agonizing manual labor to maintain context. Authors must manually copy summaries of previous arcs, character sheets, and immediately preceding prose into their prompts.

Eunoistoria automates this. By incrementing a single variable (`current_chapter = 104`), the Rule Engine dynamically compiles a localized context file. It automatically swaps full chapters for abbreviated summaries (Level of Detail variants) the further away they are from the current chapter. Context-sliding goes from a manual chore to a programmatic guarantee.

### The Branching Narrative Dilemma
Authors exploring alternate universes (AUs), fanfiction, or interactive narratives struggle to organize diverging storylines.

By decoupling the composition from the atomic text, authors can maintain multiple narrative branches side-by-side. A single "Master Novel" composition can serve five different storyline branches; the Rule Engine simply resolves the correct variant for the chosen branch, falling back to the original text where no divergence exists.

---

## 🏗️ Architecture & Monorepo Structure

Eunoistoria is a monolithic repository managed via `pnpm workspaces` and `turborepo`. It powers two main applications via a shared stateless Engine.

- **Power App:** A local-first desktop application (React, Electron, CodeMirror 6) for authors to write and manage rules.
- **Reader App:** A distribution application (Fastify) serving access-controlled, pre-resolved markdown to readers.

### Packages
- `packages/types` — Shared TypeScript type definitions and port interface declarations.
- `packages/engine` — Core logic: rule evaluation, variant resolution, composition walking.
- `packages/sql-template` — Abstract SQL store template.
- `packages/adapter-sqlite` — SQLite persistence adapter (Power App).
- `packages/adapter-postgres` — Postgres persistence adapter (Reader App).
- `packages/power-app` — Desktop authoring application.
- `packages/reader-app` — Content distribution application.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v8+)
- [Turborepo](https://turbo.build/) (global install recommended)

### Installation

Clone the repository and install dependencies across all workspaces:

\`\`\`bash
git clone https://github.com/your-username/eunoistoria.git
cd eunoistoria
pnpm install
\`\`\`

### Available Commands

The workspace relies on Turborepo to efficiently run scripts across all packages.

\`\`\`bash
# Build all packages 
pnpm build

# Run formatting and linting
pnpm lint

# Execute all unit and integration tests (Vitest)
pnpm test

# Run development servers concurrently
pnpm dev
\`\`\`

---

## 📚 Documentation

Detailed system documentation is available in the `docs/` directory. If you are an agent or a contributor, please start by reading `CLAUDE.md`.

- [PRD.md](docs/PRD.md) - Product Requirements
- [DESIGN.md](docs/DESIGN.md) - Technical System Design
- [PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md) - Monorepo structure, graph, and phase roadmap
- [TECH_STACK.md](docs/TECH_STACK.md) - Technology choices
- [DECISION_LOG.md](docs/DECISION_LOG.md) - Record of architectural decisions
- [IMPLEMENTATION_TRACKER.md](IMPLEMENTATION_TRACKER.md) - Roadmap and implementation status
