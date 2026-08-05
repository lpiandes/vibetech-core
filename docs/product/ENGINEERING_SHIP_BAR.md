# Engineering ship bar — every RFT plan

**Status:** Mandatory for Plans 2–12 (and any related work).  
**Bar:** Ship as a senior engineer at a company that expects zero silent mistakes — correct, reusable, tested, integrated, and styled with the existing design system.

A plan is **not DONE** until every applicable item below passes. Docs-only plans (Plan 1) use the Documentation gate only.

Roadmap: [Full_Plan.md](./Full_Plan.md) · Design: [DESIGN_LANGUAGE.md](../design/DESIGN_LANGUAGE.md) · Freeze: [DEVELOPMENT_FREEZE.md](./DEVELOPMENT_FREEZE.md)

---

## 1. Code quality (backend and frontend)

- Prefer **small reusable functions/modules** over copy-paste. Extract shared logic into named files under existing packages (`backend/core/...`, `frontend/lib/...`, `frontend/components/...`).
- Extend locked architecture — **never fork** parallel Work, Approvals, Operating Contracts, prove, or nav systems.
- Match existing patterns: naming, error shapes, evidence/proof fields, tenant isolation, idempotency.
- No dead code, speculative abstractions, or “temporary” hacks left in the merge.
- Typed at the boundaries the repo already uses (TS on frontend; validated schemas/contracts on backend).
- Fail visibly: no fabricated success, metrics, or “proven” without evidence (constitution rule).

## 2. UI / styling

- Reuse existing components first — especially [`frontend/components/ui/button.tsx`](../../frontend/components/ui/button.tsx) (`Button` / `buttonVariants`).
- Use **existing Tailwind tokens and theme colors** (`primary`, `muted`, `destructive`, `border`, `ring`, semantic status classes). Do not invent one-off hex palettes or parallel button CSS.
- Follow [DESIGN_LANGUAGE.md](../design/DESIGN_LANGUAGE.md), executive experience, and motion guidelines already in `docs/design/`.
- New screens must match shell / operating surfaces already in the product (spacing, type hierarchy, calm executive tone).
- No decorative AI theater, KPI zero-cards, or configuration-first clutter (see product constitution).

## 3. Integration with the rest of the system

- Wire through real APIs, stores, and events — not mock-only happy paths.
- Respect tenant isolation, permissions, approval gates, and capability prove ladder.
- Confirm no regressions to Home, Ask, Work/Approvals, integrations, or admin paths touched by the change.
- Update constitution / Full_Plan checkboxes only after behavior is real.

## 4. Testing gate (required before DONE)

Run what the change area warrants; do not skip because “it looks fine.”

| Layer | Expectation |
|---|---|
| Unit / contract | New pure logic and schemas have tests next to existing suites (e.g. `*.test.js` / frontend tests the repo already uses) |
| Integration | Paths that write/read DB, fire specialty steps, or prove integrations are exercised |
| Regression | Run targeted existing tests for touched modules; fix failures before merge |
| Manual / prove | Owner-visible flows checked against honesty gates (connected ≠ proven; no fake Succeeded) |
| Lint / types | Frontend typecheck / lint clean for touched files |

If a plan adds runtime behavior and has **zero** automated coverage where the codebase already tests similar code, it is **not DONE**.

## 5. Definition of DONE

A plan may be marked complete only when:

1. Acceptance criteria in that plan’s “Ships when” section are met.  
2. This ship bar’s applicable sections are satisfied.  
3. Known bugs in the plan’s surface are fixed (or explicitly blocked with owner-visible honesty — never papered over).  
4. [Full_Plan.md](./Full_Plan.md) progress checkbox is updated.  
5. No freeze-list work was slipped in.

---

## Plan 1 (docs) — Documentation gate

- [x] Constitution + ownership boundary + connected≠proven written  
- [x] Freeze / continue lists published  
- [x] Offer docs no longer lead with AI Business OS as the sellable SKU  
- [x] Full_Plan Batch A Plan 1 checked  

---

## How agents and humans must work

1. Read this file at the start of every plan.  
2. Reuse before inventing.  
3. Test before claiming DONE.  
4. If something breaks adjacent code, fix it in the same plan — do not leave “known issues” for later unless blocked by a later Full_Plan dependency (and document the gap).
