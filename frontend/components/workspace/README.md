# Workspace Rendering Foundation (Epic 3 Sprint 3)

## Responsibilities

- `WorkspaceRenderer`
  - Coordinates application shell rendering.
  - Provides the Workspace View Model via `WorkspaceContext`.
  - Renders sidebar/navigation from the backend-produced view model.

- `NavigationRenderer`
  - Renders navigation-only shell UI.
  - Converts `workspaceViewModel.navigation` + `workspaceViewModel.modules` into sidebar entries.

- `ModuleRenderer`
  - Central place to decide which module container should render.
  - Sprint 3 keeps existing routes/pages unchanged; it currently only wraps `children`.

- `WorkspaceContext`
  - Provides the Workspace View Model to the rendering layer.
  - No business logic; view model is assumed immutable from the backend.

## Relationship to Workspace View Layer

This sprint renders view models produced by:
- `backend/core/workspace/views/WorkspaceViewAdapter.js`

`React` no longer contains hardcoded navigation structure; the rendering foundation derives shell navigation from view models only.

## Relationship to React

React components are presentational:
- They render view-model-driven labels/icons/order/visibility.
- They do not compose business state.

## Future routing generation

For Sprint 3, route URLs are derived from a temporary module-to-route map in:
- `frontend/components/workspace/workspaceShellDerivations.js`

Future routing generation will replace this map later.

