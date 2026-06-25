# VIBETech Core Employee SDK

## Purpose

The Employee SDK is the core runtime architecture that will:

1. Discover employee definitions from the filesystem.
2. Validate employee artifacts (manifest + prompt + rules).
3. Load employees into a uniform in-memory representation.
4. Prepare employees for execution (Phase 1 only returns a placeholder).

This SDK is **generic by design**:
- It does not contain industry-specific logic.
- Industry knowledge lives only under the top-level `employees/` folder.
- The SDK does not implement HTTP endpoints.
- The SDK does not call AI providers or execute prompts.

## Execution Context

`EmployeeContext` provides a standardized execution context shape to the runtime.

Phase 1 only creates placeholders (no provider wiring, no provider calls):
- `providers`
- `config`
- `logger`
- `database`
- `organization`
- `project`
- `user`
- `executionId`

This makes it easy to add integrations later without changing the SDK’s core contract.

## Capabilities vs Providers

- **Capabilities** describe WHAT an employee can do (declared in `employee.json`).
- **Providers** describe HOW the platform performs those capabilities (will be wired later under `backend/providers/`).

The SDK in Phase 1 does not implement providers; it only defines the contract boundaries.

## Lifecycle

The SDK models an Employee lifecycle with these phases:

1. **Discover**
2. **Load**
3. **Validate**
4. **Initialize**
5. **Execute**
6. **Cleanup**
7. **Return**

### Phase semantics (docs-only)

- `initialize()`
  - prepares the execution context for the employee run (no AI/provider execution in Phase 1)
- `execute()`
  - performs the employee's work (not implemented in Phase 1; the runner returns a placeholder response)
- `cleanup()`
  - performs any teardown needed for the run (not implemented in Phase 1)

1. **Discover**
   - `EmployeeRegistry.discover()` scans the configured `employeesRootPath` for employee folders.
2. **Load**
   - `EmployeeLoader.loadEmployee()` reads `employee.json`, `prompt.md`, and `rules.json` and returns a complete `Employee` object.
3. **Validate**
   - `EmployeeValidator.validateEmployee()` checks required files and manifest fields, returning descriptive errors.
4. **Initialize / Execute / Cleanup / Return**
   - `EmployeeRunner.run()` is responsible for orchestrating `initialize() -> execute() -> cleanup()`.
   - In Phase 1, it does not execute prompts or call providers/AI; it returns the placeholder response while preserving the contract surface for future implementation.

## Classes and Responsibilities

### `EmployeeRegistry`

Responsibilities:
- Discover employees
- Register employees in memory
- Return employees by ID
- List available employees

Non-goals:
- No business logic
- No execution
- No prompt/provider usage

### `EmployeeLoader`

Responsibilities:
- Load employee folders
- Read:
  - `employee.json`
  - `prompt.md`
  - `rules.json`
- Return a complete `Employee` object

Non-goals:
- No validation beyond basic parsing/reading
- No AI/provider execution

### `EmployeeValidator`

Responsibilities:
- Validate:
  - `employee.json` exists
  - `prompt.md` exists
  - `rules.json` exists
  - required manifest fields exist
- Return descriptive validation errors with stable codes

Version compatibility:
- Supports optional `sdkVersion` and `employeeVersion` fields inside `employee.json`.
- If present, both are validated as strings.

Non-goals:
- No domain rules or industry knowledge

### `EmployeeRunner`

Responsibilities:
- Accept an `Employee` object
- Validate it
- Prepare a generic execution context
- Return a placeholder JSON response

Standard Response Object:

Every `EmployeeRunner.run()` call returns the same response shape:
- `success` (boolean)
- `executionId` (string)
- `employeeId` (string | undefined)
- `status` (string)
- `output` (object | null)
- `warnings` (string[])
- `errors` (array)
- `metrics` (object)

Hard constraints (Phase 1):
- DO NOT call AI
- DO NOT call providers
- DO NOT execute prompts

## How future employees plug into the SDK

To add a new AI Employee, create a new folder under the top-level `employees/` directory containing:
- `employee.json`
- `prompt.md`
- `rules.json`

The SDK will discover it automatically (via `EmployeeRegistry`) and will load it into the standard `Employee` shape (via `EmployeeLoader`). Validation and execution preparation will work without any SDK code changes.

### Version Compatibility Policy (Phase 1)

Phase 1 validates the *types* of:
- `sdkVersion`
- `employeeVersion`

The runner does not enforce compatibility yet; enforcement can be added in later roadmap steps without breaking the response contract.

## Employee Manifest Contract (Docs)

Each employee folder under the top-level `employees/` directory must declare:

- `employee.json` (manifest)
- `prompt.md`
- `rules.json`

### Permissions (Docs-only)

Each employee may declare a `permissions` array in `employee.json`:

- `permissions: []` (empty array means no external permissions required)
- `permissions: ["contacts.read", "contacts.write", "email.send"]` (example shape)

The employee requests permissions, and later the SDK will decide whether the current organization/user is allowed to grant them. Phase 1 does not implement enforcement; this is the contract boundary for future multi-tenant/role-based access control.

### Events (Docs-only)

Each employee may declare an `events` field in `employee.json`.

The SDK will use this to understand what kinds of platform events the employee can emit or react to (contract only in Phase 1).

