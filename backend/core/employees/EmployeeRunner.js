import crypto from "node:crypto";

import { EmployeeContext } from "./EmployeeContext.js";
import { EmployeeValidator } from "./EmployeeValidator.js";

/**
 * EmployeeRunner is responsible for preparing an Employee for execution.
 * It does not execute prompts, does not call AI providers, and does not call
 * any integration/provider adapters.
 */
export class EmployeeRunner {
  /**
   * @param {object} params
   * @param {EmployeeValidator} [params.validator]
   */
  constructor({ validator = new EmployeeValidator() } = {}) {
    this.validator = validator;
  }

  /**
   * Validate, prepare, and return a placeholder execution response.
   *
   * @param {any} employee
   * @returns {Promise<{ ok: boolean, employeeId?: string, errors?: any[], result: any }>}
   */
  async run(employee) {
    const executionId = crypto.randomUUID();

    const validation = this.validator.validateEmployee(employee);

    if (!validation.valid) {
      return {
        success: false,
        executionId,
        employeeId: employee?.id,
        status: "VALIDATION_FAILED",
        output: null,
        warnings: [],
        errors: validation.errors,
        metrics: {
          placeholder: true,
          validatedAt: new Date().toISOString(),
        },
      };
    }

    const prepared = this.prepareForExecution(employee, executionId);

    // Placeholder response: we intentionally do NOT execute prompts, does NOT call providers, and does NOT call AI.
    return {
      success: true,
      executionId,
      employeeId: prepared.employeeId,
      status: "EXECUTION_NOT_IMPLEMENTED_IN_PHASE_1_2",
      output: {
        placeholder: true,
        executionContext: prepared.context,
        executionPlan: {
          nextStep: "EXECUTION_NOT_IMPLEMENTED_IN_PHASE_1_2",
        },
        preparedAt: prepared.preparedAt,
      },
      warnings: [
        "Phase 1 Step 1.2 runner returns a placeholder response only.",
      ],
      errors: [],
      metrics: {
        placeholder: true,
        preparedAt: prepared.preparedAt,
      },
    };
  }

  /**
   * Prepare an employee for execution by shaping a generic runtime context.
   * No side effects and no execution occur.
   *
   * @param {any} employee
   * @returns {{ employeeId: string, preparedAt: string, manifest: any, prompt: string, rules: any }}
   */
  prepareForExecution(employee, executionId) {
    const preparedAt = new Date().toISOString();
    return {
      employeeId: employee.id,
      preparedAt,
      context: EmployeeContext.create({ executionId }),
      manifest: employee.manifest,
      prompt: employee.prompt,
      rules: employee.rules,
    };
  }
}

