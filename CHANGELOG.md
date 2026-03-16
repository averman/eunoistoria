# Changelog

All notable changes to the Extendable Markdown Editor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning (monorepo scoped).

## [Unreleased]

### Added
- Initialized pnpm monorepo structure with Turborepo caching.
- Scaffolded 7 core packages: \`types\`, \`engine\`, \`sql-template\`, \`adapter-sqlite\`, \`adapter-postgres\`, \`power-app\`, \`reader-app\`.
- Set up base \`tsconfig.json\` and \`vitest.workspace.ts\`.
- Added dummy tests validating build/test pipelines across all workspaces.
- Synchronized \`CLAUDE.md\` and \`REVIEW_AGENT_INSTRUCTIONS.md\` to reflect the Antigravity agent workflow and Walkthrough artifacts.

### Changed
- Finalized architecture decisions in \`DECISION_LOG.md\`: 
  - Monorepo tooling: pnpm + turborepo
  - UI framework: React + Electron + CodeMirror 6
  - Server framework: Fastify (Serverless ready)

### Fixed
- N/A

---

*Note for Agents: Update this file incrementally as features from the Implementation Tracker are completed.*
