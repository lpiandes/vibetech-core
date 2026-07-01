# Capabilities

## What a capability is
A **capability** is a reusable, deterministic reasoning unit that a Digital Employee can call to produce a business-ready recommendation.

Capabilities are intentionally:
- **pure & deterministic** (same inputs => same outputs)
- **industry-focused but reusable** (shared logic across employees)
- **business-language only** (no runtime/provider/AI terminology)

## Why capabilities are reusable
Instead of embedding all reasoning inside an employee:
- employees focus on orchestration and governance wiring
- capabilities provide the domain “understanding” building blocks

This makes it easy to:
- test reasoning in isolation
- reuse property research across future employees (e.g., appointment coordinator)
- keep employee contracts stable while evolving how recommendations are produced

## How employees compose capabilities
Employees should:
1. Call the capability with `{ property, buyerInquiry, companyKnowledge }`
2. Use the capability output to enrich:
   - employeeSummary
   - employeeThinking (shown to owners/reviewers)
   - draft context passed into existing orchestration/view adapters

Capabilities should never:
- mutate runtime/company state
- call providers or networking
- implement governance flows directly

