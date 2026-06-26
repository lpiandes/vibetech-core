# Work Queue Components

This folder contains the **Work Queue** UI for the VIBETech Workspace.

## Why the Work Queue is a primary workspace

The Work Queue is the screen business users use to review work produced by their Digital Workforce.
It is designed to communicate immediately:

> “My Digital Employee has completed work for me and needs my review.”

## Components

- `WorkQueue.tsx`: page-level component that renders header, filters (visual only), queue list, and empty state.
- `QueueItem.tsx`: a single queue row/card with badges, relative time, and a chevron.
- `PriorityBadge.tsx`: maps priority values to styled badges.
- `StatusBadge.tsx`: maps status values to styled badges.
- `EmptyState.tsx`: premium empty state message.
- `QueueHeader.tsx`: title + primary message.
- `QueueFilters.tsx`: visual-only filter buttons.

## Mock dataset

`WorkQueue.tsx` includes a mock dataset of exactly **8** legal queue items for initial design validation.
These items are shown in the UI only; no backend calls are made.

## How future Review pages will open

Each `QueueItem` is styled to be “row clickable” visually, but this sprint does not implement navigation.
In later sprints, `QueueItem` click handlers can be wired to open a Review Work page (using workspace routing).

