# Company Brain v1

## Purpose
`CompanyBrain` is the single source of business context for Digital Employees.

It is not just document search, and not just RAG. In v1 it combines:
- Structured Company Data (from `CompanyData`)
- Company Knowledge (from `CompanyKnowledge`)
- Company Policies (from approval rules + knowledge policies)
- Brand Voice (from `CompanyKnowledge.brandVoice`)
- Operational Rules (derived stable guidance for employees)
- Historical Memory (placeholder for future memory/trace retrieval)

## Public API
Only one public method is exposed:

`CompanyBrain.buildBusinessContext(request)`

### Input
`request` includes:
- `employeeId`
- `task`
- `companyId`
- `relatedEntities`

### Output
`BusinessContext` includes:
- `structuredData`
- `relevantDocuments`
- `relevantPolicies`
- `brandVoice`
- `operationalRules`
- `historicalMemory` (placeholder)
- `summary`
- `confidence`

## Determinism
`BrainSearch` is deterministic and uses keyword-based matching (no embeddings, no vector DB).

The module is designed so future embeddings/vector search can replace `BrainSearch`
without changing employee code.

