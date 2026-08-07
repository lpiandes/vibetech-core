# Commercial Offer Matrix (live)

Every pricing-sheet line is classified and gated by code:

- Matrix: [`backend/core/platform/commercial/CommercialOfferMatrix.js`](../../backend/core/platform/commercial/CommercialOfferMatrix.js)
- Playbooks: [`backend/core/platform/commercial/DeliveryPlaybookRegistry.js`](../../backend/core/platform/commercial/DeliveryPlaybookRegistry.js)
- Sell gate: [`backend/core/platform/commercial/CanSellOffer.js`](../../backend/core/platform/commercial/CanSellOffer.js)
- Custom Build Factory: [`backend/core/platform/commercial/CustomBuildFactory.js`](../../backend/core/platform/commercial/CustomBuildFactory.js)
- Admin UI: `/admin/offers`
- Business UI: Today → Custom Build Factory (non-RFT)
- API: `GET /api/admin/commercial-offers`, `GET|POST /api/businesses/:id/custom-build`

## Offer classes

| Class | Meaning |
|---|---|
| `ready` | Turnkey product with prove + go-live (Managed RFT) |
| `custom_build` | Delivered via Custom Build Factory + playbook |
| `consulting` | Human SOW; platform used as evidence tool |
| `managed_ops` | Entitlements + human retainer SLA |
| `usage` | Metered commercial usage |

## Rule

`canSellOffer` allows a line only when `implementationStatus === complete` and its playbook is complete. Incomplete paths cannot be sold.

## Honesty status (2026-08-07)

- **43 complete / 15 building** of 58 sheet lines
- **Building (not sellable):** outbound voice, social/content engines, sales analytics, document processing, reporting automation, external CRM sync, multi-system, Professional/Enterprise managed, additional-agent/workflow/integration add-ons, executive dashboard
- **Create & invite sellable:** Managed RFT + Wave A SKUs + Essential/Growth managed
- **Custom Build Factory:** prove step reads `capability_proof_records`; go-live blocked without mission evidence
- **Usage:** Settings meters hydrate from `installation.configuration.usageMeters` (durable across restarts)
- Scorecard tests: `commercialScorecard.test.js`
