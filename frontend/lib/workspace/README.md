# Workspace Frontend Service

## Why `WorkspaceService` exists
The frontend must display a workspace snapshot (Dashboard, Digital Workforce, Work Queue) using the backend’s deterministic business models.

`WorkspaceService` is a thin frontend data layer that:
- exposes a stable interface for loading each workspace view
- delegates to `MockWorkspaceApi` for this sprint (local-only)

This keeps the UI components focused on rendering, not on how the data is fetched.

## Why `MockWorkspaceApi` is temporary
For this sprint we do not have HTTP endpoints, so the only “live runtime” data is produced by directly instantiating:
- `CompanyWorkspaceRuntime`
- `WorkspaceViewAdapter`

That is what `MockWorkspaceApi` does.

When APIs are added later, only `MockWorkspaceApi` is replaced; the interface used by the UI remains unchanged.

## How future APIs replace only `MockWorkspaceApi`
When the backend adds endpoints, `WorkspaceService` will call the real API implementation instead of instantiating backend runtime classes directly.

The frontend screens will continue to call:
- `WorkspaceService.loadDashboard()`
- `WorkspaceService.loadDigitalWorkforce()`
- `WorkspaceService.loadWorkQueue()`

## Provider boundary
`MockWorkspaceApi` may compose backend *domain engines* (runtime, generators, communication engine) for local projection, but must not import backend *infrastructure providers* (e.g. `GmailProvider` / `googleapis`). Outbound email delivery stays in backend communications/integration adapters; the mock uses an in-process local email stub to exercise APPROVED → SENT without pulling provider SDKs into the Next.js bundle graph.

