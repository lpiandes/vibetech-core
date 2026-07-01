# CompanyDataModel.md

## Definition

`CompanyData` is flexible business memory for employees.

It is **not** a traditional CRM:
- it is not centered on contact management workflows
- it is not required for employee behavior
- it is not the product brain

Instead, `CompanyData` stores the operational records employees need to do work.

## Core principle: records over vendors

Each industry defines record types inside `CompanyData`.
Employees request and use those record types to produce governed outcomes.

## Property Management

Recommended record types:
- `Properties`
  - propertyId
  - address
  - city/state
  - price
  - description
  - highlights[]
  - considerations[]
- `Buyers`
  - buyerId
  - name
  - contact details (email/phone)
- `Owners` (optional)
  - ownerId
  - name
  - contact details
- `Inquiries`
  - inquiryId
  - buyerId (reference)
  - propertyId (reference)
  - message
  - submittedAt
  - status (in-progress → ready → needs review)

## Law Firm

Recommended record types:
- `Clients`
- `Matters`
- `Cases`
- `Documents`

Operational relationships:
- client ↔ matters
- matter ↔ cases
- case ↔ documents

## Dentist

Recommended record types:
- `Patients`
- `Appointments`
- `Treatments`
- `Insurance` (optional, if coverage affects next steps)

Operational relationships:
- patient ↔ appointments
- appointment ↔ treatments

## Med Spa

Recommended record types:
- `Clients`
- `Treatments`
- `Memberships`
- `Consultations`

Operational relationships:
- client ↔ consultations
- consultation ↔ recommended treatments
- membership ↔ recurring services

## Important boundary

CompanyData is the business memory Digital Employees use to do work:
- clarity (human meaning)
- stable mapping into employee tasks
- auditability of review-ready outcomes

CompanyData should not mirror vendor-native schemas.

# CompanyDataModel.md

## Definition

`CompanyData` is flexible business memory for employees.

It is **not** a traditional CRM:
- it is not centered on contact management workflows
- it is not required for employee behavior
- it is not the product’s brain

Instead, `CompanyData` stores the operational records employees need to do work.

## Core principle: records, not vendors

Each industry defines record types inside `CompanyData`.
Employees request the records they need via capability-driven intent.

## Property Management

Recommended business record types:
- `Properties`
  - propertyId
  - address
  - city/state
  - price
  - description
  - highlights[]
  - considerations[]
- `Buyers`
  - buyerId
  - name
  - contact details (email/phone)
- `Owners`
  - ownerId
  - name
  - contact details
- `Inquiries`
  - inquiryId
  - buyerId (reference)
  - propertyId (reference)
  - message
  - submittedAt
  - status (in-progress → ready → needs review)

## Law Firm

Recommended business record types:
- `Clients`
- `Matters`
- `Cases`
- `Documents`

Operational relationships:
- client ↔ matters
- matter ↔ cases
- case ↔ documents

## Dentist

Recommended business record types:
- `Patients`
- `Appointments`
- `Treatments`

Operational relationships:
- patient ↔ appointments
- appointment ↔ treatments

Insurance-related records:
- `Insurance`
  - provider + coverage details needed for approvals and next steps

## Med Spa

Recommended business record types:
- `Clients`
- `Treatments`
- `Memberships`
- `Consultations`

Operational relationships:
- client ↔ consultations
- consultation ↔ recommended treatments
- membership ↔ recurring services

## Important boundary: CompanyData is business memory

CompanyData should be designed for:
- clarity (human meaning)
- stable mapping into employee workflows
- auditability of review-ready outcomes

CompanyData should not be designed for:
- vendor-native schema mirroring
- re-implementing every CRM feature

