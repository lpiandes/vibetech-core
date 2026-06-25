import path from "node:path";

/**
 * @typedef {Object} ValidationError
 * @property {string} code - Stable machine-readable error code.
 * @property {string} message - Human readable error message.
 * @property {string} [path] - Field path (e.g. `employee.manifest.name`).
 */

/**
 * @typedef {Object} EmployeeManifest
 * @property {string} name
 * @property {string} industry
 * @property {string} [sdkVersion]
 * @property {string} [employeeVersion]
 * @property {string} description
 * @property {boolean} requiresApproval
 * @property {string[]} capabilities
 */

/**
 * @typedef {Object} Employee
 * @property {string} id
 * @property {string} folderName
 * @property {EmployeeManifest} manifest
 * @property {string} prompt
 * @property {any} rules
 */

export class EmployeeValidator {
  /**
   * Validate an Employee object and return descriptive validation errors.
   *
   * @param {Employee} employee
   * @returns {{ valid: boolean, errors: ValidationError[] }}
   */
  validateEmployee(employee) {
    /** @type {ValidationError[]} */
    const errors = [];

    if (!employee || typeof employee !== "object") {
      errors.push({
        code: "EMPLOYEE_INVALID_TYPE",
        message: "Employee must be an object.",
        path: "employee",
      });
      return { valid: false, errors };
    }

    // Identity
    if (!employee.id || typeof employee.id !== "string") {
      errors.push({
        code: "EMPLOYEE_MISSING_ID",
        message: "Employee.id is required and must be a string.",
        path: "employee.id",
      });
    }

    // Manifest presence
    if (!employee.manifest || typeof employee.manifest !== "object") {
      errors.push({
        code: "EMPLOYEE_MISSING_MANIFEST",
        message: "Employee.manifest is required.",
        path: "employee.manifest",
      });
    } else {
      this.#validateManifestFields(employee.manifest, errors);
    }

    // Prompt
    if (typeof employee.prompt !== "string" || employee.prompt.trim() === "") {
      errors.push({
        code: "EMPLOYEE_MISSING_PROMPT",
        message: "prompt.md content is required and must be a non-empty string.",
        path: "employee.prompt",
      });
    }

    // Rules
    if (employee.rules === undefined) {
      errors.push({
        code: "EMPLOYEE_MISSING_RULES",
        message: "rules.json content is required.",
        path: "employee.rules",
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * @param {EmployeeManifest} manifest
   * @param {ValidationError[]} errors
   */
  #validateManifestFields(manifest, errors) {
    const requiredFields = [
      "name",
      "industry",
      "description",
      "requiresApproval",
      "capabilities",
    ];

    for (const field of requiredFields) {
      if (!(field in manifest)) {
        errors.push({
          code: `EMPLOYEE_MANIFEST_MISSING_${field.toUpperCase()}`,
          message: `Manifest field '${field}' is required.`,
          path: `employee.manifest.${field}`,
        });
        continue;
      }
    }

    // Type checks (generic metadata validation only)
    if (manifest.name && typeof manifest.name !== "string") {
      errors.push({
        code: "EMPLOYEE_MANIFEST_INVALID_NAME",
        message: "Manifest field 'name' must be a string.",
        path: path.posix.join("employee.manifest", "name"),
      });
    }

    if (manifest.industry && typeof manifest.industry !== "string") {
      errors.push({
        code: "EMPLOYEE_MANIFEST_INVALID_INDUSTRY",
        message: "Manifest field 'industry' must be a string (metadata only).",
        path: path.posix.join("employee.manifest", "industry"),
      });
    }

    // Version compatibility metadata (validated only if present)
    if (manifest.sdkVersion !== undefined && typeof manifest.sdkVersion !== "string") {
      errors.push({
        code: "EMPLOYEE_MANIFEST_INVALID_SDK_VERSION",
        message: "Manifest field 'sdkVersion' must be a string.",
        path: path.posix.join("employee.manifest", "sdkVersion"),
      });
    }

    if (
      manifest.employeeVersion !== undefined &&
      typeof manifest.employeeVersion !== "string"
    ) {
      errors.push({
        code: "EMPLOYEE_MANIFEST_INVALID_EMPLOYEE_VERSION",
        message: "Manifest field 'employeeVersion' must be a string.",
        path: path.posix.join("employee.manifest", "employeeVersion"),
      });
    }

    if (manifest.description && typeof manifest.description !== "string") {
      errors.push({
        code: "EMPLOYEE_MANIFEST_INVALID_DESCRIPTION",
        message: "Manifest field 'description' must be a string.",
        path: path.posix.join("employee.manifest", "description"),
      });
    }

    if (typeof manifest.requiresApproval !== "boolean") {
      errors.push({
        code: "EMPLOYEE_MANIFEST_INVALID_REQUIRES_APPROVAL",
        message: "Manifest field 'requiresApproval' must be a boolean.",
        path: path.posix.join("employee.manifest", "requiresApproval"),
      });
    }

    if (
      !Array.isArray(manifest.capabilities) ||
      manifest.capabilities.some((c) => typeof c !== "string")
    ) {
      errors.push({
        code: "EMPLOYEE_MANIFEST_INVALID_CAPABILITIES",
        message:
          "Manifest field 'capabilities' must be an array of strings describing WHAT the employee can do.",
        path: path.posix.join("employee.manifest", "capabilities"),
      });
    }
  }
}

