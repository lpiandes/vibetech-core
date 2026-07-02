# Recommendation Engine (Epic 4 Sprint 5)

## Purpose
Generate deterministic **business recommendations** that answer:
> "What should the business do next?"

No AI, no prediction, no UI, no persistence.

## Responsibilities
- `CompanyRecommendationEngine`
  - orchestration entry point
  - returns canonical `CompanyRecommendations`
  - validates final output
- `CompanyRecommendationBuilder`
  - deterministic candidate derivation from canonical intelligence inputs:
    - `CompanyBrief` decisions waiting
    - `CompanyHealth` risks
    - `CompanyInsights` negative insights
    - `CompanyOpportunities` quick wins + strategic investments
- `CompanyRecommendationPrioritizer`
  - deterministic sorting and grouping into `immediate/soon/later`
  - deterministic `topRecommendation` selection
- `CompanyRecommendationValidator`
  - canonical schema validation (enums, duplicates, dependency integrity, immutability)

## Inputs (Canonical Business Objects)
- `CompanyBrief`
- `CompanyHealth`
- `CompanyInsights`
- `CompanyOpportunities`

Optional inputs are accepted by the engine for future readiness expansion, but this sprint does not duplicate runtime state.

## Relationship to Other Engines
- `CompanyBrief`: drives urgency from decisions waiting
- `CompanyHealth`: drives risk-based remediation
- `CompanyInsights`: drives negative change follow-ups
- `CompanyOpportunities`: drives improvement execution planning (quick wins and strategic investments)

## Future Mission Control Integration
Mission Control can later consume `CompanyRecommendations` to schedule and compound execution workflows.
This sprint does not include execution, approvals, or persistence.

