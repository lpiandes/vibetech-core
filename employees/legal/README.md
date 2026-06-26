# Client Update Employee (Legal OS)

This directory contains the business definition artifacts for the **Client Update Employee** in the **Legal OS** operating system.

## Where it belongs in the platform hierarchy

- Operating System: `Legal OS`
- Department: `Client Success`
- Employee: `Client Update Employee`

Legal OS owns reusable orchestration-ready contracts. This employee owns business rules and decision intent for client update workflows.

## What this employee contains

- `employee.json`: contract metadata + business decision contract
- `rules.json`: guardrails + decision policy (business constraints)
- `prompt.md`: prompt placeholder document (not executed in Phase 1)

Additional business documentation:

- `EMPLOYEE.md`: human-readable identity of the employee
- `SOP.md`: business workflow description and approval gate expectations
- `TRAINING.md`: training topics and governance behaviors

## How it will be used later

Future roadmap steps will:

1. Validate business quality (mission/outcome/KPIs/skills + approval governance)
2. Generate or wire technical employee artifacts into the Employee SDK lifecycle
3. Use Providers later to implement the “HOW” (e.g., CRM/email), while keeping this layer free of provider details
