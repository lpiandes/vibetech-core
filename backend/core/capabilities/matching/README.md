# Capability Matching Engine (Epic 12 Sprint 2)

## Purpose
Deterministically answer:
**“Who or what is capable of doing this work?”**

## Responsibilities
`CapabilityMatchingEngine` evaluates fit between a WorkItem and the capability providers available in `TeamRuntime`, using capability definitions from `CapabilityRuntime`.

It produces an immutable `CapabilityMatchResult`:
- no runtime mutation
- no assignment changes
- no AI/ML
- deterministic scoring and bestMatch selection

## Relationship to runtimes
`CapabilityRuntime`: source of canonical capability definitions.
`TeamRuntime`: source of provider workers (human / digital_employee / etc.).
`WorkRuntime`: provides the work signals used for matching (`workType`, `requirements`, and `metadata.requiredCapabilities`).

## Future integration
This engine is evaluation-only.
Future work may integrate with `AssignmentService` and/or capability inference (AI/heuristics) to choose a provider for execution.

