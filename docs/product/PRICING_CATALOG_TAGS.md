# Pricing sheet commercial tags (live)

**Offer lead (constitution v2):** Customers purchase managed **Revenue Follow-Through** — a managed operating function with a service standard — not seats, CRM modules, AI employees, or a package tour. See [VIBETECH_PRODUCT_CONSTITUTION.md](./VIBETECH_PRODUCT_CONSTITUTION.md) and [Full_Plan.md](./Full_Plan.md).

The **AI Operating System** and installable package IDs below remain the **engine / entitlement plumbing**. Do **not** lead sales, demos, or go-live narrative with the broad catalog. Components (voice, email, scheduling, knowledge, CRM updates) exist to deliver the managed function.

Live Create & invite still reads `sellable: true` packages from [`SalesPackageCatalog.js`](../../backend/core/platform/packages/SalesPackageCatalog.js) until catalog code is narrowed in a later plan. Prefer entitling design partners for the managed RFT path (Essential/Growth managed or the minimum integration set), not à-la-carte module shopping.

**Commercial model:** invoices / payment links outside the app. Entitlements are set at Create & invite. Stripe Checkout is optional scaffolding, not required for production clients.

---

## Primary offer (what we sell)

| Offer | What the customer buys |
|---|---|
| **Managed Revenue Follow-Through** | Service standard + outcomes: detect opportunities, acknowledge, assign, schedule, follow up, chase proposals, update systems, hand off won work, escalate exceptions |
| Essential / Growth managed (legacy SKU ids) | Managed-ops retainer that should map to RFT delivery — not “unfinished product” |

---

## Engine components (installable entitlements — not the lead story)

Use these as delivery components for RFT, not as a menu of separate products.

| Sheet line | packageId | Role under RFT |
|---|---|---|
| AI Business Operating System | `ai_business_os` | **Engine** install base — not the customer-facing SKU name |
| AI Receptionist | `ai_receptionist` | Voice channel component when needed for follow-through |
| Lead qualification / Automated lead follow-up | `lead_follow_up` | Core RFT path component |
| CRM Automation | `crm_automation` | CRM update / capture component |
| AI Sales Assistant | `sales_assistant` | Prep / follow-up support component |
| Website lead capture (forms) | `website_chatbot` | Inbound opportunity detection |
| Scheduling Automation | `scheduling` | Next-step scheduling component |
| Internal Knowledge Base Assistant | `knowledge_assistant` | Company Rules / knowledge component |
| Email Marketing / SMS marketing (campaign-lite) | `email_sms_marketing` | **Frozen for expansion** — not RFT beachhead |
| Basic System Integration | `basic_integration` | Connection / prove infrastructure |
| Priority Support add-on | `addon_priority_support` | Support retainer |

### Managed + Product (legacy sheet)

| Sheet line | packageId | Soft caps |
|---|---|---|
| Essential | `essential_managed` | 3 workers / 5 workflows |
| Growth | `growth_managed` | 8 workers / 15 workflows |

Managed SKUs include a VIBETech managed-ops retainer. Position them as **managed Revenue Follow-Through delivery**, not software bundles.

---

## Roadmap (catalog present, not sellable — freeze expansion)

Voice inbound/outbound/scheduling/support agents, native website chat, social content, marketing content engine, sales analytics, document processing, reporting automation, external CRM, multi-system, Professional/Enterprise managed, most add-ons.

Do not allocate primary development to these while [DEVELOPMENT_FREEZE.md](./DEVELOPMENT_FREEZE.md) is active.

## Human service (not installable)

Discovery & Consulting section (assessments, workshops, hourly). Custom Voice / Custom Managed / Enterprise deployments stay high-touch engagements — early RFT customers are a hybrid AI-and-human service.

## Voice family

See `backend/core/platform/packages/VoiceProductFamily.js`. Only `ai_receptionist` is sellable; inbound/outbound/scheduling/support/custom stay roadmap with prove mission maps.

## Growth roadmap

See `backend/core/platform/packages/GrowthRoadmapRegistry.js`. Native chat, social, content engine, sales analytics, doc ops, reporting, external CRM, multi-system — catalog present, `sellable: false`.

## Usage metering

Commercial meters: `backend/core/platform/billing/UsageMetering.js`.
Owner surface: Settings → Billing & usage.
Ask daily quota is the live spend guard.
Go-live: [`BEACHHEAD_PROVE_CHECKLIST.md`](./BEACHHEAD_PROVE_CHECKLIST.md) + [`DESIGN_PARTNER_RUNBOOK.md`](./DESIGN_PARTNER_RUNBOOK.md).
