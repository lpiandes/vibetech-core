# Import pipeline (S1-2A)

Universal CRM import orchestration for dry-run analysis. Canonical mutation is deferred to S1-2B.

## Scope

- Upload CSV artifacts
- Inspect columns and suggest mappings from package `importProfiles`
- Map source columns to canonical fields
- Dry-run identity resolution, conflict detection, and import planning
- Persist row-level dry-run evidence in platform DB

## Non-goals (S1-2A)

- Commit / canonical writes
- Inbound orchestration
- Operating loop integration

## API

Routes live under `/api/businesses/{businessId}/imports` and require `integrations.manage`.
