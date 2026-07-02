# Company Onboarding OS (Sprint 1)

## Purpose
The **Onboarding Runtime** is the single source of truth for onboarding progress.

This sprint creates only the runtime + deterministic event-driven state transitions. No UI, no uploads, no integrations.

## Responsibilities
- Own onboarding session identity
- Own onboarding steps (status + progress)
- Own onboarding progress and metrics
- Provide deterministic “recommended next action”

## Runtime lifecycle
1. `OnboardingRuntime` is instantiated (optionally seeded with a template)
2. State changes occur only through `runtime.applyEvent(event)`
3. Derived views are computed deterministically from immutable state

## Relationship with Company Runtime
- The onboarding runtime may reference `CompanyWorkspaceRuntime` for identity context.
- It does **not** own business state.
- Company Runtime remains SSOT for business data.

## Future onboarding UI
Future UI will consume:
- `runtime.getSession()`
- `runtime.getSteps()`
- `runtime.getProgress()`
- `runtime.getMetrics()`
- `runtime.getRecommendedNextAction()`

