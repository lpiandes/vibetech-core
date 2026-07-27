# Production client runbook

How to onboard a **paying client** end-to-end. Owner completes Launch prove. Platform humans only for break-glass exceptions (failed install, missing Trust Hub env, A2P rejection).

Invoices / payment links are handled **outside** the app (your Stripe/invoice process). Package entitlements are set at Create & invite.

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
2. Check **only** packages they bought (sellable catalog)  
3. Invite owner email  
4. Owner signs in and finishes Ask  

## 3. Owner go-live (Launch Center)

Owner connects channels they purchased and runs each prove:

- Email → send test  
- Calendar → create test event  
- SMS → brand form → wait Approved → send test  
- Voice → Twilio webhook → prove call  
- Meta → webhook → ingest test lead  
- Forms / Campaigns as purchased  

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

Sellable packages in `SalesPackageCatalog` with `sellable: true`. Roadmap packages stay off the create modal.

Honesty that stays true in production:

- Outbound is approve-first unless they turn Auto on that step  
- Receptionist booking → Work + calendar HOLD (team confirms)  
- “Website chatbot” = form capture until native chat ships  
- Managed Essential/Growth include a managed-ops retainer  

## 6. Done when

- Launch proves green for purchased channels  
- Worker healthy on `/admin/health`  
- Platform exceptions empty  
- Owner can run Needs you + Automations without you in the loop  

Break-glass support enter remains available; it is not the default go-live path.
