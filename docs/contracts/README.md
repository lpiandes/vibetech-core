# Workspace Runtime Contracts (Frontend <-> Backend)

This folder defines the **single interface contract** between the VIBETech Workspace (frontend) and the VIBETech Runtime (backend).

## What these contracts describe (and what they don’t)

They describe **WHAT information flows** between the Runtime and each Workspace page:
- business objects
- page-ready data shapes
- the meaning of loading/empty/error states

They do **not** describe:
- HTTP endpoints
- request routing
- persistence/storage details
- implementation strategies beyond mock-to-runtime migration guidance

## Contract naming

Each screen has its own contract:
- `DashboardContract.md`
- `WorkQueueContract.md`
- `ReviewWorkContract.md`
- `DigitalWorkforceContract.md`

Shared runtime business objects live in:
- `RuntimeModels.md`

## Migration principle

The frontend will start with mocks that conform to the same **output model shapes** described here.

As runtime capability expands, a thin mapping layer can replace mock data with live runtime outputs **without changing page layout decisions**, because the page is already driven by these stable output contracts.

