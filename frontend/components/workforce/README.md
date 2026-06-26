# Digital Workforce Components

This folder contains the **Digital Workforce** v1 implementation.

## Purpose (page + components)
- **`DigitalWorkforce.tsx`**: page-level composition that answers the single question:
  “How is my Digital Workforce doing?”
- **`WorkforceHeader.tsx`**: the page title and framing message.
- **`WorkforceSummary.tsx`**: the workforce summary strip (mock metrics).
- **`EmployeeGrid.tsx`**: lays out the employee cards area (mocked list of 4 employees).
- **`EmployeeCard.tsx`**: the employee “handoff card” that answers:
  who they are, what they’re doing, how well they’re doing, and whether they need review from the manager.
- **`EmployeeStatus.tsx`**: status + “waiting on you” signal for governance.
- **`EmployeeMetrics.tsx`**: today’s accomplishments + approval rate + current workload.
- **`EmployeeCapabilities.tsx`**: a compact capability chip list (3–5 chips).
- **`EmployeeCTA.tsx`**: the primary decision CTA (“Open Employee”), visual-only in this sprint.

## How this fulfills the Digital Workforce vision
This page is designed to feel like workforce management:
- It avoids “record browsing” language and instead presents **structured employee updates**.
- The card layout makes the manager decision obvious: **Do they need me?** is visible immediately.
- The summary strip sets context so the employee list reads like a team handoff, not an admin table.

## How Employee Profiles will connect later
- **Employee Profile** is intended to become the deeper drill-down for a single Digital Employee.
- This page should later link to profiles for coverage context (role, capability focus, and review outcomes).
- For this sprint, the CTA and data are **mock-only** and no routing behavior is implemented.

