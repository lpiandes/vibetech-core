# VIBETech Product Constitution

**Version:** 2.0  
**Status:** Authoritative product document  
**Scope:** What VIBETech sells, who it is for, ownership boundaries, and how the product must feel  
**Companion:** [Platform Constitution](../architecture/VIBETECH_PLATFORM_CONSTITUTION.md) (how we build / locked contracts)  
**Roadmap:** [Full_Plan.md](./Full_Plan.md) · [Development freeze](./DEVELOPMENT_FREEZE.md) · [Engineering ship bar](./ENGINEERING_SHIP_BAR.md)

> Platform Constitution = how we build and what stays locked in code.  
> Product Constitution = what we sell and how it must feel to the owner.

---

## The Product (locked company decision)

VIBETech’s **initial finished product** is not “an AI CRM” and not merely software that helps companies adopt AI.

**Customers purchase:** managed **Revenue Follow-Through** for B2B service businesses — a managed operating function with a written service standard.

**What that means:** VIBETech takes responsibility for responding to opportunities, coordinating follow-ups, scheduling next steps, chasing proposals, updating systems, and handing won work to delivery. The customer manages decisions and relationships; VIBETech handles the repetitive operational work.

| | Do not sell as the product | Do sell / do deliver |
|---|---|---|
| Offer | Seats, CRM modules, AI employees, tokens, automation packages | Managed Revenue Follow-Through (service standard + proven outcomes) |
| Comparison | CRM or automation platform | Coordinator, ops hire, agency, or BPO |
| Success | Features enabled / packages installed | Outcomes verified with proof |
| Pricing unit | Software capabilities / package catalog | Managed service and completed work |

### Engine vs offer

The long-term **AI Operating System** remains the **engine** (Builder, contracts, Work, Approvals, Knowledge, Events, integrations, prove, governance).

The **sellable SKU** is one managed business function: Revenue Follow-Through.  
Do **not** lead with “AI Business OS,” package catalogs, or AI-employee counts as the customer promise.

Full roadmap and phased plans: [Full_Plan.md](./Full_Plan.md).

---

## Initial customer profile (ICP)

### Include
- B2B service company
- Approximately 10–75 employees
- Approximately $1M–$20M annual revenue
- Meaningful inbound leads, referrals, or open proposals
- Typical customer value above a few thousand dollars
- Sales follow-through currently handled by an owner, salesperson, assistant, or operations coordinator
- Work spread across email, calendars, CRM, spreadsheets, forms, phone, and memory
- Loses money when leads go unanswered, proposals are not chased, or sales-to-delivery handoffs break

### Good initial examples
Commercial contractors · MSPs and IT service · Staffing and recruiting · Business consultancies · Commercial insurance · Marketing and professional-service agencies · Property-management service companies

### Initially exclude
Very low-volume businesses · E-commerce · Will not connect systems · Highly regulated clinical or legal decisions · Completely autonomous outbound prospecting · Chatbot-only buyers · No identifiable repeated workflow

---

## Ownership boundary

| VIBETech owns | Customer owns |
|---|---|
| Opportunity detection | Sales conversations |
| Administrative qualification | Pricing decisions outside approved policy |
| Initial acknowledgement | Relationship judgment |
| Follow-up coordination | Contract negotiation |
| Scheduling (administrative) | Final commitments |
| CRM / source-system updates | Complex exceptions |
| Proposal monitoring | Service delivery |
| Post-sale handoff preparation | |
| SLA monitoring, exception detection, operating reporting | |

Do not begin platform work that expands beyond this boundary until the boundary is deliberately revised.

---

## Service standard (what the contract promises)

Example responsibilities under Managed Revenue Follow-Through:

Detect every inbound opportunity · Capture it in the existing system · Research and classify · Identify missing information · Prepare or send initial response · Assign human owner · Schedule next step · Prepare salesperson before a call · Record meeting outcomes · Draft and coordinate follow-up · Monitor outstanding proposals · Escalate stalled or high-value opportunities · Update CRM · Create post-sale handoff · Verify each expected action occurred

Example promises:
- Every eligible lead acknowledged within the contracted SLA during operating hours
- Every lead assigned an owner
- Every meeting followed by a recorded next step
- Every outstanding proposal reviewed on schedule
- Every won opportunity handed to delivery with required information
- Every failure or ambiguous case surfaced to a person

That is a **service**. The platform is how VIBETech delivers it.

---

## Product rule: connected is not proven

Integrations and capabilities must never be treated as “working” because OAuth succeeded or a toggle is on.

Every integration has at least four states:

1. **Not connected**
2. **Connected**
3. **Tested**
4. **Proven** in a real operating outcome (provider IDs / delivery confirmation required)

Never fabricate metrics, connected capabilities, business facts, readiness, or completed outcomes. Evidence references, confidence, missing-evidence visibility, and human confirmation of discovered facts are mandatory.

---

## Customer promise (experience shape)

```
Observe the business from connected systems and evidence
        ↓
Compile a versioned Operating Contract for Revenue Follow-Through
        ↓
Replay historically → run in shadow → prove one real opportunity
        ↓
Go live on approved action classes
        ↓
Supervise Decisions; review Outcomes; evolve Company Rules
        ↓
Talk to VIBETech to interrogate or change the operation
```

The owner should never think about Builders, Architects, Mission Control, pipelines, runtimes, installs, stages, or AI infrastructure as products.

---

## Product Principles

These principles override implementation convenience.

1. **The owner supervises decisions and exceptions.** They do not configure an automation platform.
2. **VIBETech operates the contracted function.** Humans approve when judgment is required; AI executes within earned autonomy.
3. **Ask VIBETech is a command interface grounded in live operating context** — not an empty general-purpose chat product.
4. **Everything important is explainable.** No black boxes. Evidence for every recommendation and outcome.
5. **Everything consequential is approved until autonomy is earned** for that action class. Autonomy is never one global switch.
6. **Business Memory / Company Rules are the source of truth.** Not prompts. Not temporary chat.
7. **One product surface for the managed function.** Primary IA: Today · Decisions · Outcomes · Company Rules (see Full_Plan).
8. **Simplicity beats cleverness.** If engineers understand it but owners don’t, the product failed.
9. **Outcomes without proof are incomplete.** Never report completed work without delivery evidence.

---

## The Five Second Test (Today / Home)

Today must answer these questions immediately.

1. Is the operation healthy?
2. What has VIBETech accomplished?
3. What requires me (Decisions)?
4. What outcome changed?
5. Is anything broken?

If Home answers with empty contact counts, pipeline zeroes, or AI-teammate theater, it has failed.

---

## What Is Locked Forever (engine)

The following architecture is constitutional. Evolve it; do not replace it for UI convenience.

- BusinessGraph · BusinessSubject · Business relationships
- Canonical runtime snapshots
- Approval model (candidate → proposal → approval → work → memory)
- Canonical Work · Canonical Requests
- Business Memory / Knowledge
- Operating Contracts · Business OS specifications
- Events · Outcomes · prove / capability status
- Workspace isolation · Permissions · Portal isolation
- Business Runtime · Business Intelligence · Canonical persistence
- Durable jobs, retries, credential separation, audit events

### Rule

Extend these. Never fork them. Never duplicate them for UI convenience.

Internal employee archetypes may remain. Externally, sell the **responsibility and outcome**, not decorative AI-employee rosters.

---

## What must leave the customer promise (implement in later plans)

Remove from primary IA and company promise (underlying records may remain as evidence):

- CRM-first identity (People, Pipelines, Calendar, Inbox, Campaigns, Ads as top-level destinations)
- Setup 0/9 / dashboard toggle and nine generic installation missions
- Record-count KPI cards and empty-state theater
- Blank Ask / New chat as the primary AI experience
- AI-employee counts and personas without owned Operating Contracts and measured work
- Customer-facing automation builders (if/then, canvases, prompt/model editors)
- Broad package catalog as the lead offer
- Unsupported “continuously learns” claims until governed correction → Company Rule loop is live
- New vertical expansion until Revenue Follow-Through is repeatedly successful
- Demos that depend on empty state or fake success

---

## Ask VIBETech

Ask remains. It is how the customer interrogates and modifies the operation.

It is **not** the product. Prefer suggested operating questions and evidence-backed actions over an empty chat canvas.

---

## Architect / Builder

Architect is not a product. It is VIBETech planning with the owner (discovery → recommendation → approval → install).

**Change the output framing:** from “your customized workspace” to “the Operating Contract VIBETech will execute.”

Keep: conversational discovery, website research, evidence extraction, gap detection, dry runs, approval, versioned changes.

---

## What Must Disappear (UX debt)

- **Multiple Homes** — One Home. One URL. One experience.
- **Mission Control** — Internal compose layer only. Owners never see that name.
- **Dashboard mentality** — Equal-sized KPI cards, analytics-first layouts, configuration-first UX.
- **Parallel Builder flows** — One façade. One lifecycle. One install path.
- **Demo leakage** — Demo mode quarantined. Never visible in production.
- **Engineering terminology** in owner UI: Mission Control, Operating Pulse, Digital Workforce, Builder, Launch, Pipeline, DNA, Assembly, Plan Mode.
- **Configuration-first UI** — Owners should not build software. Owners should supervise an operating function.

---

## Things We Never Build (customer-facing)

- Another CRM as the primary product
- Workflow builders · If/then editors · Automation canvases
- Prompt editors · Agent playgrounds · JSON editors
- Business logic duplicated in UI
- Industry-specific or customer-specific backend forks
- Internal engineering tools exposed as owner features

---

## Current Product Architecture (engine path)

```
Business Owner
    ↓
Today (operating brief)
    ↓
Observe → Operating Contract → Replay → Shadow → Prove → Go live
    ↓
Decisions · Outcomes · Company Rules
    ↓
Ask VIBETech (command / change)
    ↓
Canonical Runtime (Work · Approvals · Memory · Integrations · Prove)
    ↓
Improved operation
```

---

## Execution Roadmap

Authoritative phased plans and checkboxes: [Full_Plan.md](./Full_Plan.md).

| Batch | Focus |
|------|--------|
| **A** | Positioning & freeze · RFT contract runtime · Today / Decisions / Outcomes / Company Rules |
| **B** | Outcome launch · Min integrations · Historical observation · Replay / shadow · Operator console |
| **C** | Ask as command · Governed learning · Earned autonomy · Delivery → blueprint moat |

**Deferred while RFT is the beachhead:** Marketplace, broad vertical packs, CRM feature parity, campaign/ad expansion, visual automation tooling, cosmetic empty-state work.

Development freeze vs continue: [DEVELOPMENT_FREEZE.md](./DEVELOPMENT_FREEZE.md).

---

## Engineering Rules

1. Never redesign stable architecture because it looks cleaner. Architecture changes require correctness, scalability, or product coherence.
2. Never expose implementation details.
3. Never create parallel systems.
4. Never fork canonical models.
5. Demo stays isolated.
6. Product language always wins over engineering language.
7. One business concept. One implementation. One customer experience.
8. Connected is never proven. Outcomes without proof are incomplete.
9. Do not expand beyond the Revenue Follow-Through ownership boundary without an explicit constitution revision.
10. Ship bar: reuse existing modules and UI (`Button`, Tailwind theme tokens); extend locked architecture; test before DONE — see [ENGINEERING_SHIP_BAR.md](./ENGINEERING_SHIP_BAR.md).

---

## The North Star

Every decision should be evaluated with one question:

> Does this help VIBETech **own and prove** Revenue Follow-Through for a B2B service customer — or does it sell software modules / expose internal machinery?

If it exposes the machinery or expands the package catalog instead of deepening the managed function, it is the wrong direction.
