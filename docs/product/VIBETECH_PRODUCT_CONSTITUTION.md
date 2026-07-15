# VIBETech Product Constitution

**Version:** 1.0  
**Status:** Authoritative product document  
**Scope:** What VIBETech is to the owner — experience principles, locked architecture boundaries, and roadmap  
**Companion:** [Platform Constitution](../architecture/VIBETECH_PLATFORM_CONSTITUTION.md) (how we build / locked contracts)

> Platform Constitution = how we build and what stays locked in code.  
> Product Constitution = what we sell and how it must feel to the owner.

---

## The Product

VIBETech is an AI Operating System for businesses.

Unlike a CRM, chatbot, automation platform, or dashboard, VIBETech becomes the operating layer of a business.

It continuously understands what is happening inside the company, recommends what should happen next, coordinates AI employees and human teammates, asks for approval when required, performs approved work, remembers every outcome, and improves how the business operates over time.

The business owner should never feel like they are using software.

They should feel like they hired an operating team.

---

## The Customer Promise

This is the only product experience we sell.

Everything else is implementation detail.

The experience should always feel like this:

```
Tell us about your business
        ↓
Here is how VIBETech recommends running it
        ↓
Approve
        ↓
Your AI Operating System is live
        ↓
Talk to VIBETech whenever your business changes
```

The owner should never think about Builders, Architects, Mission Control, pipelines, runtimes, installs, stages, or AI infrastructure.

---

## Product Principles

These principles override implementation convenience.

1. **The owner supervises.** They do not configure software.
2. **AI employees operate. Humans approve. AI executes.**
3. **Conversations replace configuration.** If a business owner wonders where to go, the answer should almost always be: Ask VIBETech.
4. **Everything important is explainable.** No black boxes. No magic. Every recommendation should have evidence.
5. **Everything important is approved.** AI never silently changes the business.
6. **Business Memory is the source of truth.** Not prompts. Not temporary state. Not chat history. Memory.
7. **One product.** Never multiple ways to accomplish the same business goal.
8. **Simplicity beats cleverness.** If engineers understand it but owners don’t, the product failed.

---

## The Five Second Test

Home must answer these questions immediately.

1. Is my business okay?
2. What needs me?
3. What is VIBETech doing?
4. What changed today?
5. What should I ask?

If Home cannot answer these within five seconds, it is too complicated.

---

## What Is Locked Forever

The following architecture is constitutional.

It should evolve. It should never be replaced because someone found a “cleaner” idea.

- BusinessGraph
- BusinessSubject
- Business relationships
- Canonical runtime snapshots
- Approval model (candidate → proposal → approval → work → memory)
- Canonical Work
- Canonical Requests
- Business Memory
- Knowledge system
- AI Employee framework
- Employee lifecycle
- Employee capabilities
- Employee validation
- Builder Capability Registry
- Industry Packages
- Workspace isolation
- Permissions
- Portal isolation
- Business Runtime
- Business Intelligence
- Canonical persistence

### Rule

Extend these. Never fork them. Never duplicate them for UI convenience.

---

## AI Employees

AI Employees are coworkers.

Not configuration objects. Not automation rules. Not workflows.

Every AI employee should expose only:

- Responsibilities
- Current work
- What it is waiting for
- Recent outcomes
- Next planned work

The owner should never see:

- Prompt engineering
- JSON
- Capabilities
- Execution graphs
- Pipelines
- Tool calls
- Internal runtime details

---

## Home

Home exists for one reason: to supervise the business.

Not to browse software. Not to view analytics. Not to configure settings.

Home should always feel like: “I opened the office.”  
Not: “I logged into a CRM.”

---

## Ask VIBETech

Ask VIBETech is the primary interface to the operating system.

Everything else is secondary.

The owner should never wonder where to go. The answer should almost always be: Ask VIBETech.

---

## Architect

Architect is not a product. Architect is not a separate application.

Architect is simply VIBETech planning with the owner.

- Before launch: Architect discovers the business.
- After launch: Architect proposes improvements.

The owner should never think: “I’m opening Architect.”  
They should think: “I’m talking to VIBETech.”

### One Architect lifecycle

```
Conversation
    ↓
Discovery
    ↓
Recommendation
    ↓
Approval
    ↓
Installation
    ↓
Live
    ↓
Continuous Improvement
```

One Builder façade. One session model. One install / resume / retry / recovery story.

Persisted session stages map to the platform constitution lifecycle; intelligence pipeline stages are internal only — never owner-facing, never session state.

---

## What Must Disappear

- **Multiple Homes** — One Home. One URL. One experience.
- **Mission Control** — Remains an internal compose layer only. Owners never see that name.
- **Dashboard mentality** — Equal-sized KPI cards, analytics-first layouts, configuration-first UX. Replace with editorial operating supervision.
- **Parallel Builder flows** — One façade. One lifecycle. One install path.
- **Multiple install systems** — One install. One resume. One retry. One recovery story.
- **Demo leakage** — Demo mode is quarantined. Never visible in production.
- **Engineering terminology** in owner UI: Mission Control, Operating Pulse, Digital Workforce, Builder, Launch, Pipeline, DNA, Assembly, Plan Mode.
- **Configuration-first UI** — Owners should not build software. Owners should run businesses.

---

## Things We Never Build

- Another CRM
- Workflow builders
- If/then editors
- Automation canvases
- Prompt editors
- Agent playgrounds
- JSON editors
- Business logic duplicated in UI
- Industry-specific backend forks
- Customer-specific backend forks
- Internal engineering tools exposed as owner features

---

## Current Product Architecture

```
Business Owner
    ↓
Home
    ↓
Pre-install → Business Onboarding
    ↓
Architect Conversation (as VIBETech)
    ↓
AiBuilderService
    ↓
BusinessOSInstaller
    ↓
Canonical Runtime
    ↓
Operating Home
    ↓
Continuous Ask VIBETech
    ↓
Recommendations → Approvals → Work → Business Memory
    ↓
Improved Business
```

This should feel like one seamless experience. Not multiple products.

---

## Execution Roadmap

| Phase | Intent |
|------|--------|
| **1** | One Architect lifecycle |
| **2** | Beautiful product — hired an operating partner, not software |
| **3** | Conversation-first business management; configuration disappears |
| **4** | Living AI Employees — real teammates, not static cards |
| **5** | Business Memory — explainable, searchable, living |
| **6** | Operating Timeline — business story, not activity logs |
| **7** | Business Brain — answers from memory, not guesses |
| **8** | Continuous Recommendations — hiring, automation, optimization, expansion |

**Deferred:** Marketplace, Integrations, Learning, Multi-industry scale-out, Enterprise, Platform APIs.

The operating experience comes first.

---

## Engineering Rules

1. Never redesign stable architecture because it looks cleaner. Architecture changes require correctness, scalability, or product coherence. Code cleanliness alone is never sufficient.
2. Never expose implementation details.
3. Never create parallel systems.
4. Never fork canonical models.
5. Demo stays isolated.
6. Product language always wins over engineering language.
7. One business concept. One implementation. One customer experience.

---

## The North Star

Every decision should be evaluated with one question:

> Does this make VIBETech feel more like an AI Operating System that runs a business alongside its owner, or does it expose the internal machinery behind it?

If it exposes the machinery, it is the wrong direction.
