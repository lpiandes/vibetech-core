/**
 * EmployeeContext
 *
 * Standardized execution context shape for the Employee SDK.
 * Phase 1 intentionally provides only placeholders (no provider wiring).
 */
export class EmployeeContext {
  /**
   * Create a standardized context object with placeholder dependencies.
   *
   * @param {object} params
   * @param {string} params.executionId
   * @returns {object}
   */
  static create({ executionId }) {
    return {
      // Placeholder containers. Providers/config/logger/db will be injected later.
      providers: {},
      config: {},
      logger: {},
      database: {},

      // Tenant / domain context (not executed in Phase 1).
      organization: null,
      project: null,
      user: null,

      // Correlation id for tracking this execution.
      executionId,
    };
  }
}

