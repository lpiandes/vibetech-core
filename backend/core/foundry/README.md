# VIBETech Core Foundry

The Foundry is the platform’s *manufacturing area* for Digital Employees.

In Phase 2 Step 2.1.1, it creates only the **blueprint generation framework**:

- It generates the employee folder structure
- It creates required template files with **headings only**
- It creates JSON skeletons for contract files with **no business logic**

No prompts, providers, or business content are generated in this step.

---

## Purpose of the Foundry

Provide a repeatable way to create a *new Digital Employee* that conforms to the Employee Contract.

Why this matters:

- Employees are the single source of business rules and behavior.
- Core runtime remains industry-agnostic.
- Engineers can standardize employee scaffolding without copying ad-hoc templates.

---

## Purpose of `BlueprintGenerator`

`BlueprintGenerator` is responsible for generating an employee directory blueprint given:

- Operating System
- Department
- Employee Name

It creates:

- `employee.json` (contract skeleton metadata only)
- `PROFILE.md`, `README.md`, `SOP.md`, `BRAIN.md` (heading-only templates)
- `prompt.md` (heading-only template)
- `rules.json` (rules skeleton with no executable business logic)
- `examples/`, `tests/`, `assets/` folders (empty structure)

No CLI is created and no content is populated beyond structure + headings.

---

## Purpose of `EmployeeTemplate`

`EmployeeTemplate` represents the canonical employee scaffolding contract:

- required files
- required folders
- naming conventions
- default version values for template manifests

It intentionally contains no business logic and no execution concerns.

---

## Future roadmap (what comes next)

Later steps will extend the Foundry by adding capabilities such as:

- richer template generation (still without business logic)
- tighter compatibility checks against the Employee Contract schema
- orchestration to ensure templates align with SDK lifecycle expectations
- optional generation helpers for event/capability scaffolding

Phase 2 Step 2.1.1 stops after the blueprint framework foundation.

