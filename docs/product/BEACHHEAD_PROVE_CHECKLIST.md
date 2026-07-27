# Production client go-live checklist

Use this for every new paying client before go-live. **Owner-led prove** in Launch Center. Platform support is break-glass only (failed installs, Trust Hub env, A2P rejection).

## Pre-flight (platform)

- [ ] Hosted app healthy: `GET /api/health` → `status: "healthy"`, `ok: true`, `database`, `jobsSchema`, `worker` all `ok` (HTTP 200 — worker is required in production)
- [ ] Migrations applied through `017_ai_ask_quota.sql` (`npm run db:migrate`)
- [ ] Durable worker running (`npm run worker`) **and** cron tick every 1–2 min with `CRON_SECRET` as HA backup
- [ ] Production gates green: `PILOT_BASE_URL=https://YOUR_HOST npm run pilot:gates`
- [ ] Twilio Trust Hub env set for auto A2P: `TWILIO_A2P_CUSTOMER_PROFILE_SID`, `TWILIO_A2P_PROFILE_BUNDLE_SID`
- [ ] `PLATFORM_OPERATOR_EMAIL` set for exception alerts (failed install / Trust Hub / A2P fail)
- [ ] Disk / deploy headroom OK

## Create & invite

- [ ] Admin → Create business with **only purchased packages** checked (honesty labels shown)
- [ ] Owner invite delivered; owner can sign in
- [ ] Ask / Architect completes for purchased packages

## Per purchased package — owner prove

| Package | Prove |
|---|---|
| AI Business OS | Launch Center missions for vertical |
| AI Receptionist | Connect Twilio Voice → Launch voice prove (live call) |
| Lead follow-up | Forms prove and/or Meta webhook lead; draft email/SMS in Needs you |
| CRM automation | People + pipeline card from form or Run now |
| Scheduling | Google Calendar connect + prove create event; reminder jobs queued |
| Knowledge assistant | Upload doc → Knowledge consult prove |
| Website form capture | Hosted `/intake` or embed → People contact |
| Email/SMS marketing | Gmail + Twilio SMS connect; Campaigns template + approve-first send prove |
| Essential / Growth managed | All Launch missions on that SKU prove green |
| Basic integration | At least one of email / calendar / SMS connected + proved |

## Honesty gates (do not skip)

- [ ] Outbound email/SMS/voice customer sends require owner GRANT (or explicit Auto on that step)
- [ ] Website “chatbot” sold as **form capture** until native chat ships
- [ ] Receptionist books create **appointment Work** (team confirms) — not silent calendar invent
- [ ] No PHI dental fields
- [ ] Connected ≠ proven — Launch prove recorded
- [ ] A2P carrier Approved before promising US SMS delivery

## Handoff

- [ ] Owner knows Home → Needs you for drafts/approvals
- [ ] Owner knows Automations Manual vs Auto
- [ ] `/admin/health` shows worker ok after 2 minutes
- [ ] Support enter/exit tested once for this business
- [ ] Admin “Platform exceptions” queue is empty (or only carrier-wait items that are owner-visible, not queued)
