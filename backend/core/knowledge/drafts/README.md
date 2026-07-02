# Knowledge Draft Engine (Sprint 6)

## Purpose
The **Knowledge Draft Engine** converts a Sprint 4 `ProcessedDocument` and a Sprint 5 **Knowledge Intelligence Report** into one or more **Knowledge Drafts**.

This sprint is **analysis and proposal only**:
- no runtime mutations
- no repository writes
- no Company Brain changes
- no approval workflow (reviewRequired is inherited from intelligence)

## Knowledge Draft Lifecycle (future)
- Draft proposed
- Human review / governance decides acceptance or rejection
- Accepted drafts become permanent Knowledge Items (future sprint)

## Relationship to Communication Drafts
This engine mirrors the existing communication draft pattern:
- deterministic draft building
- separate “draft generation” from “approval” and “persistence”

## Draft generation rules (Sprint 6)
- One draft for simple documents
- Multiple drafts supported for future documents using **simple section-based splitting**
- No complex decomposition logic yet

