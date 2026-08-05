# Production client go-live checklist

Use this for every new paying client before go-live.

**What we are proving:** managed **Revenue Follow-Through** — not a package tour. Owner-led prove that opportunities can be detected, acted on, and verified with evidence. Platform support is break-glass only (failed installs, Trust Hub env, A2P rejection).

See [VIBETECH_PRODUCT_CONSTITUTION.md](./VIBETECH_PRODUCT_CONSTITUTION.md) · [Full_Plan.md](./Full_Plan.md) · [DEVELOPMENT_FREEZE.md](./DEVELOPMENT_FREEZE.md).

## Pre-flight (platform)

- [ ] Hosted app healthy: `GET /api/health` → `status: "healthy"`, `ok: true`, `database`, `jobsSchema`, `worker` all `ok` (HTTP 200 — worker is required in production)
- [ ] Migrations applied through `017_ai_ask_quota.sql` (`npm run db:migrate`)
- [ ] Durable worker running (`npm run worker`) **and** cron tick every 1–2 min with `CRON_SECRET` as HA backup
- [ ] Production gates green: `PILOT_BASE_URL=https://YOUR_HOST npm run pilot:gates`
- [ ] Twilio Trust Hub env set for auto A2P: `TWILIO_A2P_CUSTOMER_PROFILE_SID`, `TWILIO_A2P_PROFILE_BUNDLE_SID`
- [ ] `PLATFORM_OPERATOR_EMAIL` set for exception alerts (failed install / Trust Hub / A2P fail)
- [ ] Disk / deploy headroom OK

## Create & invite

- [ ] Admin → Create business entitled for **Managed Revenue Follow-Through** delivery (prefer Essential/Growth managed or the minimum RFT integration set — not à-la-carte module shopping)
- [ ] Owner invite delivered; owner can sign in
- [ ] Ask / discovery completes toward an **Operating Contract** framing (not a workspace tour)

## Revenue Follow-Through prove (primary)

Prove one complete operating outcome path when available via **RFT Launch Path** on Today (connect → observe → replay → go live).

- [ ] Email and/or calendar connected **and tested**
- [ ] Lead system connected (forms webhook, Meta, CRM, or inbox) **and tested**
- [ ] At least one real or controlled opportunity: detected → acknowledged or drafted → assigned or scheduled → CRM/source updated as applicable
- [ ] Owner can clear judgment items from **Decisions** (`/b/.../intelligence`) — Approve/Reject with evidence
- [ ] **Connected ≠ proven** — prove records exist; no fabricated “Succeeded” without provider IDs
- [ ] **Outcomes completed** counts require provider evidence — unproven rows stay excluded

## Engine components (only if entitled — not the lead checklist)

| Component (legacy package) | Prove when needed for RFT |
|---|---|
| AI Business OS (`ai_business_os`) | Engine base / vertical install — **not** sold as the product name |
| AI Receptionist | Twilio Voice → live call prove when voice is in the contract |
| Lead follow-up | Forms/Meta lead → draft email/SMS in Needs you |
| CRM automation | People + pipeline/card from form or Run now |
| Scheduling | Calendar connect + prove create event |
| Knowledge assistant | Upload doc → consult prove (feeds Company Rules later) |
| Website form capture | Hosted `/intake` or embed → contact captured |
| Email/SMS marketing | **Frozen for beachhead expansion** — skip unless already contracted |
| Essential / Growth managed | Managed retainer path; all RFT-relevant proves green |
| Basic integration | At least one of email / calendar / SMS connected + proved |

## Honesty gates (do not skip)

- [ ] Outbound email/SMS/voice customer sends require owner GRANT (or explicit Auto on that step)
- [ ] Website “chatbot” sold as **form capture** until native chat ships
- [ ] Receptionist books create **appointment Work** (team confirms) — not silent calendar invent
- [ ] No PHI dental fields
- [ ] Connected ≠ proven — Launch prove recorded
- [ ] A2P carrier Approved before promising US SMS delivery
- [ ] Do not claim the system “learns” without using **Company Rules → Governed learning** (Plan 10 — shipped)
- [ ] Earned autonomy changes require **Company Rules → Earned autonomy** gates (Plan 11 — shipped)
- [ ] Operator patterns review at `/admin/patterns` when tuning delivery moat (Plan 12 — shipped)

## Handoff

- [ ] Owner knows Today / Home → **Decisions** for drafts/approvals (not legacy Attention-only paths)
- [ ] Owner knows **Company Rules** for governed learning and earned autonomy
- [ ] Owner knows Automations Manual vs Auto (earned autonomy gates when eligible)
- [ ] `/admin/health` shows worker ok after 2 minutes
- [ ] Support enter/exit tested once for this business
- [ ] Admin “Platform exceptions” queue is empty (or only carrier-wait items that are owner-visible, not queued)
- [ ] Owner understands VIBETech owns follow-through ops; they own sales judgment and relationships
