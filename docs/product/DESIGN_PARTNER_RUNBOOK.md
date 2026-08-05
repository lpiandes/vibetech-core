# Production client runbook

How to onboard a **paying client** end-to-end for managed **Revenue Follow-Through**.

**Canonical sequence (required):** [DESIGN_PARTNER_SEQUENCE.md](./DESIGN_PARTNER_SEQUENCE.md)  
**Freeze:** [DEVELOPMENT_FREEZE.md](./DEVELOPMENT_FREEZE.md) — only security, data-loss, incorrect externals, pilot-blocking integrations, operator blockers, missing evidence.  
**Backlog:** [POST_PILOT_BACKLOG.md](./POST_PILOT_BACKLOG.md)

Owner completes channel prove / Launch prove. Platform humans only for break-glass exceptions (failed install, missing Trust Hub env, A2P rejection). Early customers are a **hybrid AI-and-human service** — VIBETech remains responsible for the operating result.

Invoices / payment links are handled **outside** the app. Entitlements are set at Create & invite.

Authoritative product boundary: [VIBETECH_PRODUCT_CONSTITUTION.md](./VIBETECH_PRODUCT_CONSTITUTION.md) · Roadmap: [Full_Plan.md](./Full_Plan.md).

Run partners **sequentially**. Partner one exposes foundational problems before partners two and three.

---

## 0. Before connecting anything

Document the RFT responsibility fields on launch confirm / Company Rules (see sequence doc). Go-live is blocked until complete.

## 1. Platform must be green first

1. `GET /api/health` → `ok: true`, `status: "healthy"`, worker + jobs schema ok  
2. Worker process running continuously  
3. Trust Hub SIDs set so A2P auto-submits  
4. Operator email set for exception alerts  

Commands:

```bash
PILOT_BASE_URL=https://YOUR_HOST npm run pilot:gates
npm run onboard:check   # local/staging with same health bar
```

## 2. Create the business

1. `/platform` or Admin → Create business  
2. Entitle for **Managed Revenue Follow-Through** delivery (prefer Essential/Growth managed or the minimum RFT integration set). Do **not** lead with à-la-carte module shopping or “AI Business OS” as the product name — OS packages are engine entitlements.  
3. Invite owner email  
4. Owner signs in and finishes Ask / discovery toward an **Operating Contract** (not a workspace tour)  

## 3. Owner go-live (prove the function)

Owner connects channels required for follow-through and runs each prove:

- Email → send test  
- Calendar → create test event  
- SMS → brand form → wait Approved → send test (only if SMS is in the contract)  
- Voice → Twilio webhook → prove call (only if voice is in the contract)  
- Meta → webhook → ingest test lead  
- Forms as needed for inbound detection  

Prefer proving **one real opportunity end-to-end** over touring every module. Campaigns/ads expansion is frozen for beachhead.

Do **not** mark A2P complete manually unless Twilio already shows Approved.

## 4. When Admin “Platform exceptions” fires

| Exception | Action |
|---|---|
| Trust Hub missing | Set `TWILIO_A2P_*` env once; restart; owner re-submits A2P |
| Brand incomplete | Owner finishes legal name + EIN in Integrations |
| A2P failed | Fix brand fields to match EIN letter; re-submit; refresh status |
| Install failed/partial | Support enter → inspect checkpoints → re-run install |

Happy-path **carrier pending** (brand submitted, Trust Hub OK) is **not** a platform queue item — owner waits in Integrations.

## 5. What you can honestly sell today

**Lead offer:** Managed Revenue Follow-Through for B2B service businesses (see constitution ownership boundary).

Entitlement plumbing may still use `sellable: true` rows in `SalesPackageCatalog`. Roadmap packages stay off the create modal. Do not expand the catalog while [DEVELOPMENT_FREEZE.md](./DEVELOPMENT_FREEZE.md) is active.

Honesty that stays true in production:

- Outbound is approve-first unless earned autonomy grants Auto on that step (**Company Rules → Earned autonomy**)  
- Live external execution only after go-live; pre-go-live traffic is shadow  
- Receptionist booking → Work + calendar HOLD (team confirms)  
- “Website chatbot” = form capture until native chat ships  
- Managed Essential/Growth / **Managed Revenue Follow-Through** = managed-ops retainer delivering RFT — not unfinished software  
- Connected ≠ proven  
- Governed learning is live at **Company Rules** — corrections feed the loop after owner confirm  
- **Outcomes completed** requires provider evidence — unproven rows are excluded from counts  
- Demo/fixture paths must not claim completed Outcomes without provider IDs  
- Operator rescues are logged in the human-time ledger and shown separately from automatic completions on the pilot scorecard  

## 6. Done when

- RFT responsibility fields confirmed (launch gate)  
- RFT-relevant proves green (email/calendar/lead path as contracted) with real provider ids  
- Observe → replay → shadow → prove → go live completed in order  
- Worker healthy on `/admin/health`  
- Platform exceptions empty  
- Owner can run **Decisions** (`/b/.../intelligence`) without you in the loop for routine approvals  
- Operator can close cases with root cause + minutes on `/admin` operator console  
- Weekly pilot scorecard shows automatic vs operator-rescued separately  
- Owner can confirm Ask operating drafts (SLA changes, reassign) from Architect with learning capture  
- **Outcomes** shows proof metrics or honest `not_observable` — failed sends escalate to Exception, not completed  
- Owner understands: VIBETech owns follow-through ops; they own sales judgment and relationships  

Break-glass support enter remains available; it is not the default go-live path.
