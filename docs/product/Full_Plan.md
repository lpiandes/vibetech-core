# VIBETech Full Plan — Managed Revenue Follow-Through

**Status:** Living roadmap. Refer back before starting any RFT workstream.  
**Last updated:** 2026-08-05  
**Related Cursor plans:** `RFT Positioning Freeze`, `RFT Contract Runtime`, `Customer Operating Brief IA`  
**Ship quality (mandatory):** [ENGINEERING_SHIP_BAR.md](./ENGINEERING_SHIP_BAR.md) — reusable code, existing Tailwind/Button design system, full test gate before any plan is DONE.

---

## North star

VIBETech is **not** “an AI CRM” and **not** merely software that helps companies adopt AI.

**Finished product:** VIBETech runs **Revenue Follow-Through** for B2B service businesses. We take responsibility for responding to opportunities, coordinating follow-ups, scheduling next steps, chasing proposals, updating systems, and handing won work to delivery. The customer manages decisions and relationships; VIBETech handles the repetitive operational work.

| | Current | Finished |
|---|---|---|
| Product sold | AI Operating System / platform | Managed operating function |
| Comparison | CRM or automation platform | Employee, coordinator, agency, or BPO |
| Main interface | Navigation and modules | Operating brief |
| Customer responsibility | Configure and use the system | Supervise decisions and exceptions |
| AI behavior | Chat, drafts, configured automations | Continuous event-driven work |
| Onboarding | Connect nine setup components | Prove one complete operating outcome |
| Home | Contacts, pipelines, calendar, inbox | Work completed, outcomes, risks, decisions |
| Success | Features enabled | Outcome verified |
| Pricing unit | Packages / software capabilities | Managed service and completed work |

**Central transition:** From “here is software your team can use” → “give VIBETech responsibility for this operating function; we perform the work and show you the results.”

The long-term AI Operating System remains the **engine**. The initial product customers purchase is **one managed business function**.

---

## 1. Who the initial finished product is for

### Include
- B2B service company
- ~10–75 employees
- ~$1M–$20M annual revenue
- Meaningful inbound leads, referrals, or open proposals
- Typical customer value above a few thousand dollars
- Sales follow-through handled by owner, salesperson, assistant, or ops coordinator
- Work spread across email, calendars, CRM, spreadsheets, forms, phone, memory
- Loses money when leads go unanswered, proposals aren’t chased, or sales→delivery handoffs break

### Good initial examples
Commercial contractors · MSPs / IT service · Staffing / recruiting · Business consultancies · Commercial insurance · Marketing / professional-service agencies · Property-management service companies

### Initially exclude
Very low-volume businesses · E-commerce · Won’t connect systems · Highly regulated clinical/legal decisions · Expecting fully autonomous outbound prospecting · Looking only for a chatbot · Cannot identify a valuable repeated workflow

---

## 2. What the customer purchases

Not seats, CRM modules, AI employees, tokens, or automations.

They purchase a **managed operating function with a written service standard**.

### Example: VIBETech Managed Revenue Follow-Through

VIBETech is responsible for:
1. Detecting every inbound opportunity
2. Capturing it in the company’s existing system
3. Researching and classifying it
4. Identifying missing information
5. Preparing or sending the appropriate initial response
6. Assigning the correct human owner
7. Scheduling the next step
8. Preparing the salesperson before a call
9. Recording meeting outcomes
10. Drafting and coordinating follow-up
11. Monitoring outstanding proposals
12. Escalating stalled or high-value opportunities
13. Updating the CRM or source system
14. Creating the post-sale handoff
15. Verifying that each expected action occurred

### Example contract promises (service standard)
- Every eligible lead acknowledged within five minutes during operating hours
- Every lead assigned an owner
- Every meeting followed by a recorded next step
- Every outstanding proposal reviewed on schedule
- Every won opportunity handed to delivery with required information
- Every failure or ambiguous case surfaced to a person

That is a **service**. The platform is how VIBETech delivers it.

### Ownership boundary

| VIBETech owns | Customer owns |
|---|---|
| Opportunity detection | Sales conversations |
| Administrative qualification | Pricing decisions outside approved policy |
| Initial acknowledgement | Relationship judgment |
| Follow-up coordination | Contract negotiation |
| Scheduling (admin) | Final commitments |
| CRM updates | Complex exceptions |
| Proposal monitoring | Service delivery |
| Handoff preparation | |
| SLA monitoring / exception detection / operating reporting | |

---

## 3. Customer-facing product (four primary sections)

### A. Today (default Home) — operating brief
Answers: Is the operation healthy? What has VIBETech accomplished? What requires the customer? What outcome changed? Is anything broken?

Show: health line · work handled today (completed / approval / waiting / exceptions) · performance vs baseline · Needs you · recent completed work with proof.

**Do not show:** contact-count cards, empty pipeline cards, “AI teammates: 1”, rows of zeroes.

### B. Decisions — human judgment only
Every item: what happened · what VIBETech knows · evidence source · why it cannot proceed automatically · proposed action · if approved / if rejected · deadline or SLA risk.

Actions feel managerial: Approve and send · Edit · Assign only · Reject.

### C. Outcomes — proof ledger
Completed outcomes · SLA performance · response-time improvements · auto vs human work · conversion movement · integration delivery evidence · exceptions/failures · estimated human time avoided · operating costs · contract/version changes.

Any outcome opens a full trace (trigger → timed actions → provider IDs → human involvement → Operating Contract version). Never report completed without proof.

### D. Company Rules — Business Memory
Services · approved pricing boundaries · customer types · response-time promises · assignment/escalation · tone · approval policies · scheduling · known exceptions · learned preferences · installed Operating Contracts.

Repeated corrections → suggested rule updates with preview impact, approve, dismiss.

**Secondary:** Connections, users, permissions, billing under Settings. Raw CRM records under Records / evidence drawer — not primary IA.

---

## 4. Ask VIBETech

- Keep Ask; remove empty general-purpose chat as the primary AI experience.
- Ask = command and change interface grounded in live operating context.
- Respond with evidence + proposed actions (Preview / Create work / Do nothing).
- Default suggested questions when empty (stalled proposals, approvals, what changed, escalations, missing evidence).
- Ask is how the customer interrogates and modifies the operation — not the product itself.

---

## 5. How the finished product behaves

1. **Observes before it asks** — website, email, calendar, CRM/spreadsheet; 30–90 days history; ask only what evidence cannot answer.
2. **Compiles an Operating Contract** — versioned: trigger, required evidence, desired outcome, responsible party, SLA, permitted actions, approval rules, success proof, failure conditions, exception owner, retry, cost boundary, metrics.
3. **Replays before going live** — historical events → would complete / approve / escalate; surface missing rules.
4. **Begins in shadow mode** — live observe, propose without external actions; team confirms/corrects.
5. **Earns autonomy** per contract / action class (never one global switch): Observe → Draft → Execute after approval → Auto for proven low-risk → Report → Escalate exceptions only.
6. **Fails visibly** — stop unsafe downstream work; preserve completed state; identify failure; retry safe technical failures; escalate; never claim complete without proof.
7. **Operated by VIBETech** — internal operator console; hybrid AI + human early on.

---

## 6. Keep (engine)

Do not discard these:

1. AI Builder discovery (website research, evidence, gaps, dry runs, approval, versioned changes) — output becomes **Operating Contract**, not “customized workspace”
2. Canonical primitives: Work, Requests, Approvals, Communications, Knowledge, relationships, subjects, Events, Outcomes, Permissions, workspace isolation, runtime snapshots
3. Evidence-first reasoning (no fabricated metrics/facts/readiness)
4. Connected ≠ proven (Not connected → Connected → Tested → Proven in real outcome)
5. Human approval and governance (progressive autonomy, not permanent all-or-nothing forever)
6. Needs Attention → evolve into Decisions
7. Durable execution (jobs, events, retries, credentials, audit)
8. Knowledge / policies → governed Company Rules with provenance
9. Reusable blueprints — emerge from real delivery, freeze imagined vertical expansion
10. Service mentality → “we remain responsible for the operating result”

### Key codebase anchors
- Operating Contracts: `backend/core/ai-builder/operating-contract/`
- Business OS specs: `backend/core/business-os/`
- Prove ladder: `backend/core/platform/capabilities/PlatformCapabilityStatusRegistry.js`, `backend/core/integrations/prove/`
- Specialty fire: `backend/core/ai-builder/specialty/`
- Needs Attention: `frontend/app/b/[businessId]/intelligence/`, Work/Approvals surfaces
- Nav: `frontend/components/workspace/canonicalBusinessNavigation.ts`

---

## 7. Remove from customer-facing product / promise

Underlying data may remain internally.

1. CRM replacement identity (People/Pipelines/Calendar/Inbox/Campaigns/Ads as primary places to manage work)
2. Current primary navigation (replace with Today / Decisions / Outcomes / Company Rules)
3. Setup / dashboard toggle and “Setup 1/9” nine generic missions → one outcome-based launch
4. Record-count KPI cards
5. Blank Ask page / New chat as primary AI experience
6. AI-employee theater (counts, decorative personas, “Off” cards without owned responsibility)
7. Customer-facing automation builders (if/then, visual canvases, prompt editors, model pickers)
8. Broad package catalog as main offer (lead with one managed service)
9. Unsupported continuous “learning” claims until correction → governed policy loop is live
10. Unnecessary vertical expansion (freeze new industry packs)
11. Demos dependent on empty state or fake success (demo must start with a real event)

---

## 8. Ship order — plans

Build in order. Do not start later plans until earlier gates are clear.

### Batch A — done

| # | Plan | Cursor / docs plan | Goal |
|---|---|---|---|
| **1** | Positioning, ownership boundary, freeze | `RFT Positioning Freeze` | Constitution + freeze/continue lists |
| **2** | Canonical RFT Operating Contract | `RFT Contract Runtime` | States, events, outcomes, evidence, v1 blueprint |
| **3** | Customer Operating Brief IA | `Customer Operating Brief IA` | Today / Decisions / Outcomes / Company Rules |

### Batch B — complete (4–8)

Index: [plans/BATCH_B.md](./plans/BATCH_B.md)

| # | Plan | Doc | Goal |
|---|---|---|---|
| **4** | Outcome-based launch | [Plan_04_Outcome_Launch.md](./plans/Plan_04_Outcome_Launch.md) | **DONE** — Connect → confirm → prove → go live (observe/replay/shadow gated honestly) |
| **5** | Minimum RFT integrations | [Plan_05_Min_Integrations.md](./plans/Plan_05_Min_Integrations.md) | **DONE** — Gmail/Calendar/forms/SMS prove → RFT evidence + inbound email events |
| **6** | Historical observation | [Plan_06_Historical_Observe.md](./plans/Plan_06_Historical_Observe.md) | **DONE** — Evidence-linked 30–90d baseline; not_observable honesty |
| **7** | Replay + shadow | [Plan_07_Replay_Shadow.md](./plans/Plan_07_Replay_Shadow.md) | **DONE** — Historical replay + live shadow; go-live gated |
| **8** | Operator console | [Plan_08_Operator_Console.md](./plans/Plan_08_Operator_Console.md) | **DONE** — Cross-client exceptions + mandatory root-cause |

**Recommended next coding:** [Batch C — Plan 9](./plans/BATCH_C.md).

---

### Batch C — plans ready

Index: [plans/BATCH_C.md](./plans/BATCH_C.md)

| # | Plan | Doc | Goal | Depends on |
|---|---|---|---|---|
| **9** | Ask as command interface | [Plan_09_Ask_Command.md](./plans/Plan_09_Ask_Command.md) | **DONE** — Contextual Ask; grounded answers + action drafts; no empty New-chat | 3, 2 |
| **10** | Governed learning | [Plan_10_Governed_Learning.md](./plans/Plan_10_Governed_Learning.md) | **DONE** — Original vs approved → rule propose → version → rollback | 3, 7 |
| **11** | Earned autonomy | [Plan_11_Earned_Autonomy.md](./plans/Plan_11_Earned_Autonomy.md) | **DONE** — Per action-class eligibility from rates, evidence, policy version | 7, 10 |
| **12** | Delivery → moat | [Plan_12_Delivery_Moat.md](./plans/Plan_12_Delivery_Moat.md) | **DONE** — Scrubbed patterns → blueprint library (no confidential pooling) | 8, 10 |

**Recommended next coding:** Beachhead depth — [Full_Plan2.md](./Full_Plan2.md) Batch D (Plans 13–18).

---

## 9. Plan detail sheets (Batch B–C)

### Plan 4 — Outcome-based launch
Customer path:
1. Connect the work (email, calendar, lead system)
2. See how work currently happens (discovered map + baseline)
3. Confirm responsibility (SLAs, owners, approval boundaries, exceptions)
4. Review the replay
5. Run in shadow mode
6. Prove one real case
7. Go live (approved action classes)

Remove: “Setup 1/9”, “Operating dashboard” toggle, nine generic installation missions.

### Plan 5 — Minimum integrations
Priority stack only. Four connection states minimum: Not connected · Connected · Tested · Proven in a real operating outcome. Strengthen prove ladder already in `PlatformCapabilityStatusRegistry` / `IntegrationProveService`.

### Plan 6 — Historical observation
Value before automation: opportunity counts, median first response, aged waits, meetings without next step, proposals without follow-up, incomplete won handoffs — all evidence-linked.

### Plan 7 — Replay + shadow
Replay: eligible / would auto-complete / would need approval / would escalate; list potential problems (consent, missing owners, pricing gaps).  
Shadow: observe live; compare proposed vs should-have; require pass before external actions.

**Note:** Historical path replay and true shadow mode ship in Plan 7 (`rftReplay.js` + `executionMode` on specialty path steps).

### Plan 8 — Operator console
May matter more than polished customer UI early. Hybrid AI + human service. Operator interventions must classify root cause → product roadmap.

### Plan 9 — Ask command
→ [plans/Plan_09_Ask_Command.md](./plans/Plan_09_Ask_Command.md)  
Examples: “Why was Acme escalated?” · “Show every proposal without a next step.” · “Change response promise to one hour.” · “Sarah is on vacation — reassign.” · “What if we stop requiring approval for existing customers?”

### Plan 10 — Governed learning
→ [plans/Plan_10_Governed_Learning.md](./plans/Plan_10_Governed_Learning.md)  
Only after this loop is live may we truthfully say the system “learns.” Until then: stores decisions, preserves context, records outcomes, proposes changes.

### Plan 11 — Earned autonomy
→ [plans/Plan_11_Earned_Autonomy.md](./plans/Plan_11_Earned_Autonomy.md)  
Example: existing-customer scheduling at 97% approval / 0 critical corrections → auto eligible; new-customer pricing at high edit rate → not eligible.

### Plan 12 — Delivery moat
→ [plans/Plan_12_Delivery_Moat.md](./plans/Plan_12_Delivery_Moat.md)  
Promote generalized patterns: assignment rules, proposal-stall definitions, consent boundaries, handoff requirements, scheduling exceptions, integration recovery — into blueprint library from real customers, not imagined universality.

---

## 10. Transition phases (original timeline map)

Maps original Phase 1–12 to plan numbers:

| Original phase | Plan # | Timing hint |
|---|---|---|
| 1 Company decision | 1 | Immediately |
| 2 Freeze distracting development | 1 | First week |
| 3 Canonical RFT contract | 2 | Week 1 |
| 4 Minimum integration set | 5 | Weeks 1–4 |
| 5 Historical observation | 6 | Weeks 2–5 |
| 6 Replay and shadow | 7 | Weeks 4–7 |
| 7 Operator console | 8 | Weeks 4–8 |
| 8 Outcome launch | 4 | Weeks 6–9 |
| 9 Replace interface | 3 | Weeks 7–10 |
| 10 Governed learning | 10 | Weeks 8–12 |
| 11 Earned autonomy | 11 | After replay + corrections |
| 12 Delivery → moat | 12 | Ongoing after design partners |

---

## 11. Freeze vs continue (until Batch A done)

### Pause
New dashboards · new verticals · marketplace · new AI employee personas · campaign/ad expansion · general CRM feature parity · visual automation tooling · broad analytics · cosmetic empty-screen work

### Continue only
Reliability · security · tenant isolation · integration health · work execution · approvals · outcome tracking · first Operating Contract · Batch A plans

---

## 12. YC / proof package (what evidence matters)

Story: B2B service companies hire coordinators so opportunities don’t fall through cracks. VIBETech replaces most of that operational work — connect email/calendar/CRM, reconstruct operation, install versioned Operating Contract, perform the work. Charge for managed service, not seats.

Proof targets:
- 3–5 paying design partners
- One shared workflow across them
- Thousands of real events processed
- >90% SLA attainment
- Growing share completed without human intervention
- Every consequential action traceable
- No fabricated outcomes
- Clear before/after performance
- At least one customer: “We no longer need to hire another coordinator because VIBETech runs this.”

---

## 13. Single most important strategic instruction

**Do not discard the engine. Discard the idea that the customer needs to buy and operate the engine.**

Keep: Builder · Contracts · Work · Evidence · Approvals · Knowledge · Integrations · Persistence · Proving · Governance  

Replace: CRM-first UI · module-first packaging · empty chat · generic AI employees · broad setup · feature-based sales  

With: One managed function · one explicit responsibility · one outcome-based launch · one operator-supported execution loop · one proof ledger · one progressively autonomous system  

Finished VIBETech is an **accountable operating team**—powered by software—that owns a specific part of the business and proves the work was completed.

---

## 14. Progress checklist

Update this section as plans ship.

### Batch A
- [x] Plan 1 — Positioning & freeze (`PRODUCT_CONSTITUTION.md`, `docs/product/VIBETECH_PRODUCT_CONSTITUTION.md`, `docs/product/DEVELOPMENT_FREEZE.md`, offer docs)
- [x] Plan 2 — RFT Contract Runtime (`backend/core/ai-builder/operating-contract/rft/`, schema, state machine, proof-gated Verified, `bp_rft_b2b_services`)
- [x] Plan 3 — Customer Operating Brief IA (Today / Decisions / Outcomes / Company Rules; Records demoted)

### Batch B
- [x] Plan 4 — Outcome-based launch → [plans/Plan_04_Outcome_Launch.md](./plans/Plan_04_Outcome_Launch.md)
- [x] Plan 5 — Minimum RFT integrations → [plans/Plan_05_Min_Integrations.md](./plans/Plan_05_Min_Integrations.md)
- [x] Plan 6 — Historical observation + baseline → [plans/Plan_06_Historical_Observe.md](./plans/Plan_06_Historical_Observe.md)
- [x] Plan 7 — Replay + shadow mode → [plans/Plan_07_Replay_Shadow.md](./plans/Plan_07_Replay_Shadow.md)
- [x] Plan 8 — Operator console → [plans/Plan_08_Operator_Console.md](./plans/Plan_08_Operator_Console.md)

### Batch C
- [x] Plan 9 — Ask as command interface → [plans/Plan_09_Ask_Command.md](./plans/Plan_09_Ask_Command.md)
- [x] Plan 10 — Governed learning → [plans/Plan_10_Governed_Learning.md](./plans/Plan_10_Governed_Learning.md)
- [x] Plan 11 — Earned autonomy → [plans/Plan_11_Earned_Autonomy.md](./plans/Plan_11_Earned_Autonomy.md)
- [x] Plan 12 — Delivery → moat → [plans/Plan_12_Delivery_Moat.md](./plans/Plan_12_Delivery_Moat.md)

---

## 15. How to use this file

1. Before starting work, open this file and confirm which plan # you are executing.
2. Open [ENGINEERING_SHIP_BAR.md](./ENGINEERING_SHIP_BAR.md) and treat it as the definition of DONE (reuse modules, design-system Button/Tailwind tokens, automated + manual tests, no fabricated success).
3. Batch C (Plans 9–12) and Batch D (Plans 13–18) are complete. **Active mode:** design-partner delivery under [DEVELOPMENT_FREEZE.md](./DEVELOPMENT_FREEZE.md) + [DESIGN_PARTNER_SEQUENCE.md](./DESIGN_PARTNER_SEQUENCE.md). Non-pilot work → [POST_PILOT_BACKLOG.md](./POST_PILOT_BACKLOG.md).
4. Do not expand verticals, CRM parity, or package catalog while this roadmap is active.
5. When in doubt: does this help VIBETech **own and prove** Revenue Follow-Through for one B2B service customer? If no, freeze it.
6. Never mark a plan DONE until the ship bar passes — fix bugs and regressions in-plan.
