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

---

## Purpose of `EmployeeDefinition` and `EmployeeDefinitionEngine` (Step 2.1.2)

### Employee Definition (business contract)

`EmployeeDefinition` represents the *business* description of a Digital Employee.

It captures intent in business language, such as:

- Employee name
- Job title
- Operating system
- Department
- Mission
- Business outcome
- Requires human approval
- Approver role
- Skills
- Training topics
- KPIs
- Business ROI
- Future responsibilities

Critically, it does **not** include technical implementation details:
- no providers
- no manifests
- no prompts
- no SDK/internal execution concepts

### Employee Definition Engine (business normalization)

`EmployeeDefinitionEngine` is a validation + normalization layer.

Responsibilities:

- Accept an `EmployeeDefinition` object
- Validate required business fields
- Translate the business definition into a normalized internal representation

Non-goals for Step 2.1.2:
- DO NOT generate files
- DO NOT create `employee.json`
- DO NOT create `PROFILE/EMPLOYEE` documents
- DO NOT implement AI

### Why VIBETech hides technical complexity

VIBETech separates business meaning from technical construction:

- Business users provide business definitions.
- The platform core later consumes those definitions to generate technical artifacts.
- Providers and execution details remain abstracted behind platform contracts.

This approach prevents:

- Business stakeholders from needing to understand implementation details.
- Engineers from embedding business logic or domain knowledge in technical plumbing.

### How future roadmap steps will consume `EmployeeDefinition`

Later roadmap steps will:

1. Take the normalized output from `EmployeeDefinitionEngine`
2. Convert it into technical employee artifacts (templates/manifests/documents)
3. Continue to keep providers and execution mechanics out of the business definition layer

Phase 2 Step 2.1.2 ends after the business definition process and normalization contract is established.

---

## Purpose of `EmployeeValidationEngine` (Step 2.1.3)

### Validation vs Definition

`EmployeeDefinition` describes the *business intent* of a Digital Employee.

`EmployeeValidationEngine` evaluates the *business quality* of that definition.

Key difference:

- **Definition** answers: “What will this employee do (in business terms)?”
- **Validation** answers: “Is this business definition complete and ready for generation later?”

### What the Validation Engine does (business-only)

Responsibilities:

- Accept a **normalized** `EmployeeDefinition` produced by `EmployeeDefinitionEngine`
- Validate business completeness and quality (examples):
  - Mission exists
  - Business Outcome exists
  - Department exists
  - Operating System exists
  - Employee Name exists
  - At least one KPI exists
  - At least one Skill exists
  - Training Topics exist
  - If `requiresHumanApproval` is true, `approverRole` must exist
- Return:
  - `success` (boolean)
  - `warnings` (non-blocking issues)
  - `errors` (blocking completeness failures)
  - `recommendations` (actionable business improvement suggestions)

Important: Phase 2 Step 2.1.3 does **not** generate files and does not implement execution.

### How future roadmap steps use validation

Later roadmap steps will:

1. Use `EmployeeDefinitionEngine` to normalize business input
2. Use `EmployeeValidationEngine` to validate readiness and quality
3. Only when validation is successful (and/or after warnings are addressed), generate technical employee artifacts in subsequent steps

---

## Purpose of `FoundryService` (Step 2.1.4)

### What FoundryService is

`FoundryService` is the reusable orchestration layer that coordinates the Foundry’s business workflow:

1. Accept an `EmployeeDefinition`
2. Normalize it using `EmployeeDefinitionEngine`
3. Validate it using `EmployeeValidationEngine`
4. If validation fails:
   - return structured validation results
   - do not generate files
5. If validation succeeds:
   - call `BlueprintGenerator` to generate the employee blueprint structure
6. Return a standardized orchestration response

### Why orchestration is separated from the CLI

Foundry orchestration is intentionally separated from any interface (CLI, dashboard, API, marketplace) so:

- the orchestration workflow is a stable contract for engineering
- multiple delivery surfaces can reuse the same orchestration logic
- business-definition and validation rules remain consistent regardless of how users trigger generation

`FoundryService` is *not* a CLI and *not* an API—it is a reusable core component.

### Future interfaces

Later roadmap steps can expose this orchestration through:

- CLI
- Dashboard
- API
- Marketplace

---

## Foundry CLI (Step 2.1.5)

### Purpose

The Foundry CLI is the first **human interface** to the Foundry orchestration workflow.

It:
- collects business information from the user
- converts that input into an `EmployeeDefinition`
- calls `FoundryService.createEmployee(definition)`
- displays the resulting success/failure, warnings, recommendations, and generated folder path

The CLI is not an execution engine and does not implement AI, providers, prompts, or SDK behavior beyond orchestration.

### Example workflow

1. Run: `npm run foundry` (from `backend/`)
2. Enter business fields prompted by the CLI:
   - Employee Name
   - Operating System
   - Department
   - Mission
   - Business Outcome
   - Requires Human Approval (+ Approver Role only if needed)
   - Skills
   - Training Topics
   - KPIs
   - Business ROI
   - Future Responsibilities
3. The CLI calls `FoundryService` which:
   - normalizes the `EmployeeDefinition`
   - validates business quality
   - if validation succeeds, triggers blueprint generation
4. The CLI prints:
   - Success
   - Warnings
   - Recommendations
   - Generated Employee Folder

### Future replacement by dashboard UI

Later roadmap steps can replace or complement this CLI with:
- a dashboard UI for interactive business definition
- an API surface for automation / marketplace workflows

This is possible because the CLI is only an interface; the orchestration flow remains centralized in `FoundryService`.

