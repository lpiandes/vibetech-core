# IntegrationModel.md

## Definition

`Integrations` are optional tools that connect a company to external systems.

Integrations are intentionally not the center of the product.
They should provide:
- intake signals (e.g., a website inquiry event)
- delivery channels (e.g., email)
- convenience for managing operational records (optional)

## Integration categories

Common optional integrations:
- `Website` (new inquiries, scheduling requests)
- `Email` (sending responses)
- `Calendar` (walkthrough scheduling)
- `CRM` (optional provider for contact history)
- `Phone` (call intake support)
- `Documents` (document storage or sending)
- `Payments` (optional for certain industries)

## Vendor independence requirement

Employees must never depend on:
- a specific vendor schema
- a specific vendor workflow

Instead, employees depend on:
- `Company Data` record types
- `Company Knowledge` language and templates
- `Policies` + `Approval Rules`

Integrations only map between:
1) external tool payloads
2) company business memory + approved knowledge

## CRM integration patterns (optional)

CRM provider may be:
- none
- GoHighLevel
- HubSpot
- Salesforce
- custom

If CRM is present, it can:
- import contacts
- store conversation history
- provide a convenient UI for owners

But employee behavior should still work without CRM:
- inquiry can come from website
- records can live in company data
- governed review can happen regardless of CRM availability

