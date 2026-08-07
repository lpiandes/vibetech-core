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
