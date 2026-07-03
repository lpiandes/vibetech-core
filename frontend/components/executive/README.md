# Executive Component Primitives

## Purpose
Reusable, premium executive-grade UI primitives for VIBETech. These components form a consistent foundation for every Operating System experience (Mission Control, Team, Work, Knowledge, Requests, Capabilities, Communications, Analytics, and future OS modules).

## Core responsibilities
- Presentation-only (no business logic).
- Deterministic rendering given props.
- Uses the VIBETech design tokens exclusively:
  - semantic colors
  - executive typography hierarchy
  - 8-point spacing scale
  - radius/shadows/motion tokens

## When to use
Use these primitives when building any executive screen:
- KPI/Metric cards
- Health score cards & badges
- Insights & recommendations blocks
- Consistent headers, section titles, and layout scaffolding
- Calm empty states and stable loading skeletons

## When NOT to use
- When implementing OS/business logic (use adapters/view-models instead).
- When you need charting, drilldowns, exports, filters, or interactive data exploration.
- When you need custom layouts that would otherwise break the executive visual hierarchy.

## Relationship to the design language
These components encode the documented executive visual personality:
- Calm, modern, spacious
- Decision-first hierarchy
- Consistent empty-state language
- State communicated through semantics, not decoration

