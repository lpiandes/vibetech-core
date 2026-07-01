# Website Intake Adapter (Property Interest Coordinator)

## Purpose

This adapter demonstrates how a **website intake payload** can enter VIBETech (locally) and be transformed into the **existing Property Interest Coordinator** input.

The adapter keeps “website concerns” outside the employee itself:
- it validates and normalizes website-submitted inquiry fields
- it reshapes the payload into the employee’s stable input contract
- it delegates business execution to the employee

## Responsibilities

### Responsibilities (what this adapter does)
- Accept:

```js
{
  inquiry,
  property,
  companyContext
}
```

- Validate required fields
- Normalize the inquiry into the exact input shape expected by:
  `backend/core/employees/property-interest-coordinator/PropertyInterestCoordinator.js`
- Call the existing `PropertyInterestCoordinator`
- Return:

```js
{
  employeeSummary,
  reviewWork
}
```

### Explicit non-goals
- No CRM integration
- No email sending
- No networking
- No HTTP APIs
- No persistence

## Future wrappers
- Website
- CRM
- Email

Each wrapper can use the same pattern:
1. Convert its source payload into the employee’s stable input contract
2. Delegate to the employee

This separation ensures the employee remains industry-logic and workforce-responsibility focused, while adapters evolve independently as input sources change.

