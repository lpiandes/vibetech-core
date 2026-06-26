/**
 * EmployeeTemplate
 *
 * Canonical structure + naming conventions for a Digital Employee.
 *
 * This file contains ONLY template contracts (constants + conventions).
 * It intentionally does not implement business logic or execution.
 */

export class EmployeeTemplate {
  /**
   * Default version values used in template employee.json.
   * These are placeholders meant for compatibility scaffolding.
   */
  static DEFAULT_SDK_VERSION = "phase-1";
  static DEFAULT_EMPLOYEE_VERSION = "1.0";
  static DEFAULT_REQUIRES_APPROVAL = true;

  /**
   * Required files every employee directory must contain.
   */
  static REQUIRED_FILES = [
    "employee.json",
    "PROFILE.md",
    "README.md",
    "SOP.md",
    "BRAIN.md",
    "SCENARIOS.md",
    "prompt.md",
    "rules.json",
  ];

  /**
   * Required folders every employee directory must contain.
   * (Folders exist so content can be added later without changing the structure contract.)
   */
  static REQUIRED_FOLDERS = [
    "examples",
    "tests",
    "assets",
  ];

  /**
   * Naming conventions used by the Blueprint Generator.
   * The SDK must remain industry-agnostic; these conventions are purely filesystem hygiene.
   */
  static NAMING_CONVENTIONS = {
    folderSlugSeparator: "-",
    slugLowercase: true,
  };

  /**
   * Employee.json contract skeleton used for templates.
   * The generator will populate only metadata fields derived from input parameters.
   * No business profiles are created here.
   */
  static createEmployeeJsonSkeleton({ name, department, operatingSystem }) {
    return {
      name,

      // Phase 1 validator treats `industry` as metadata only.
      // For templates, we map the provided Department into the metadata field.
      industry: department,

      sdkVersion: EmployeeTemplate.DEFAULT_SDK_VERSION,
      employeeVersion: EmployeeTemplate.DEFAULT_EMPLOYEE_VERSION,

      description: "Template employee (no business content generated yet).",
      requiresApproval: EmployeeTemplate.DEFAULT_REQUIRES_APPROVAL,

      // WHAT the employee can do (declared later by the employee author).
      capabilities: [],

      // Governance contract (docs-only contract now).
      permissions: [],

      // Events contract (docs-only contract now).
      events: {
        triggers: [],
        produces: [],
      },

      // Helpful metadata (still not business logic).
      operatingSystem,
      department,
    };
  }
}

