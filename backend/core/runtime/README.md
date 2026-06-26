# Runtime MVP (Sprint 1) — Situation Evaluator

## Purpose of `SituationEvaluator`

The `SituationEvaluator` is the first executable component of the VIBETech Decision Runtime.

Its job is intentionally narrow:
- Identify what business situation currently exists.
- Provide a structured classification output that downstream runtime components can consume.

It does **not**:
- make decisions
- choose actions
- generate text
- select prompts or models
- call providers (CRM/LLM/DB/email)
- implement AI

## Situation identification vs decision-making

- **Situation identification** answers: *“What kind of moment are we in?”*  
  Example: `CLIENT_REQUESTED_UPDATE` or `WAITING_ON_EXTERNAL_PARTY`.
- **Decision-making** answers: *“Given that situation, what should the employee do next?”*

In Sprint 1 we only build the first half (situation identification). Future sprint components will consume the evaluator output to decide actions without changing this evaluator’s contract.

## Input contract

`evaluate(input)` may contain:

- `attorneyNote` (string)
- `caseEvent` (any, either structured or a string)
- `daysSinceLastClientUpdate` (number)
- `clientRequestedUpdate` (boolean)
- `isUrgent` (boolean)
- `confidence` (number from 0..1, if available)

## Output contract

The evaluator returns:

```js
{
  situation,   // one of the supported situation identifiers
  confidence,  // normalized confidence number
  reason       // deterministic business explanation of why the situation was selected
}
```

## How future runtime components consume its output

Later components will:

1. Call `SituationEvaluator.evaluate(input)`
2. Read `output.situation`
3. Apply a deterministic or governance-aware decision policy for that situation
4. Only after policy decisions, map those decisions to actions (outside of Sprint 1)

This separation protects product quality because:
- the situation layer stays stable and testable
- the decision layer can evolve independently
- business contracts are explicit, and behavior changes remain reviewable

## Why deterministic business rules are used in Sprint 1

Deterministic rules are used to:
- create consistent results for the same inputs
- enable scenario-based testing and regression
- avoid introducing AI variability before the platform’s decision governance is fully defined
- keep Sprint 1 tightly scoped to the architecture contract (situation identification only)

