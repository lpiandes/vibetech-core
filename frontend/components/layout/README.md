# Workspace Shell Layout Components

This folder contains the reusable **Workspace shell** UI layout that all future workspace pages will inherit.

The shell establishes:
- a left sidebar navigation surface
- a minimal top bar with workspace title + placeholders
- a centered main content container with premium spacing

It does **not** implement routing or navigation behavior. Sidebar items are visual-only placeholders for this sprint.

---

## Components

### `WorkspaceLayout.tsx`
Purpose: the single wrapper that future pages should use.

Why it exists:
- provides a stable layout contract for all pages
- keeps page components focused on their own content rather than shell structure

---

### `AppShell.tsx`
Purpose: composes the three shell regions:
- `Sidebar`
- `Topbar`
- `PageContainer`

Why it exists:
- isolates layout composition in one place
- allows future shells (e.g., different workspaces) without rewriting individual pages

---

### `Sidebar.tsx`
Purpose: fixed-width left navigation.

Includes:
- `Logo`
- Navigation items:
  - Dashboard (active)
  - My Team
  - Work Queue
  - Performance
  - Settings button at the bottom

Design intent:
- premium whitespace, subtle borders, soft shadows
- desktop-first (sidebar hidden on smaller screens)

---

### `Topbar.tsx`
Purpose: minimal top bar.

Includes:
- “Workspace” title
- disabled search placeholder
- user avatar placeholder

---

### `PageContainer.tsx`
Purpose: centers main content with generous spacing.

Why it exists:
- ensures future pages inherit consistent padding and max-width
- maintains premium SaaS layout feel without repeating classes everywhere

---

### `Logo.tsx`
Purpose: sidebar brand mark placeholder.

Why it exists:
- keeps branding consistent across the shell
- can be replaced later with the real logo asset without touching layout code

