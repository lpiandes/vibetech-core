# VIBETech Workspace Frontend Foundation

This `frontend/` directory is the **frontend architecture-only foundation** for the VIBETech Workspace.

It is **not** a product implementation sprint:
- no product pages
- no navigation
- no authentication
- no employee pages
- no mock data

The goal is a production-ready, scalable Next.js + Tailwind + shadcn/ui base that future feature sprints build on.

---

## Folder responsibilities

### `app/`
Next.js App Router entrypoints:
- `layout.tsx`: root HTML shell (no product pages)
- `page.tsx`: placeholder landing page: `Welcome to VIBETech Workspace`
- `globals.css`: Tailwind CSS + shadcn base styling
- `favicon.ico`: static icon

### `components/`
UI composition boundaries:
- `components/layout/`: workspace shell components (created for future use)
- `components/dashboard/`: dashboard components (created for future use)
- `components/employees/`: employee profile components (created for future use)
- `components/queue/`: work queue components (created for future use)
- `components/ui/`: shadcn/ui primitives
- `components/shared/`: shared UI elements (created for future use)

### `hooks/`
Client hooks boundary (empty for now; introduced when UI behavior appears).

### `lib/`
Client utilities boundary (shadcn utilities live here).

### `providers/`
Client-side provider composition boundary (empty for now).

### `store/`
Zustand store boundary (empty for now).

### `styles/`
Feature-scoped styling boundary (empty for now).

### `types/`
Shared UI type boundary (empty for now).

### `public/`
Static assets served by Next.js.

---

## Design philosophy (source-aligned)

This foundation follows your Product/Design source of truth:
- Beautiful over busy
- Simplicity wins
- Human language only
- Complexity belongs in the backend
- Accessibility by default
- Desktop-first, responsive always

---

## Component philosophy

- Prefer primitives from `components/ui/` (shadcn/ui) for consistent UX.
- Keep components small and focused (single responsibility).
- Avoid embedding backend/runtime internals into UI naming; UI will speak in customer language.

---

## Why App Router was selected

App Router provides a scalable routing foundation for:
- a multi-page workspace experience (dashboard, review work, employee profile)
- clear boundaries between layout shells and page segments
- straightforward growth into more complex UI without restructuring routing fundamentals

---

## Future expansion strategy

Next feature sprints will add:
- navigation and workspace structure
- review work flows and approval surfaces
- employee profile screens
- UI state and forms (React Hook Form + Zod)

This foundation stays minimal so those additions remain isolated and reviewable.

