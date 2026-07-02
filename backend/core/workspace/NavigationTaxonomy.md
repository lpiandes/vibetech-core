# Workspace Navigation Taxonomy (Permanent)

This document defines the business-owner mental model used for VIBETech primary navigation.

## Business mental model

Owners do not browse by implementation domains (e.g., “communications” vs “operations”).
They browse by what they need to manage:

- Mission Control
- Team
- Work
- Knowledge
- Company
- Analytics
- Settings

## Why Communications moved into Work

Communications requiring attention behaves like work to be triaged, reviewed, and approved.
Therefore it belongs under **Work**, not as a separate top-level destination.

## Why Operations disappeared

"Operations" in this platform is the operational execution surface.
In the owner mental model, execution is expressed as **Work**.
Therefore "Operations" is removed from primary navigation.

## Why Team is broader than Digital Workforce

Team includes Digital Employees, humans, and future org-capacity concepts.
Digital Workforce is one technical slice; Team is the owner destination.

## Future module placement rules

Future modules should naturally fit into these destinations:

- HR → Team
- CRM → Work
- Approvals → Work
- Invoices → Company
- Compliance → Company
- Training → Knowledge
- Playbooks → Knowledge
- Forecasts → Analytics

## Determinism + generation rules

- Navigation is always generated from Workspace Configuration and module registry placement.
- No industry-specific language leaks into navigation destinations.
- No hardcoded destination lists in renderers; the taxonomy is the stable source.

