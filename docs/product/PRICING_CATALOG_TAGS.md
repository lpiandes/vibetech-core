# Pricing sheet commercial tags (live)

**Offer lead:** Customers purchase managed **Revenue Follow-Through** and Wave A sellable packages — not seats/CRM modules as the lead story.

Live Create & invite reads `listSellableSalesPackagesForAdmin()` from [`SalesPackageCatalog.js`](../../backend/core/platform/packages/SalesPackageCatalog.js).

Full sheet classification (Ready / Custom / Consulting / Managed / Usage): [`COMMERCIAL_OFFER_MATRIX.md`](./COMMERCIAL_OFFER_MATRIX.md).

---

## Wave A sellable (Create & invite)

| Offer | packageId |
|---|---|
| Managed Revenue Follow-Through | `managed_revenue_follow_through` |
| AI Receptionist | `ai_receptionist` |
| Lead qualification / Automated lead follow-up | `lead_follow_up` |
| Website lead capture (forms) | `website_chatbot` |
| Knowledge assistant | `knowledge_assistant` |
| Basic System Integration | `basic_integration` |

---

## Engine / custom build (not Create & invite default)

Other catalog IDs remain entitleable via admin and Custom Build Factory. See Offer Matrix.

## Usage metering

`backend/core/platform/billing/UsageMetering.js` + Settings → Billing & usage.
Ask quota also increments `ai_work_credits`.
SMS sends (missed-call path) increment `sms_segments`.

## Go-live

[`BEACHHEAD_PROVE_CHECKLIST.md`](./BEACHHEAD_PROVE_CHECKLIST.md) + [`DESIGN_PARTNER_RUNBOOK.md`](./DESIGN_PARTNER_RUNBOOK.md).
Set `TWILIO_A2P_ENFORCE=1` to hard-block SMS offers until Trust Hub Approved.
