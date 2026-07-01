# Employee Dispatcher

## What it is
`EmployeeDispatcher` routes `CompanyEvent`s to the correct **Digital Employee**.

It does *not* change company state. Company state changes only through:
- `CompanyEventEngine` (via `CompanyWorkspaceRuntime.applyEvent(event)`)

## Responsibilities
`EmployeeDispatcher`:
1. Receives a `CompanyEvent`.
2. Determines which Digital Employee should handle it.
3. Calls the employee with the correct business input.
4. Returns the employee-facing outputs:
   - `employeeSummary`
   - `reviewWork`

## Responsibilities that belong elsewhere
- `CompanyEventEngine`: owns all company state updates
- `PropertyInterestCoordinator`: owns property inquiry reasoning
- `WebsiteInquiryAdapter`: owns website normalization into business payloads

