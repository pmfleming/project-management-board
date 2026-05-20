# Product

## Register

product

## Users

Project Management Board is for developers, maintainers, and AI-assisted engineering operators working on Scratchpad and its measurement tooling. They use it during focused review sessions to understand quality, performance, correctness, telemetry, run history, and architectural risk without digging through raw JSON artifacts or command logs.

The typical user is already technical and time-constrained. They need to scan dense evidence, identify the next meaningful action, run or inspect measurements, and explain risk to themselves or collaborators with confidence.

## Product Purpose

The product turns Scratchpad measurement artifacts into an actionable local dashboard. It replaces the old Python localhost dashboard server with a Vite-hosted React and TypeScript surface, serving `/viewer/`, dashboard API routes, and analysis artifacts from `target/analysis/`.

Success means the interface helps the user answer three questions quickly: what changed, what is risky, and what should be refreshed or investigated next. The dashboard should make deterministic measurement feel trustworthy, fast, and legible.

## Brand Personality

Precise, instrumented, and calm.

The product should feel like a serious engineering cockpit: dense enough for expert use, restrained enough to read for long sessions, and opinionated enough to make risk obvious. Its voice can be direct and lightly human, but never promotional or decorative.

## Anti-references

- Generic AI dashboard aesthetics: purple-blue neon surfaces, glowing dark cards, ornamental gradients, and repeated metric tiles that look generated rather than designed.
- BI-tool heaviness: Power BI-style chrome, presentation-first panels, and dashboards that make bespoke engineering workflows feel boxed in.
- Toy observability: dramatic alert colors, fake urgency, animated decoration, and data visualizations that prioritize style over diagnosis.
- Unstructured developer dumps: raw log walls, unlabeled JSON-shaped summaries, tiny low-contrast labels, and controls that require the user to remember internal artifact names.

## Design Principles

1. Evidence before ornament. Every visual decision should make measurement evidence easier to compare, trust, or act on.
2. Density with hierarchy. The interface can be information-rich, but each screen must have a clear scan path and an obvious next diagnostic move.
3. State must be explicit. Loading, stale, failed, running, unavailable, and refreshed states should be visible in the component itself, not buried in incidental copy.
4. Familiar controls, specialist language. Navigation, tabs, buttons, tables, and filters should behave conventionally while still using the precise vocabulary of the measurement domain.
5. Calm risk signaling. Color should carry semantic state and priority, not decorative energy.

## Accessibility & Inclusion

Target WCAG AA for text contrast, focus visibility, and keyboard navigation. Preserve usable contrast for color-blind users by pairing color with labels, icons, position, or text. Respect reduced motion. Touch targets should be at least 44px where controls may be used on tablet or small screens, while desktop density should remain efficient for repeated analysis work.
