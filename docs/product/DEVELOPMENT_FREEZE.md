# Development freeze — pilot operations

**Status:** Active for design-partner pilots.  
**Last updated:** 2026-08-05  
**Purpose:** Stop expanding the imagined product. Operate the real service. Let production exceptions determine every subsequent engineering priority.  
**Quality:** Any allowed change must pass [ENGINEERING_SHIP_BAR.md](./ENGINEERING_SHIP_BAR.md).

Plans 1–18 (product shape) are complete. This freeze replaces the earlier “build Batch A–D” continue list.

---

## Allowed now (only)

| Category | Examples |
|---|---|
| **Security issues** | Authz bypass, tenant leakage, credential exposure |
| **Data-loss risks** | Silent clobber of install config, missing durability |
| **Incorrect external actions** | Sends before go-live, outbound without approval/autonomy gate, fake proof → Verified |
| **Pilot-blocking integration failures** | Real Gmail/Calendar/forms/CRM prove or inbound broken for a partner |
| **Operator-console blockers** | Cannot detect, take over, classify, or link interventions to traces |
| **Missing trace or evidence records** | Consequential actions without provider proof / audit |

Everything else → [POST_PILOT_BACKLOG.md](./POST_PILOT_BACKLOG.md).

---

## Pause (do not start)

- New features, surfaces, verticals, marketplace, campaigns/ads
- CRM parity, automation builders, AI-employee theater
- Broad analytics not required for the weekly pilot scorecard
- Cosmetic empty-state work
- Expanding autonomy globally
- “Nice to have” polish that does not unblock a live partner

---

## Operating rule

1. Run partners **sequentially** — see [DESIGN_PARTNER_SEQUENCE.md](./DESIGN_PARTNER_SEQUENCE.md).  
2. Never claim completed / verified outcomes without provider-backed evidence.  
3. Never hardcode partner names, demo prospects, or fake provider IDs into production prove/live paths.  
4. Operator interventions must record human minutes and root cause — never silently rescue without a ledger entry.  
5. If unclear: *Does this unblock a live partner safely?* If no → backlog.

---

## How agents and humans must work

1. Read this file before coding.  
2. If the change is not in the Allowed table → do not build it.  
3. Prefer fixing honesty/safety over adding UI.  
4. Test before claiming ready.
