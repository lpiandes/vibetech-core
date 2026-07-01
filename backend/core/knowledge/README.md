# Knowledge Repository (Knowledge OS) — Sprint 1

## Purpose
The **Knowledge Repository** is the canonical storage system for all company knowledge.
It becomes the source of truth for `CompanyWorkspaceRuntime.getKnowledge()` via a derived compatibility layer.

Sprint 1 focuses only on:
- a first-class `KnowledgeItem` model
- deterministic repository operations
- runtime ownership and immutability
- knowledge operations expressed as **Company Events**

This sprint explicitly does **not** implement:
- upload UI
- parsing / OCR
- brand voice authoring UI
- knowledge search UI
- knowledge dashboard screens
- vector search, embeddings, or AI memory

## Responsibilities
- `KnowledgeItem` is a plain immutable business record with versioning and audit fields.
- `KnowledgeRepository` provides deterministic operations:
  - create
  - read
  - update (creates a new revision)
  - archive (no permanent delete)
  - list
  - metadata search (deterministic keyword matching)
  - revision history reads
- `CompanyWorkspaceRuntime` owns repository state and exposes compatibility via `getKnowledge()`.
- `CompanyEventEngine` is the only component allowed to mutate repository state through events.

## Sprint 2: Knowledge Categories (dependency)
Knowledge items are now assigned to first-class **Knowledge Categories**.
`CompanyWorkspaceRuntime` owns:
- `knowledgeRepository` (knowledge items)
- `knowledgeCategories` (category objects)

Category validity is enforced during knowledge operations expressed as Company Events.

## Data Flow (Sprint 1)
1. UI / system triggers a knowledge operation (e.g., create/update/archive).
2. Runtime expresses the operation as a **Company Event**.
3. `CompanyEventEngine` applies the event to runtime’s repository state.
4. Runtime derives the legacy compact `getKnowledge()` contract from the repository.
5. `CompanyBrain` consumes `runtime.getKnowledge()` as before.

## Repository lifecycle
- **Create**: Adds a new `KnowledgeItem` with `version = 1`.
- **Update**: Produces a new revision by:
  - snapshotting the prior current revision into `revisionHistory`
  - incrementing `version`
  - replacing the current fields with the updated revision
- **Archive**: Sets `status = "ARCHIVED"` without deleting the item or revisions.

## Versioning
- `KnowledgeItem.version` tracks the current revision number.
- `KnowledgeItem.revisionHistory` stores immutable snapshots of previous revisions.
- Updates never mutate prior revisions; they only append new snapshots.

## Future integration with Company Brain
Sprint 1 keeps Brain compatibility by deriving the legacy compact shape.
Later sprints can replace the derived compatibility contract with a richer repository-to-brain pathway without breaking stable employee interfaces.

## Future vector search and OCR
The repository is designed so later sprints can add:
- document parsing pipelines (OCR-safe)
- future indexing/search engines
- vector search embeddings stored in separate layers

Those are intentionally out of scope for Sprint 1.

