# Opportunity Engine (Epic 4 Sprint 4)

## Purpose
Generate deterministic **business improvement opportunities** from platform state.

Answers exactly one business question:
> "Where can this business improve next?"

No AI, no prediction, no persistence, no UI.

## Responsibilities
- `CompanyOpportunityEngine`
  - orchestration entry point that validates and returns canonical `CompanyOpportunities`
- `CompanyOpportunityBuilder`
  - deterministic detection + scoring + composition
- `CompanyOpportunityScorer`
  - impact/effort/priority computation helpers
- `CompanyOpportunityValidator`
  - canonical schema validation (duplicates, allowed enums, recommendedAction presence)

## Opportunity Model Relationship
- `CompanyHealth` indicates current organizational health and scores.
- `CompanyBrief` indicates what is happening / what to do now.
- `CompanyInsights` indicates what changed (used only for deterministic urgency signals).
- Engine does not mutate runtime state; it composes new canonical objects.

## Relationship to Future Mission Control
Mission Control can later consume `CompanyOpportunities` to schedule compounding workflows.
This sprint does not include that orchestration or persistence.

