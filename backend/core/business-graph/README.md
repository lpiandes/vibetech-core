# Business Graph (Universal)

This module provides a small industry-agnostic canonical layer for:

- `BusinessParty` (PERSON / ORGANIZATION)
- `BusinessRelationship` (generic relationships between entity references)

Mutation happens only through `BusinessGraphRuntime.applyEvent(...)`.

This is deterministic, process-local, and NOT durable persistence.
