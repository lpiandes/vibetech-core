# Property Interest Coordinator (Local Employee)

## Mission

When a buyer submits a property inquiry, this Digital Employee immediately:
1. Recognizes new inquiry work
2. Understands the property details
3. Prepares a recommendation (business language)
4. Drafts a buyer response
5. Creates a review task for governance

The goal is workforce clarity: the user receives a review-ready output that reads like a professional next step, not software configuration.

## Inputs

```js
{
  inquiry: {
    name,
    email,
    phone,
    message,
    submittedAt
  },
  property: {
    propertyId,
    address,
    city,
    state,
    price,
    description,
    highlights[],
    considerations[]
  },
  companyContext: {
    companyName,
    officeName,
    responsePolicy
  }
}
```

## Outputs

```js
{
  reviewWork, // ReviewWorkResponse business contract
  employeeSummary: {
    employeeName,
    mission,
    recommendedAction,
    confidence
  }
}
```

Where:
- `reviewWork` is produced by the existing `ReviewWorkViewAdapter` (contract-compliant business shape).
- `employeeSummary` is a lightweight workforce-facing summary generated locally and deterministically.

## How this fits Digital Workforce architecture

This employee is a self-contained capability unit:
- it accepts business input (`inquiry`, `property`, `companyContext`)
- it generates a business recommendation and a governance-ready attorney note
- it uses existing orchestration primitives to generate a draft and wrap it into a `ReviewWorkResponse`

## Future integrations (what will wrap this employee)

Later, website/CRM/email systems will “surround” this employee:
- A website or CRM will forward a new inquiry payload into this employee.
- An email/transport layer will send the approved buyer response after governance completes.

None of those integrations change the responsibilities of this employee:
- the employee decides what needs review and how to frame next steps
- the workflow + adapters provide the contract-shaped review output

## Local-only sprint constraints

This sprint is LOCAL ONLY:
- no networking
- no APIs
- no persistence
- no email sending

