# Dashboard v1 Components (Mock UI)

This folder contains the **Dashboard v1** implementation for the VIBETech Workspace.

## Purpose of Dashboard

Dashboard provides a premium “at a glance” view of governed employee work:
- What has the most impact right now (KPI metrics)
- Who is currently driving outcomes (Digital Workforce card)
- What just happened (Recent Activity timeline)
- What the user should do next (Quick Actions)

It follows the **Workspace Blueprint** visual reading order exactly.

## How it follows the screen blueprint

Reading order implemented in `Dashboard.tsx`:
1. `DashboardHeader` (page title + short description)
2. `ImpactMetrics` (four KPI cards)
3. `DigitalWorkforceCard` (single employee surface with status + today summary)
4. `RecentActivity` (timeline-style activity list)
5. `QuickActions` (CTA buttons, visual-only)

## Components

### `Dashboard.tsx`
Page-level composition in the blueprint order. Uses only mock data (no backend, no APIs, no state).

### `DashboardHeader.tsx`
Defines the page eyebrow, title, and description using `PageTitle`.

### `ImpactMetrics.tsx`
Renders the four metrics using `MetricCard`:
- Hours Saved
- Drafts Created Today
- Pending Reviews
- Estimated Value Created

### `DigitalWorkforceCard.tsx`
Single Digital Employee surface using:
- `Avatar` for identity
- `StatusBadge` for governance/workflow state
- `PrimaryButton` for the main next-step CTA: `Review Work`

### `RecentActivity.tsx`
Timeline-style list with mock timestamps and activity lines.
Uses `InfoCard` as the visual container to match card layout philosophy.

### `QuickActions.tsx`
Visual-only button set (no behavior) using:
- `PrimaryButton` for `Review Work`
- `SecondaryButton` for `View Team` and `Performance`

## Future migration guidance (mock data → runtime)

When runtime metrics become available, each component should be updated by replacing mock values:
- `ImpactMetrics.tsx`: values for each KPI
- `DigitalWorkforceCard.tsx`: employee name/status/activity summary
- `RecentActivity.tsx`: activity timestamps + lines

The layout and hierarchy should remain unchanged to keep the blueprint stable.

