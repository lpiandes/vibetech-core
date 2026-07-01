# CompanyModel.md

## Definition

`Company` is the operating container for Digital Employees.

A company contains:
- `identity`
- `industry`
- `employees`
- `knowledge`
- `companyData`
- `policies`
- `integrations`
- `approvalRules`

## Why this model exists

The architecture bible emphasizes stable contracts and separation of responsibilities:
- employees define **business intent**
- the platform orchestrates execution and governance
- integrations are pluggable tools

`Company` is the place where business context lives, so Digital Employees can behave correctly without vendor coupling.

## Core fields

### 1) Identity
- companyName
- brandName (optional)
- locale/timezone (optional)
- unique companyId (internal identifier)

### 2) Industry
- industryId (e.g., `property-management`, `law-firm`, `dentist`, `med-spa`, `hvac`, `roofing`)
- industryTemplateId (the starter template selected for onboarding)

### 3) Employees
- employee roster (which Digital Employees are active)
- employee configuration per company (coverage, preferred working rules, enabled workflows)

### 4) Knowledge
Company knowledge is the reusable guidance set for the company:
- FAQs
- policies (business-level guidance that employees use)
- templates (message structures, reply formats, scripts)
- listings/service info/pricing
- brand voice and writing preferences
- scripts and preferences

### 5) Company Data
Flexible business records used by employees as business memory.
This is **not** a traditional CRM.
It stores operational records (inquiries, properties, clients, appointments, etc.).

### 6) Policies
Policies define behavioral constraints at the company level:
- response policies (when to respond, tone, required confirmations)
- privacy/redaction expectations
- escalation rules

### 7) Integrations (optional tools)
Integrations are optional interfaces to external systems:
- website intake
- email delivery
- calendar scheduling
- CRM provider (optional)
- phone service
- document systems
- payments providers

Integrations provide signals and transport, but they do not become the brain.

### 8) Approval Rules
Approval Rules define governance requirements for high-impact operations:
- which actions require human review
- what labels and statuses appear during governance
- how completion is recorded (for audit)

These rules ensure humans stay in control.

