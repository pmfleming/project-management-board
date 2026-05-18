# Project Management Board

React and TypeScript dashboard host for Scratchpad measurement artifacts.

The Vite dev server replaces Scratchpad's old Python localhost dashboard server.
It serves the migrated dashboard under `/viewer/`, exposes the dashboard API
routes under `/api/`, and serves Scratchpad JSON artifacts from
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

## Checks

```powershell
npm run typecheck
npm run build
```
