# Business Capability Engine (Sprint 2)

## What it is
The **Business Capability Engine** deterministically evaluates platform capabilities (readiness, completion, health, dependencies, requirements, and recommendations) based on existing runtime state.

## Non-negotiable properties
- **Not a runtime**: it does not own any business state.
- **Read-only**: it never mutates Company/Onboarding runtime.
- **State is derived**: capability states are always computed.
- **Deterministic**: no randomness; callers supply `nowISO` (or the engine uses a deterministic default).

## Output
`BusinessCapabilityEngine.evaluate()` returns:
- `capabilities`: derived `BusinessCapability` models (frozen)
- `metrics`: overall readiness/health + counts + completion percentage

## Relationship to runtimes
- Reads from `CompanyWorkspaceRuntime` and `OnboardingRuntime` (optional).
- Does not introduce a new source of truth.

