# VIBETech Full Plan 2 — Beachhead depth (after Plans 1–12)

**Status:** Living roadmap — Batch D complete (Plans 13–18).  
**Last updated:** 2026-08-05  
**Prerequisite:** Plans 1–12 DONE (scaffolding). This batch makes the finished product *behave* like managed Revenue Follow-Through day-to-day.  
**Ship quality:** [ENGINEERING_SHIP_BAR.md](./ENGINEERING_SHIP_BAR.md) — still mandatory.  
**Freeze:** [DEVELOPMENT_FREEZE.md](./DEVELOPMENT_FREEZE.md) still applies — depth, not verticals / CRM parity / marketplace.

---

## Why this file exists

Full_Plan Plans 1–12 shipped the **engine + IA + launch + learning + autonomy + moat scaffolding**.

What was *not* finished (and felt “missing” from Full_Plan §3–7 / §12):

1. Continuous **event-driven** RFT (inbound → card → progress), not only launch/prove APIs  
2. **Decisions** as the judgment queue (Approve and send / Edit / Assign / Reject) — not BI “ideas”  
3. **Ask confirm** applying drafts in the UI  
4. **Outcomes / Today** proof metrics (baseline delta, SLA, auto vs human, time avoided) + fail-visibly  
5. **Offer & IA cleanup** — RFT-first entitle; demote AI-employee / Automations / package theater  
6. **Demo honesty** + refresh beachhead checklist / runbook for shipped Plans 10–11  

This file is the plan for that remaining work. Do not start verticals here.

---

## North star (unchanged)

Customer buys **managed Revenue Follow-Through**. VIBETech performs the work and proves it. The AI OS is the engine.

---

## Batch D — ship order

Index: [plans/BATCH_D.md](./plans/BATCH_D.md)

| # | Plan | Doc | Goal | Depends on |
|---|---|---|---|---|
| **13** | Continuous RFT event loop | [Plan_13_Continuous_RFT_Loop.md](./plans/Plan_13_Continuous_RFT_Loop.md) | Live inbound → seed/progress RFT; specialty/approval outcomes advance states | 2, 5, 7 |
| **14** | Decisions judgment queue | [Plan_14_Decisions_Queue.md](./plans/Plan_14_Decisions_Queue.md) | Decisions = Needs-you + RFT approvals/exceptions with managerial actions | 3, 8, 13 |
| **15** | Ask draft confirm | [Plan_15_Ask_Draft_Confirm.md](./plans/Plan_15_Ask_Draft_Confirm.md) | Ask `actionDraft` → Preview / Confirm / Do nothing wired to contract + learning | 9, 10 |
| **16** | Proof metrics + fail-visibly | [Plan_16_Proof_Metrics.md](./plans/Plan_16_Proof_Metrics.md) | Outcomes/Today: baseline delta, SLA, auto/human; failed externals → Exception | 6, 13 |
| **17** | Offer & IA cleanup | [Plan_17_Offer_IA_Cleanup.md](./plans/Plan_17_Offer_IA_Cleanup.md) | RFT-first create/entitle; demote teammate/Automations theater; scrub Mission 6/Launch Center residue | 1, 3, 4 |
| **18** | Demo honesty + ops docs | [Plan_18_Demo_Ops_Honesty.md](./plans/Plan_18_Demo_Ops_Honesty.md) | Demo requires real/controlled event; checklist/runbook match shipped product | 13–17 |

**Build order:** 13 → 14 → 15 → 16 → 17 → 18.

---

## Explicitly still out of scope (freeze)

- New verticals / industry packs  
- Marketplace  
- Campaigns / ads expansion  
- CRM feature parity as primary product  
- Visual automation builders / prompt editors  
- Fabricated YC metrics (paying partners, “thousands of events”) — those are **ops outcomes**, not code plans  

YC proof package from Full_Plan §12 remains the **measurement target** for design-partner delivery after Batch D ships.

---

## Progress checklist

### Batch D
- [x] Plan 13 — Continuous RFT event loop → [plans/Plan_13_Continuous_RFT_Loop.md](./plans/Plan_13_Continuous_RFT_Loop.md)
- [x] Plan 14 — Decisions judgment queue → [plans/Plan_14_Decisions_Queue.md](./plans/Plan_14_Decisions_Queue.md)
- [x] Plan 15 — Ask draft confirm → [plans/Plan_15_Ask_Draft_Confirm.md](./plans/Plan_15_Ask_Draft_Confirm.md)
- [x] Plan 16 — Proof metrics + fail-visibly → [plans/Plan_16_Proof_Metrics.md](./plans/Plan_16_Proof_Metrics.md)
- [x] Plan 17 — Offer & IA cleanup → [plans/Plan_17_Offer_IA_Cleanup.md](./plans/Plan_17_Offer_IA_Cleanup.md)
- [x] Plan 18 — Demo honesty + ops docs → [plans/Plan_18_Demo_Ops_Honesty.md](./plans/Plan_18_Demo_Ops_Honesty.md)

---

## How to use

1. Open this file before starting beachhead-depth work.  
2. Open the plan sheet + [ENGINEERING_SHIP_BAR.md](./ENGINEERING_SHIP_BAR.md).  
3. Keep [Full_Plan.md](./Full_Plan.md) as the strategic constitution of *what* we sell; this file is *what’s left to make it true in the product*.  
4. Mark DONE only when the plan’s “Ships when” + ship bar pass.\n\n---\n\n## Next\n\nScaffolding complete. Behavior close-out: **[Full_Plan3.md](./Full_Plan3.md)** (Batch E).\n