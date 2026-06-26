import fs from "node:fs/promises";
import path from "node:path";

import { EmployeeTemplate } from "./EmployeeTemplate.js";

/**
 * BlueprintGenerator
 *
 * Generates a Digital Employee folder structure for later authoring.
 * Phase 2 Step 2.1.1 intentionally does NOT generate business profiles,
 * prompts, provider implementations, or execution logic.
 *
 * It only creates:
 * - the folder structure
 * - empty/heading-only template files
 * - contract skeleton files (employee.json + rules.json) with no business content
 */
export class BlueprintGenerator {
  /**
   * @param {object} params
   * @param {(s: string) => string} [params.slugify]
   */
  constructor({ slugify } = {}) {
    this.slugify = slugify ?? BlueprintGenerator.defaultSlugify;
  }

  /**
   * Generate a complete employee folder blueprint.
   *
   * @param {object} params
   * @param {string} params.employeesRootPath - Root folder that contains employee folders.
   * @param {string} params.operatingSystem
   * @param {string} params.department
   * @param {string} params.employeeName
   * @returns {Promise<{ employeeFolderPath: string, employeeFolderName: string }>}
   */
  async generateEmployeeBlueprint({
    employeesRootPath,
    operatingSystem,
    department,
    employeeName,
  }) {
    if (!employeesRootPath) throw new Error("employeesRootPath is required.");
    if (!operatingSystem) throw new Error("operatingSystem is required.");
    if (!department) throw new Error("department is required.");
    if (!employeeName) throw new Error("employeeName is required.");

    const employeeFolderName = this.getEmployeeFolderName({
      operatingSystem,
      department,
      employeeName,
    });
    const employeeFolderPath = path.join(employeesRootPath, employeeFolderName);

    // Create employee folder + required subfolders.
    await fs.mkdir(employeeFolderPath, { recursive: true });
    for (const folderName of EmployeeTemplate.REQUIRED_FOLDERS) {
      await fs.mkdir(path.join(employeeFolderPath, folderName), { recursive: true });
    }

    // Required template files (mostly headings; JSON skeletons only).
    await Promise.all([
      this.#writeEmployeeJson({ employeeFolderPath, operatingSystem, department, employeeName }),
      this.#writeMarkdownTemplate({ employeeFolderPath, fileName: "PROFILE.md", heading: "Profile" }),
      this.#writeMarkdownTemplate({ employeeFolderPath, fileName: "README.md", heading: employeeName }),
      this.#writeMarkdownTemplate({ employeeFolderPath, fileName: "SOP.md", heading: "SOP" }),
      this.#writeMarkdownTemplate({ employeeFolderPath, fileName: "BRAIN.md", heading: "Brain" }),
      this.#writeMarkdownTemplate({ employeeFolderPath, fileName: "SCENARIOS.md", heading: "Scenarios" }),
      this.#writeMarkdownTemplate({ employeeFolderPath, fileName: "prompt.md", heading: "Prompt" }),
      this.#writeRulesJson({ employeeFolderPath }),
    ]);

    // Keep empty dirs in git by creating placeholders.
    await Promise.all([
      this.#writeKeepFile({ employeeFolderPath, folderName: "examples" }),
      this.#writeKeepFile({ employeeFolderPath, folderName: "tests" }),
      this.#writeKeepFile({ employeeFolderPath, folderName: "assets" }),
    ]);

    return { employeeFolderPath, employeeFolderName };
  }

  /**
   * Folder naming convention for the blueprint output.
   * Kept as a single-level folder under `employeesRootPath` to keep discovery simple.
   */
  getEmployeeFolderName({ operatingSystem, department, employeeName }) {
    const osSlug = this.slugify(operatingSystem);
    const deptSlug = this.slugify(department);
    const empSlug = this.slugify(employeeName);
    return `${osSlug}-${deptSlug}-${empSlug}`;
  }

  static defaultSlugify(input) {
    return String(input)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async #writeEmployeeJson({ employeeFolderPath, operatingSystem, department, employeeName }) {
    const employeeJsonPath = path.join(employeeFolderPath, "employee.json");
    const skeleton = EmployeeTemplate.createEmployeeJsonSkeleton({
      name: employeeName,
      department,
      operatingSystem,
    });
    await fs.writeFile(employeeJsonPath, JSON.stringify(skeleton, null, 2) + "\n", "utf8");
  }

  async #writeRulesJson({ employeeFolderPath }) {
    const rulesPath = path.join(employeeFolderPath, "rules.json");
    const skeleton = {
      notes: "Template rules (no business logic generated yet).",
    };
    await fs.writeFile(rulesPath, JSON.stringify(skeleton, null, 2) + "\n", "utf8");
  }

  async #writeMarkdownTemplate({ employeeFolderPath, fileName, heading }) {
    const filePath = path.join(employeeFolderPath, fileName);

    // Heading-only template: no business content.
    const md = `# ${heading}\n`;
    await fs.writeFile(filePath, md, "utf8");
  }

  async #writeKeepFile({ employeeFolderPath, folderName }) {
    const keepPath = path.join(employeeFolderPath, folderName, ".gitkeep");
    await fs.writeFile(keepPath, "", "utf8");
  }
}

