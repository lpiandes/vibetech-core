# Mission Control Generator (Epic 5 Sprint 1)

## Purpose
Compose the owner-facing **MissionControl** canonical object by combining existing executive intelligence:
- `CompanyBrief` (what is happening)
- `CompanyHealth` (how healthy is the business)
- `CompanyInsights` (what changed)
- `CompanyOpportunities` (where to improve)
- `CompanyRecommendations` (what to do next)

Mission Control answers:
> "What should the owner see first when they open VIBETech?"

## Responsibilities
- `MissionControlGenerator`
  - orchestration entry point
  - returns validated immutable `MissionControl`
- `MissionControlBuilder`
  - deterministic composition logic only
  - selects headline + primary focus
  - converts inputs into MissionControl sections/cards/actions
- `MissionControlValidator`
  - structural validation (duplicates, ordering, required fields)

## Input Objects
This sprint consumes canonical business intelligence objects and does not duplicate engine computation.

- Required:
  - `CompanyBrief`
  - `CompanyHealth`
  - `CompanyRecommendations`
- Also accepted:
  - `CompanyInsights`
  - `CompanyOpportunities`

Optional:
- `WorkspaceConfiguration` / `WorkspaceViewModel`
- `Company Runtime`
- `Capability Engine output`

## Relationship to Executive Intelligence Pipeline
Mission Control is the composer; it never computes intelligence belonging to other engines.

Future Mission Control view adapters and renderers can translate this canonical model into UI.

## Mission Control Freeze (Permanent)
Mission Control is now feature-frozen for this architecture foundation sprint.
Future platform capabilities must improve Mission Control through composition (additional canonical objects feeding the generator/view), not by redesigning sections/cards/UX logic.

