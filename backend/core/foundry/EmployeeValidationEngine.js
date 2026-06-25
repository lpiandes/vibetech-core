/**
 * EmployeeValidationEngine
 *
 * Validates BUSINESS QUALITY of a normalized EmployeeDefinition.
 * This engine does NOT validate JSON syntax, does NOT validate SDK schemas,
 * and does NOT implement execution or generation.
 *
 * It produces:
 * - success: boolean
 * - warnings: array of non-blocking quality notes
 * - errors: array of blocking quality failures
 * - recommendations: array of actionable improvement suggestions
 */
export class EmployeeValidationEngine {
  constructor() {}

  /**
   * @param {any} normalizedEmployeeDefinition
   * @returns {{
   *   success: boolean,
   *   warnings: Array<string>,
   *   errors: Array<{ code: string, message: string, path?: string }>,
   *   recommendations: Array<string>
   * }}
   */
  validate(normalizedEmployeeDefinition) {
    const warnings = [];
    const errors = [];
    const recommendations = [];

    const def = normalizedEmployeeDefinition;

    // Expected normalized shape (from EmployeeDefinitionEngine):
    // {
    //   definitionVersion,
    //   employee: { employeeName, jobTitle, operatingSystem, department },
    //   mission,
    //   businessOutcome,
    //   governance: { requiresHumanApproval, approverRole },
    //   skills: string[],
    //   trainingTopics: string[],
    //   kpis: [{ name, target?, unit? }],
    //   businessROI: { value, currency? },
    //   futureResponsibilities: string[]
    // }

    // Required business completeness checks (blocking errors).
    this.#requireNonEmptyString(def?.mission, "mission", errors);
    this.#requireNonEmptyString(def?.businessOutcome, "businessOutcome", errors);

    this.#requireNonEmptyString(def?.employee?.department, "department", errors);
    this.#requireNonEmptyString(def?.employee?.operatingSystem, "operatingSystem", errors);
    this.#requireNonEmptyString(def?.employee?.employeeName, "employeeName", errors);

    // KPI completeness: at least one KPI exists.
    if (!Array.isArray(def?.kpis) || def.kpis.length < 1) {
      errors.push({
        code: "EMP_DEF_MISSING_KPIS",
        message: "At least one KPI must be provided.",
        path: "kpis",
      });
    } else {
      // Quality (non-blocking): at least one KPI should have measurable targets.
      const hasMeasurable = def.kpis.some((k) => k?.target !== undefined && k?.target !== null);
      if (!hasMeasurable) {
        recommendations.push("This employee would benefit from defining measurable KPI targets.");
      }
    }

    // Skills completeness: at least one skill exists.
    if (!Array.isArray(def?.skills) || def.skills.length < 1) {
      errors.push({
        code: "EMP_DEF_MISSING_SKILLS",
        message: "At least one skill must be provided.",
        path: "skills",
      });
    }

    // Training topics completeness: must exist (non-empty).
    if (!Array.isArray(def?.trainingTopics) || def.trainingTopics.length < 1) {
      errors.push({
        code: "EMP_DEF_MISSING_TRAINING_TOPICS",
        message: "Training topics must include at least one topic.",
        path: "trainingTopics",
      });
    }

    // Human approval: if requiresHumanApproval is true, approverRole must exist.
    const requiresHumanApproval = def?.governance?.requiresHumanApproval;
    if (requiresHumanApproval === true) {
      const approverRole = def?.governance?.approverRole;
      if (typeof approverRole !== "string" || approverRole.trim() === "") {
        errors.push({
          code: "EMP_DEF_MISSING_APPROVER_ROLE",
          message: "Approver Role must exist when requiresHumanApproval is true.",
          path: "governance.approverRole",
        });
      }
    }

    // Business quality recommendations (non-blocking).
    if (!def?.businessROI) {
      recommendations.push("This employee has no stated ROI. Consider documenting expected business value.");
    }

    if (!Array.isArray(def?.futureResponsibilities) || def.futureResponsibilities.length < 1) {
      recommendations.push("This employee has no future responsibilities. Consider defining what success looks like over time.");
    }

    // Warnings based on optional fields being empty; not blocking.
    if (!Array.isArray(def?.kpis) || def.kpis.length >= 1) {
      const missingUnits = def.kpis.some((k) => k && typeof k.unit === "undefined");
      if (missingUnits) {
        warnings.push("Some KPIs do not specify units. Consider adding units for clearer measurement.");
      }
    }

    // Final success calculation: success only if there are no errors.
    const success = errors.length === 0;

    return {
      success,
      warnings,
      errors,
      recommendations,
    };
  }

  #requireNonEmptyString(value, fieldName, errors) {
    if (typeof value !== "string" || value.trim() === "") {
      errors.push({
        code: `EMP_DEF_MISSING_${String(fieldName).toUpperCase()}`,
        message: `${fieldName} must exist.`,
        path: fieldName,
      });
    }
  }
}

