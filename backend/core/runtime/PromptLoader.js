/**
 * PromptLoader
 *
 * Sprint 6 (Runtime MVP) infrastructure component:
 * - Loads an employee's prompt and supporting artifacts from its folder.
 * - Reads only from the filesystem.
 *
 * Contract output (no modifications beyond required parsing of JSON):
 * - prompt.md as a string
 * - TRAINING.md as a string
 * - rules.json as a JSON object
 * - employee.json as a JSON object
 *
 * No business logic:
 * - no prompt modification
 * - no prompt interpretation
 * - no AI/providers/execution
 */
import fs from "node:fs/promises";
import path from "node:path";

export class PromptLoader {
  /**
   * @param {object} [params]
   * @param {(p: string) => string} [params.resolveEmployeeFolderPath]
   */
  constructor({ resolveEmployeeFolderPath } = {}) {
    this.resolveEmployeeFolderPath = resolveEmployeeFolderPath ?? ((p) => p);
  }

  /**
   * @param {object} params
   * @param {string} params.employeeFolderPath - Absolute path to the employee folder.
   * @returns {Promise<{
   *   prompt: string,
   *   training: string,
   *   rules: any,
   *   employee: any
   * }>}
   */
  async load({ employeeFolderPath }) {
    const folderPath = this.resolveEmployeeFolderPath(employeeFolderPath);

    const promptPath = path.join(folderPath, "prompt.md");
    const trainingPath = path.join(folderPath, "TRAINING.md");
    const rulesPath = path.join(folderPath, "rules.json");
    const employeeJsonPath = path.join(folderPath, "employee.json");

    const [promptRaw, trainingRaw, rulesRaw, employeeRaw] = await Promise.all([
      fs.readFile(promptPath, "utf8"),
      fs.readFile(trainingPath, "utf8"),
      fs.readFile(rulesPath, "utf8"),
      fs.readFile(employeeJsonPath, "utf8"),
    ]);

    return {
      prompt: promptRaw,
      training: trainingRaw,
      rules: JSON.parse(rulesRaw),
      employee: JSON.parse(employeeRaw),
    };
  }
}

