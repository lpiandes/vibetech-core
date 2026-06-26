# VIBETech Design System (Workspace UI)

This folder contains the **reusable design-system components** used to build every VIBETech Workspace screen.

## Purpose

These components exist to ensure:
- Premium, minimal, calm UI
- Consistent typography, spacing, and card/badge treatments
- A single place to update the visual language as VIBETech evolves

They are **visual components only**. No backend calls, no runtime behavior, and no domain logic.

## When to use each component

- `MetricCard`: display a KPI/number with a label (example: `Hours Saved`).
- `SectionHeader`: section title + optional subtitle + optional action area (button(s), links).
- `PrimaryButton`: primary call-to-action style (example: `Approve`).
- `SecondaryButton`: neutral/secondary action button style.
- `StatusBadge`: governance/workflow status label (example: `Needs Review`, `Pending`, `Working`).
- `PriorityBadge`: priority label (`High`, `Medium`, `Low`).
- `InfoCard`: generic rounded container for small blocks of information.
- `EmptyState`: shown when a list/section has no items; supports an icon, title/description, and optional action.
- `Avatar`: compact avatar placeholder (initials or icon).
- `PageTitle`: consistent page heading pattern (optional eyebrow, required title, optional description).
- `SearchInput`: consistent search field styling (visual only).

## How future pages should migrate

When adding new UI:
1. Prefer these components over ad-hoc Tailwind classes.
2. Keep labels human-friendly and customer-facing.
3. Use `StatusBadge` / `PriorityBadge` for standardized governance language.

Later runtime layers (e.g., employee outputs, generated drafts, approvals) should only swap mock values into these components—not introduce new visual components.

## Future expansion guidance

Add new components here only when they represent permanent UI language (not a one-off layout). Examples of what might be added later:
- Table/row primitives
- Document viewer primitives
- Notification/toast primitives

