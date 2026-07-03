# VIBETech Design System Foundation

This folder contains the **design token foundation** used by future screens across:
Mission Control, Team, Work, Knowledge, Requests, Capabilities, Communications, and Analytics.

## Philosophy
- Calm, modern, executive-grade UI language.
- Deterministic visual semantics: **components consume tokens**, not hardcoded colors.
- Semantic tokens are stable across all Operating Systems to keep screens portable.
- Themes only adjust **token values**, never screen structure.

## Semantic tokens
Components should reference tokens by semantic intent, e.g.:
- `background` / `surface` for layout regions
- `textPrimary` / `textMuted` for typography
- `border` for separators
- `success` / `warning` / `danger` / `info` for status signaling
- `healthExcellent` / `healthCritical` for deterministic health semantics

## Spacing / typography / radius / shadows / motion
Foundation tokens exist as a single source of truth for:
- 8-point spacing (`xs`..`3xl`)
- executive typography hierarchy
- consistent radius scale (`small`..`pill`)
- subtle, Apple-like shadows (future use)
- motion timings (no implementation yet)

## How future customer branding will work
Customer themes will:
1. Provide semantic color overrides by stable semantic token keys.
2. Map semantic tokens into the existing CSS-variable layer (or a future theme provider).

This sprint intentionally does not modify component code or page layout.

