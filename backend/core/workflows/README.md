# Workflows

## Purpose

Workflows orchestrate end-to-end business journeys by composing stable runtime outputs with screen-ready adapters and governance decisions.

This sprint implements the **first complete vertical slice** for Review Work, locally and without networking:

Runtime → Generation → ReviewWorkViewAdapter → Approval → Completion

## Why workflows exist

- Runtime and adapters stay stable and contract-focused.
- Workflows represent the business *journey* (the “what happens next” sequence).
- Workflows isolate orchestration from both:
  - runtime internals (Situation/Decision/Plan/Governance computation)
  - frontend/state/persistence

## How this demo stores state today

- Approval decisions are recorded **in-memory only**.
- Work completion is represented by updating the returned business contract object.
- No database, no files, no HTTP calls.

## How future persistence will replace in-memory state

Later, a persistence layer will:
- store the Review session/work item identity
- store approval decision + timestamps
- store completion status
- re-hydrate the last known business state for subsequent steps

The workflow’s signature can remain stable while the storage implementation is swapped.

## How future APIs will wrap this workflow

Later, controllers or API handlers will:
- accept a request
- invoke the workflow method(s)
- return a response in the same business contract shape the frontend expects

This ensures the frontend remains insulated from orchestration mechanics and storage details.

