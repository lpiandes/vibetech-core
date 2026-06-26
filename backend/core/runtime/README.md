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

---

## Runtime MVP (Sprint 2) — Decision Resolver

### Purpose of `DecisionResolver`

`DecisionResolver` is the second executable component of the Decision Runtime.

It converts the output of `SituationEvaluator`:

```js
{ situation, confidence, reason }
```

into a deterministic business decision:

```js
{ decision, reason, requiresApproval }
```

It:
- does NOT generate text
- does NOT make actions
- does NOT call AI
- does NOT call providers
- does NOT perform any execution

### Situation identification vs business decision

- `SituationEvaluator` answers: *“What kind of situation are we in?”*
- `DecisionResolver` answers: *“What decision should the employee take?”*

### How Action Planner will consume DecisionResolver output (future)

Later runtime components (for example, an “Action Planner”) will:

1. Call `SituationEvaluator.evaluate(input)`
2. Call `DecisionResolver.resolve(situationResult)`
3. Map `decision` into actions/workflows (implemented in later sprints)

This separation preserves contract stability: the decision mapping can evolve independently of how actions are implemented.

### Why deterministic decision rules are valuable before AI

Deterministic decision rules enable:

- predictable behavior for the same inputs
- clear governance (which decisions require attorney approval)
- an auditable decision pipeline that can be tested with scenario coverage

---

## Runtime MVP (Sprint 3) — Action Planner

### Purpose of `ActionPlanner`

`ActionPlanner` converts the business decision output into a deterministic **execution plan** contract.

It does **not** execute actions.
It does **not** call AI.
It does **not** call providers.
It does **not** generate text.

### Deciding vs planning

- `DecisionResolver` chooses a *business decision* (e.g., `DRAFT_CASE_UPDATE`).
- `ActionPlanner` maps that decision into a deterministic *plan* (e.g., `CREATE_DRAFT` + `ATTORNEY_REVIEW`).

### How future Execution components consume its output

Later runtime components (the “Execution” step) will consume the planning output by reading:

- `action`
- `nextStep`
- `requiresApproval`
- `reason`

and then (in later roadmap steps) performing the actual side-effectful work via provider/integration code.

---

## Runtime MVP (Sprint 4) — Runtime Pipeline

### Purpose of `RuntimePipeline`

`RuntimePipeline` is the first executable orchestration component that coordinates the runtime steps:

1. `SituationEvaluator.evaluate(input)`
2. `DecisionResolver.resolve(situationResult)`
3. `ActionPlanner.plan(decisionResult)`

It returns a combined deterministic runtime response contract.

### Why orchestration is separated from business logic

`RuntimePipeline` is intentionally a *thin orchestrator*:

- it does NOT implement classification rules
- it does NOT implement decision mapping rules
- it does NOT implement action planning mappings

Those responsibilities stay in their dedicated components so that each layer can evolve independently while keeping contracts stable and auditable.

### How future AI generation and execution layers consume pipeline output

Future roadmap layers can consume the pipeline response by reading:

- `situation`
- `decision`
- `action`
- `nextStep`
- `requiresApproval`
- `reason`

At a later stage, execution components can translate `action/nextStep` into side effects (provider/integration work), while keeping governance (`requiresApproval`) consistent.


