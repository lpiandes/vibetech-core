/**
 * EmployeeDefinitionEngine
 *
 * Transforms a business EmployeeDefinition into a normalized internal representation.
 *
 * Responsibilities:
 * - Accept an EmployeeDefinition object
 * - Validate required business fields
 * - Translate business definition into normalized representation
 *
 * Strict Phase 2 Step 2.1.2 constraints:
 * - DO NOT generate files
 * - DO NOT create employee.json
 * - DO NOT create PROFILE/EMPLOYEE documents
 * - DO NOT implement AI
 */
export class EmployeeDefinitionEngine {
  /**
   * @param {object} params
   * @param {string} [params.definitionVersionDefault]
   */
  constructor({ definitionVersionDefault = "1.0" } = {}) {
    this.definitionVersionDefault = definitionVersionDefault;
  }

  /**
   * Validate and normalize business definition.
   *
   * @param {any} employeeDefinition
   * @returns {{ valid: boolean, normalized?: any, errors: Array<{code:string,message:string,path?:string}> }}
   */
  normalize(employeeDefinition) {
    const errors = [];
    const input = employeeDefinition;

    if (!input || typeof input !== "object") {
      return {
        valid: false,
        errors: [
          {
            code: "EMP_DEF_INVALID_TYPE",
            message: "EmployeeDefinition must be an object.",
            path: "employeeDefinition",
          },
        ],
      };
    }

    const required = [
      "employeeName",
      "jobTitle",
      "operatingSystem",
      "department",
      "mission",
      "businessOutcome",
      "requiresHumanApproval",
      "approverRole",
      "skills",
      "trainingTopics",
      "kpis",
      "businessROI",
      "futureResponsibilities",
    ];

    for (const field of required) {
      if (!(field in input)) {
        errors.push({
          code: `EMP_DEF_MISSING_${field.toUpperCase()}`,
          message: `Missing required field '${field}'.`,
          path: field,
        });
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Type checks + semantic checks (still business-only validation)
    this.#assertNonEmptyString(input, "employeeName", errors);
    this.#assertNonEmptyString(input, "jobTitle", errors);
    this.#assertNonEmptyString(input, "operatingSystem", errors);
    this.#assertNonEmptyString(input, "department", errors);
    this.#assertNonEmptyString(input, "mission", errors);
    this.#assertNonEmptyString(input, "businessOutcome", errors);
    this.#assertNonEmptyString(input, "approverRole", errors);

    this.#assertBoolean(input, "requiresHumanApproval", errors);
    this.#assertStringArray(input, "skills", errors);
    this.#assertStringArray(input, "trainingTopics", errors);
    this.#assertKpis(input, "kpis", errors);

    // businessROI can be numeric or an object shape; validate lightly.
    if (
      !(
        typeof input.businessROI === "number" ||
        (input.businessROI &&
          typeof input.businessROI === "object" &&
          typeof input.businessROI.value === "number")
      )
    ) {
      errors.push({
        code: "EMP_DEF_INVALID_BUSINESS_ROI",
        message: "businessROI must be a number or { value: number, currency?: string }.",
        path: "businessROI",
      });
    }

    this.#assertStringArray(input, "futureResponsibilities", errors);

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const definitionVersion = input.definitionVersion ?? this.definitionVersionDefault;

    const normalized = {
      definitionVersion,

      employee: {
        employeeName: input.employeeName,
        jobTitle: input.jobTitle,
        operatingSystem: input.operatingSystem,
        department: input.department,
      },

      mission: input.mission,

      businessOutcome: input.businessOutcome,

      governance: {
        requiresHumanApproval: input.requiresHumanApproval,
        approverRole: input.approverRole,
      },

      skills: input.skills,
      trainingTopics: input.trainingTopics,

      kpis: this.#normalizeKpis(input.kpis),

      businessROI: this.#normalizeBusinessRoi(input.businessROI),

      futureResponsibilities: input.futureResponsibilities,
    };

    return { valid: true, normalized, errors: [] };
  }

  #assertNonEmptyString(obj, field, errors) {
    if (typeof obj[field] !== "string" || obj[field].trim() === "") {
      errors.push({
        code: `EMP_DEF_INVALID_${field.toUpperCase()}`,
        message: `Field '${field}' must be a non-empty string.`,
        path: field,
      });
    }
  }

  #assertBoolean(obj, field, errors) {
    if (typeof obj[field] !== "boolean") {
      errors.push({
        code: `EMP_DEF_INVALID_${field.toUpperCase()}`,
        message: `Field '${field}' must be a boolean.`,
        path: field,
      });
    }
  }

  #assertStringArray(obj, field, errors) {
    if (!Array.isArray(obj[field])) {
      errors.push({
        code: `EMP_DEF_INVALID_${field.toUpperCase()}`,
        message: `Field '${field}' must be an array.`,
        path: field,
      });
      return;
    }

    if (obj[field].some((x) => typeof x !== "string" || x.trim() === "")) {
      errors.push({
        code: `EMP_DEF_INVALID_${field.toUpperCase()}`,
        message: `Field '${field}' must be an array of non-empty strings.`,
        path: field,
      });
    }
  }

  #assertKpis(obj, field, errors) {
    if (!Array.isArray(obj[field])) {
      errors.push({
        code: "EMP_DEF_INVALID_KPIS",
        message: "kpis must be an array (strings or objects).",
        path: field,
      });
      return;
    }

    const invalid = obj[field].some((k) => {
      if (typeof k === "string") return k.trim() === "";
      if (!k || typeof k !== "object") return true;
      if (typeof k.name !== "string" || k.name.trim() === "") return true;
      return false;
    });

    if (invalid) {
      errors.push({
        code: "EMP_DEF_INVALID_KPIS",
        message: "kpis entries must be non-empty strings or { name: string, ... } objects.",
        path: field,
      });
    }
  }

  #normalizeKpis(kpis) {
    // Normalize to a consistent structure: { name, target?, unit? }
    return kpis.map((k) => {
      if (typeof k === "string") {
        return { name: k, target: undefined, unit: undefined };
      }
      return {
        name: k.name,
        target: k.target,
        unit: k.unit,
      };
    });
  }

  #normalizeBusinessRoi(businessROI) {
    if (typeof businessROI === "number") {
      return { value: businessROI, currency: undefined };
    }

    return {
      value: businessROI.value,
      currency: businessROI.currency,
    };
  }
}

