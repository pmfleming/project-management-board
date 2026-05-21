# Repository Guidance

This repository is the dashboard host only. Keep product code here focused on
the React/Vite dashboard, viewer shell, API routes, and visualization of
measurement artifacts.

## Measurement Dependencies

The dashboard consumes measurements produced by sibling repositories:

- `C:\Code\scratchpad-performance-lens` provides the `splens` measurement tools.
- `C:\Code\rust-quality-lens` provides the `rqlens` measurement tools.

Treat those repositories as external dependencies when working from this
repository. You may read their schemas, run their commands, or inspect their
latest local outputs to understand new measures, but do not edit, format,
commit, stash, pull, or otherwise alter those repositories as part of dashboard
work unless the user explicitly asks for that repo to be changed.

When the user says a measurement repo changed, update this dashboard by
capturing the new or changed artifact shape, command, metric, or report output
and graphing it here. The dashboard should adapt to the engines; it should not
copy their implementation code.
