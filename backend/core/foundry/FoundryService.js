import { BlueprintGenerator } from "./BlueprintGenerator.js";

import { EmployeeDefinitionEngine } from "./EmployeeDefinitionEngine.js";
import { EmployeeValidationEngine } from "./EmployeeValidationEngine.js";

/**
 * FoundryService
 *
 * Reusable orchestration layer that wires together Foundry components:
 * - EmployeeDefinitionEngine
 * - EmployeeValidationEngine
 * - BlueprintGenerator
 *
 * This service is intentionally NOT a CLI, NOT an API, and NOT a UI.
 */
export class FoundryService {
  /**
   * @param {object} params
   * @param {string} params.employeesRootPath - Root folder where employee directories will be created.
   * @param {BlueprintGenerator} [params.blueprintGenerator]
   * @param {EmployeeDefinitionEngine} [params.definitionEngine]
   * @param {EmployeeValidationEngine} [params.validationEngine]
   */
  constructor({
    employeesRootPath,
    blueprintGenerator = new BlueprintGenerator(),
    definitionEngine = new EmployeeDefinitionEngine(),
    validationEngine = new EmployeeValidationEngine(),
  }) {
    if (!employeesRootPath) {
      throw new Error("employeesRootPath is required.");
    }

    this.employeesRootPath = employeesRootPath;
    this.blueprintGenerator = blueprintGenerator;
    this.definitionEngine = definitionEngine;
    this.validationEngine = validationEngine;
  }

  /**
   * Create a Digital Employee by:
   * 1) normalizing an EmployeeDefinition
   * 2) validating business quality
   * 3) if valid, generating an employee blueprint folder structure
   *
   * @param {any} definition - Business-level EmployeeDefinition (Step 2.1.2 contract)
   * @returns {Promise<{
   *   success: boolean,
   *   employee: any,
   *   validation: any,
   *   generatedFiles: Array<{ path: string }>|Array<any>,
   *   warnings: string[],
   *   recommendations: string[]
   * }>}
   */
  async createEmployee(definition) {
    // Step 1: normalize business definition
    const normalizedResult = this.definitionEngine.normalize(definition);
    if (!normalizedResult.valid) {
      const validation = {
        success: false,
        warnings: [],
        errors: normalizedResult.errors,
        recommendations: [],
      };

      return {
        success: false,
        employee: undefined,
        validation,
        generatedFiles: [],
        warnings: [],
        recommendations: [],
      };
    }

    // Step 2: validate business quality
    const normalized = normalizedResult.normalized;
    const validation = this.validationEngine.validate(normalized);

    if (!validation.success) {
      return {
        success: false,
        employee: normalized,
        validation,
        generatedFiles: [],
        warnings: validation.warnings,
        recommendations: validation.recommendations,
      };
    }

    // Step 3: generate blueprint (files/folders) from business definition
    const { employeeName, operatingSystem, department } = normalized.employee;
    const generated = await this.blueprintGenerator.generateEmployeeBlueprint({
      employeesRootPath: this.employeesRootPath,
      operatingSystem,
      department,
      employeeName,
    });

    return {
      success: true,
      employee: normalized,
      validation,
      generatedFiles: [
        {
          path: generated.employeeFolderPath,
        },
      ],
      warnings: validation.warnings,
      recommendations: validation.recommendations,
    };
  }
}

