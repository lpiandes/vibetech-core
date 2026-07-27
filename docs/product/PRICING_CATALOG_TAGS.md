# Pricing sheet commercial tags (live)

Live Create & invite only offers `sellable: true` packages from [`SalesPackageCatalog.js`](../../backend/core/platform/packages/SalesPackageCatalog.js).

**Commercial model:** invoices / payment links outside the app. Entitlements are set at Create & invite. Stripe Checkout is optional scaffolding, not required for production clients.

## Product (installable)

| Sheet line | packageId |
|---|---|
| AI Business Operating System | `ai_business_os` |
| AI Receptionist | `ai_receptionist` |
| Lead qualification / Automated lead follow-up | `lead_follow_up` |
| CRM Automation | `crm_automation` |
| AI Sales Assistant | `sales_assistant` |
| Website lead capture (forms) | `website_chatbot` |
| Scheduling Automation | `scheduling` |
| Internal Knowledge Base Assistant | `knowledge_assistant` |
| Email Marketing / SMS marketing (campaign-lite) | `email_sms_marketing` |
| Workflow Automation | covered by specialty paths on Full OS / Growth |
| Basic System Integration | `basic_integration` |
| Priority Support add-on | `addon_priority_support` |

## Managed + Product

| Sheet line | packageId | Soft caps |
|---|---|---|
| Essential | `essential_managed` | 3 workers / 5 workflows |
| Growth | `growth_managed` | 8 workers / 15 workflows |

Managed SKUs include a VIBETech managed-ops retainer (not “unfinished product”).

## Roadmap (catalog present, not sellable)

Voice inbound/outbound/scheduling/support agents, native website chat, social content, marketing content engine, sales analytics, document processing, reporting automation, external CRM, multi-system, Professional/Enterprise managed, most add-ons.

## Human service (not installable)

Discovery & Consulting section (assessments, workshops, hourly). Custom Voice / Custom Managed / Enterprise deployments stay high-touch engagements.

## Voice family

See `backend/core/platform/packages/VoiceProductFamily.js`. Only `ai_receptionist` is sellable; inbound/outbound/scheduling/support/custom stay roadmap with prove mission maps.

## Growth roadmap

See `backend/core/platform/packages/GrowthRoadmapRegistry.js`. Native chat, social, content engine, sales analytics, doc ops, reporting, external CRM, multi-system — catalog present, `sellable: false`.

## Usage metering

Commercial meters: `backend/core/platform/billing/UsageMetering.js`.
Owner surface: Settings → Billing & usage.
Ask daily quota is the live spend guard.
Go-live: [`BEACHHEAD_PROVE_CHECKLIST.md`](./BEACHHEAD_PROVE_CHECKLIST.md) + [`DESIGN_PARTNER_RUNBOOK.md`](./DESIGN_PARTNER_RUNBOOK.md) (production client runbook).
