# Navigation Service (Epic 7 Sprint 4)

## Responsibilities
- `NavigationService` is the platform-only assembly point for **canonical workspace navigation**.
- It produces `workspaceConfig.navigation` in the existing backend contract shape:
  - `navigation.items[]` each contains:
    - `section`
    - `items[]` with `{ moduleId, title, section }`

## Relationship to Workspace Generator
- `WorkspaceGenerator` must delegate navigation assembly to this service.
- `WorkspaceGenerator` continues to own:
  - which modules are enabled (capabilities/connected systems/industry readiness)
  - the rest of the workspace configuration (dashboard widgets, queues, views, etc.)

## Relationship to Navigation Taxonomy
- Group membership and ordering come from `NavigationDefaults.NAVIGATION_GROUP_DEFINITIONS`.
- Each group corresponds to a business-owner destination:
  Mission Control, Team, Work, Knowledge, Company, Analytics, Settings.

## Relationship to React
- React renders the already-translated Workspace View Models.
- The sidebar link `href` is resolved by the frontend shell route mapping (compatibility rewrites preserve legacy pages).

## Future Extensibility
- Additional modules can be added to the registry without changing renderers.
- Navigation can be extended by refining the selection rules (module registry metadata-driven), without hardcoding module ids.

