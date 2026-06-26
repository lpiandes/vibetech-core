# Workspace Layout

Defines the permanent layout measurements and structural philosophy for the VIBETech Workspace.

No CSS. No code. Only layout rules that future UI implementation must follow.

## Global frame

- **Desktop-first** layout.
- Single, consistent application shell on every page.
- All content lives inside the shared page container and uses the spacing system.

## Sidebar

- Desktop sidebar is visible starting at the `md` breakpoint.
- **Width:** `288px` (equivalent to `w-72`).
- **Behavior:** fixed-height column, full-height inside the shell.
- **Purpose:** primary navigation.
- **Card/controls inside sidebar:** compact, consistent padding (see spacing system).

## Topbar

- **Height:** `64px` (equivalent to `h-16`).
- Always sits above page content.
- Contains page context (e.g., Workspace label) and user actions.
- Should remain visually quiet: secondary emphasis only.

## Page container

- Content is centered with a maximum width:
  - **Max content width:** `72rem` (equivalent to `max-w-6xl`).
- **Horizontal padding (desktop):** `40px` per side (equivalent to `px-10`).
- **Vertical padding (desktop):** `48px` per section entry (equivalent to `py-12`).

## Grid philosophy

- Use a **single vertical reading flow** with optional two-column sections.
- Default list/card areas should use:
  - one column on small screens
  - two columns when content density benefits from it
  - up to four columns only for compact KPI / badge-like elements
- Prefer **gutters via whitespace** rather than dense table layouts.

## Card layout philosophy

- Cards communicate trust and governance.
- Use a consistent card surface style:
  - rounded corners (large, premium radius)
  - subtle border
  - soft shadow at rest
  - shadow + slight elevation on hover (where appropriate)
- Cards should never feel cramped:
  - internal spacing is required
  - typography hierarchy is required

## Desktop responsiveness

- Default shell with:
  - sidebar visible
  - topbar visible
  - content centered in page container

## Tablet behavior

- Sidebar may collapse depending on layout density, but the shell should remain consistent.
- Content remains centered; reduce the number of columns where it improves readability.

## Mobile behavior

- Sidebar is not shown (navigation becomes secondary).
- Page container padding reduces to keep content readable.
- All cards/list items render in a single column.

