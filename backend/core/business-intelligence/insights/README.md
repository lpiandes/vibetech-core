# Insight Engine (Epic 4 Sprint 3)

## Purpose
Generate deterministic **change detection** intelligence by comparing prior and current snapshots.

Answers exactly one question:
> "What changed?"

## Responsibilities
- `CompanyInsightEngine`
  - orchestrates snapshot comparison into a canonical `CompanyInsights` object
- `CompanyInsightBuilder`
  - computes comparable values and composes `CompanyInsight[]` deterministically
- `CompanyInsightComparator`
  - provides deterministic ordering for insights + attention items
- `CompanyInsightValidator`
  - validates canonical object integrity and immutability assumptions

## Snapshot Inputs
The engine accepts any supported snapshot inputs:
- `previousCompanyHealth` / `currentCompanyHealth`
- `previousCompanyBrief` / `currentCompanyBrief`
- `previousRuntimeSnapshot` / `currentRuntimeSnapshot` (optional)

The engine must work even if only health snapshots are provided.

## Relationship to Company Health
Company Health is the “current state” and “previous state” input.
Insight Engine detects deltas in overall score, dimensions, risks, and recommendations.

## Relationship to Company Brief
Company Brief is used to detect deterministic changes in:
- pending work / decisions waiting
- knowledge counts
- activity volume
- derived risk/recommendation deltas (when available)

## Future Mission Control integration
Mission Control will later consume `CompanyInsights` to schedule compounding workflows.
This sprint does not include persistence or UI.

## Future persistence
Not implemented. Snapshots are passed in by the caller.

