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

- **58 complete / 1 building** of 59 sheet lines (Executive Dashboard remains building)
- Wave B/C productized: sales assistant, CRM automation, scheduling, native chat, outbound voice campaigns, HubSpot/HighLevel sync, social/marketing content, document extract, sales analytics/reporting, Professional/Enterprise, add-on soft-cap metering, Outlook Graph adapters
- **Create & invite** includes Wave A/B/C sellable products + managed packages (RFT first)
- **Custom Build Factory:** prove step reads `capability_proof_records`; go-live blocked without mission evidence
- **Usage:** Settings meters hydrate from `installation.configuration.usageMeters`
- Scorecard tests: `commercialScorecard.test.js`
