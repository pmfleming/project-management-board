---
name: Project Management Board
description: Local engineering cockpit for Scratchpad measurement artifacts.
colors:
  workbench-bg: "#171627"
  workbench-bg-raised: "#211f34"
  workbench-panel: "#29283f"
  workbench-text: "#f3f7f9"
  workbench-muted: "#aaaab8"
  workbench-line: "rgba(229, 237, 242, 0.16)"
  primary-accent: "#9a63ff"
  active-accent: "#ff4967"
  telemetry-accent: "#8ba7ff"
  quality-good: "#7bd99a"
  performance-warn: "#f0c35e"
  correctness-bad: "#ff826f"
  run-log-accent: "#72e6c8"
typography:
  display:
    fontFamily: "Aptos, Segoe UI, sans-serif"
    fontSize: "clamp(34px, 4.2vw, 72px)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "0"
  title:
    fontFamily: "Aptos, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "Aptos, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "Aptos, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0"
  mono:
    fontFamily: "Cascadia Mono, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  icon: "14px"
  pill: "999px"
spacing:
  xs: "5px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary-accent}"
    textColor: "{colors.workbench-text}"
    rounded: "{rounded.md}"
    padding: "9px 13px"
  panel-card:
    backgroundColor: "{colors.workbench-bg-raised}"
    textColor: "{colors.workbench-text}"
    rounded: "{rounded.md}"
    padding: "18px"
  tab-active:
    backgroundColor: "{colors.workbench-panel}"
    textColor: "{colors.workbench-text}"
    rounded: "{rounded.md}"
    padding: "7px 8px"
  table-header:
    backgroundColor: "#1a2025"
    textColor: "{colors.workbench-text}"
    padding: "10px 12px"
---

# Design System: Project Management Board

## 1. Overview

**Creative North Star: "The Measurement Console"**

Project Management Board is a dense local engineering cockpit. Its interface should feel precise, instrumented, and calm: a place where risk evidence is compared, refreshed, and acted on. The design serves repeated diagnostic use, so the product should feel familiar before it feels expressive.

The current system uses a dark ink-purple workbench shell, compact panels, sticky navigation, data tables, semantic status colors, and tab-specific accents. The direction is useful but must stay disciplined: it rejects generic AI dashboard aesthetics, glowing dark cards, ornamental gradients, and repeated metric tiles that look generated rather than designed.

**Key Characteristics:**
- Dense, technical, and scan-first.
- Dark by scene, not fashion: suited to long local engineering sessions.
- Semantic color for state and priority.
- Flat panels with thin borders rather than decorative depth.
- Familiar navigation and controls for expert flow.

## 2. Colors

The palette is an ink-purple workbench with restrained semantic accents.

### Primary
- **Workbench Purple** (`#9a63ff`): Primary selection and current-view accent. Use sparingly so active state remains obvious.
- **Live Signal Red** (`#ff4967`): Secondary emphasis for strong product moments and exceptional warnings. Do not use as decoration.

### Secondary
- **Telemetry Blue** (`#8ba7ff`): Telemetry and system-state accent.
- **Run Mint** (`#72e6c8`): Log and execution-status accent.

### Tertiary
- **Quality Green** (`#7bd99a`): Successful or lower-risk state.
- **Performance Amber** (`#f0c35e`): Watch state, capacity pressure, and performance caution.
- **Correctness Coral** (`#ff826f`): Failure, high risk, and correctness pressure.

### Neutral
- **Console Ink** (`#171627`): Page background.
- **Raised Ink** (`#211f34`): Sidebar and surface background.
- **Panel Ink** (`#29283f`): Raised panel and active state substrate.
- **Porcelain Text** (`#f3f7f9`): Primary text.
- **Muted Lavender Gray** (`#aaaab8`): Secondary labels and explanatory text.
- **Hairline Mist** (`rgba(229, 237, 242, 0.16)`): Dividers and borders.

### Named Rules

**The Evidence Color Rule.** Accent color exists to communicate tab identity, state, priority, or interactivity. It is not decoration.

**The No Neon Fog Rule.** Avoid purple-blue glow stacks, heavy radial decoration, and cyan-on-dark spectacle. Calm risk signaling wins.

## 3. Typography

**Display Font:** Aptos with Segoe UI fallback.
**Body Font:** Aptos with Segoe UI fallback.
**Label/Mono Font:** Cascadia Mono with Consolas fallback.

**Character:** The type system is native, compact, and work-focused. It prioritizes data legibility over brand flourish.

### Hierarchy

- **Display** (900, `clamp(34px, 4.2vw, 72px)`, 0.95): Page titles in the workbench header. Keep short and functional.
- **Headline** (700, 20px, 1.2): Panel headers and section headings.
- **Title** (700, 14-16px, 1.3): Card labels, row groups, and component headers.
- **Body** (400, 14px, 1.45): Explanatory copy, table cells, and panel descriptions. Cap prose at 65-75ch.
- **Label** (700, 12-13px, 1.35): Navigation items, buttons, metric labels, and controls.
- **Mono** (400-700, 12px, 1.4): Artifact paths, run ids, code references, and numeric evidence.

### Named Rules

**The Native Tool Rule.** Product UI uses a native sans stack and mono data face. No display fonts in labels, buttons, tables, or diagnostic cards.

## 4. Elevation

The system is flat by default. Depth is expressed through border, tone, sticky table headers, and panel grouping, not through large shadows. The earlier glow-card vocabulary should be treated as legacy drift.

### Shadow Vocabulary

- **Sticky Header Shadow** (`0 1px 0 rgba(255, 255, 255, 0.06), 0 10px 16px rgba(5, 8, 10, 0.72)`): Only for table headers that need to remain legible over scrolling data.
- **No Surface Shadow** (`none`): Default panel, card, navigation, and metric treatment.

### Named Rules

**The Flat Console Rule.** Surfaces are flat at rest. Use borders, dividers, and tonal contrast before shadow.

## 5. Components

### Buttons

- **Shape:** Compact rounded rectangles (8px radius), never oversized marketing pills for diagnostic actions.
- **Primary:** Cyan-tinted action buttons with restrained background and border, used for refresh and clear actions.
- **Hover / Focus:** Increase border contrast and background tint. Focus must be visible and must not rely on color alone.
- **Disabled / Loading:** Preserve footprint, dim with opacity, and show progress where the action can take time.

### Chips

- **Style:** Pill chips for status and filters, usually small and data-adjacent.
- **State:** Pair color with text. Green, amber, and coral must always carry explicit state labels.

### Cards / Containers

- **Corner Style:** Standard panels use 8px radius. Icon containers use 14px radius only when they are true navigation or page identity marks.
- **Background:** Panels sit on Raised Ink or translucent Console Ink with Hairline Mist borders.
- **Shadow Strategy:** No shadows on normal surfaces.
- **Internal Padding:** Use 14px or 18px. Avoid random one-off spacing.

### Inputs / Fields

- **Style:** Dark inset fields with 8px radius, Hairline Mist border, and Porcelain Text.
- **Focus:** Accent border and visible outline. Do not hide the default focus affordance without a replacement.
- **Error / Disabled:** Use semantic color plus explanatory text.

### Navigation

The primary navigation is a sticky left rail with icon-plus-label tabs. Active state is a tinted row plus an accented icon. On smaller screens it collapses to a horizontal tab strip with preserved labels.

### Tables

Tables are central to the product. Headers stay sticky, labels are uppercase and compact, and hover rows should aid tracking without shouting. Numeric and path-heavy cells use the mono face.

## 6. Do's and Don'ts

### Do:

- **Do** make measurement evidence easier to compare, trust, or act on.
- **Do** use semantic color for state and priority.
- **Do** keep panels flat, compact, and aligned to the 8px/14px/18px spacing rhythm.
- **Do** pair every color-coded risk signal with a label, value, or icon.
- **Do** preserve conventional product controls: tabs, buttons, filters, tables, and run status indicators should behave predictably.

### Don't:

- **Don't** use generic AI dashboard aesthetics: purple-blue neon surfaces, glowing dark cards, ornamental gradients, and repeated metric tiles that look generated rather than designed.
- **Don't** use BI-tool heaviness: Power BI-style chrome, presentation-first panels, and boxed-in workflows.
- **Don't** use toy observability: dramatic alert colors, fake urgency, animated decoration, or charts that prioritize style over diagnosis.
- **Don't** use unstructured developer dumps: raw log walls, unlabeled JSON-shaped summaries, tiny low-contrast labels, or controls that require remembering internal artifact names.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, list items, callouts, or alerts.
- **Don't** use gradient text, decorative glass blur, or glowing accent halos.
