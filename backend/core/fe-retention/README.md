# FE Retention CRM

Self-serve at `/insurance` as **VibeKeep**. Agents sign up, pay $200/month on Stripe, and use `/insurance/:businessId`. Admins do **not** assign this SKU from package checkboxes. Admins open any book at `/admin/insurance` — same UI as the agent.

| File | Role |
| --- | --- |
| `FeRetentionBilling.js` | $200/mo Stripe Checkout, portal, webhook → `packageConfiguration.feRetentionBilling` |
| `provisionFeRetentionAccount.js` | Signup: user + OWNER membership + incomplete billing + installation |
| `feRetentionEntitlement.js` | Which books a login can open; next-path (dashboard vs paywall vs admin) |
| `FeRetentionStore.js` | Client book state on the OS installation |
| `FeRetentionNeedsAttention.js` | Today queue |
| `FeRetentionSms.js` | Every signed book buys a dedicated From-number. `TWILIO_MESSAGING_FROM` only texts the operator |
| `FeRetentionInbound.js` | Twilio inbound + STOP |
| `runHostedFeRetentionSweep.js` | Hosted daily tick |
| `ensureFeRetentionInstallation.js` | Minimal OS row so agents skip Architect |

Frontend: `frontend/app/insurance/*`, `frontend/components/insurance/*`, `frontend/lib/platform/feRetentionAccess.ts`.
Webhook: `POST /api/billing/stripe/webhook`.
