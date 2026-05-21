# Project Management Board

React and TypeScript dashboard host for Scratchpad measurement artifacts.

The Vite dev server replaces Scratchpad's old Python localhost dashboard server.
It serves the migrated dashboard as a React single-page app at `/` and
`/viewer/`, exposes the dashboard API routes under `/api/`, runs the local
measurement engines, and serves dashboard-owned JSON artifacts from
`/target/analysis/`.

## Development

```powershell
npm install
npm run dev
```

By default the app expects Scratchpad to be checked out as a sibling directory:

```text
D:\Code\scratchpad
D:\Code\project-management-board
```

Set `SCRATCHPAD_ROOT` to point at a different Scratchpad checkout:

```powershell
$env:SCRATCHPAD_ROOT = "D:\Code\scratchpad"
npm run dev
```

Set `RUST_QUALITY_LENS_ROOT` or `SCRATCHPAD_PERFORMANCE_LENS_ROOT` if those
repos are not siblings of Scratchpad.

Measurement JSON is written locally to this repo's `target/analysis/` by
default. Set `PMB_ANALYSIS_ROOT` to use a different artifact directory.

## Measurement repositories

This repository should contain dashboard code only. The measurement engines live
in sibling repositories and are treated as external dependencies:

- `scratchpad-performance-lens` creates performance measurements through
  `splens`.
- `rust-quality-lens` creates quality measurements through `rqlens`.

Dashboard work may read their artifact shapes and run their local commands, but
it should not alter those repositories. Runs use generated config files under
`target/analysis/.config/` so the engines measure Scratchpad while writing JSON
back into this dashboard repo. When a measure changes there, capture the new
output or metric in this dashboard and visualize it here.

## Checks

```powershell
npm run typecheck
npm run build
```
