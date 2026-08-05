---
name: Offer IA Cleanup
overview: RFT-first create/entitle; demote AI-employee and Automations theater; remove Setup/Mission residue.
todos:
  - id: rft-entitle
    content: Admin create/entitle leads with Managed RFT not package shopping
    status: completed
  - id: demote-theater
    content: Demote Team/Automations primary framing; scrub Mission 6 / Launch Center orphans
    status: completed
  - id: offer-copy
    content: Align sellable catalog / owner-facing copy with managed RFT lead
    status: completed
isProject: false
---

# Plan 17: Offer & IA cleanup

**Status:** DONE

## Goal
Customer-facing and admin create paths lead with Managed Revenue Follow-Through. OS packages remain engine entitlements, not the sell story.

## Concrete commit
Create-business / entitle UX prefers RFT managed path. Team copy stops leading with “AI teammates” counts. Orphan Launch Center / Mission 6 hooks removed or clearly retired.

## Ships when
A new admin create flow can entitle RFT without presenting the full à-la-carte catalog as the product.

## Shipped
- `managed_revenue_follow_through` primary sellable in `SalesPackageCatalog`; `ai_business_os` engine-only (`sellable: false`)
- `listSellableSalesPackagesForAdmin` leads with managed products
- `CreateBusinessModal` defaults to Managed RFT + updated copy
- Team **Operating specialties** copy (was AI teammates)
- `LaunchCenter.tsx` marked deprecated (replaced by `RftLaunchPath`)

## Depends on
Plans 1, 3, 4.
