# Knowledge Publishing Engine (Sprint 7)

## Purpose
The **Knowledge Publishing Engine** converts an **approved Knowledge Draft** into an official **Knowledge Item** inside the Knowledge Repository.

This sprint is deterministic and **analysis-to-write** only:
- It validates the draft and proposal shape.
- It writes to runtime **only via Company Events**.
- It publishes a knowledge publishing lifecycle (`KNOWLEDGE_PUBLISH_*`) plus the repository mutation event (`KNOWLEDGE_CREATED`).
- It does **not** decide approval (it assumes the draft is already approved).

## Responsibilities
- `KnowledgePublishingEngine`: orchestration + deterministic result contract.
- `KnowledgePublisher`: draft/proposal validation + publish workflow orchestration.
- `RepositoryPublisher`: repository writes via the existing Company Event Engine.

## Events
- `KNOWLEDGE_PUBLISH_STARTED`
- `KNOWLEDGE_CREATED` (reused)
- `KNOWLEDGE_PUBLISHED`
- `KNOWLEDGE_PUBLISH_FAILED`

## Company Brain refresh
`CompanyBrain` consumes `runtime.getKnowledge()` which is derived from the repository. After publishing succeeds, the newly published knowledge automatically appears in subsequent `buildBusinessContext()` calls.

