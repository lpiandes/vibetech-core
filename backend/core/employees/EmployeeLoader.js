import fs from "node:fs/promises";
import path from "node:path";

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

export class EmployeeLoader {
  /**
   * Load and assemble a complete Employee object from a folder.
   * No AI/provider execution occurs here; this is strictly filesystem IO.
   *
   * @param {object} params
   * @param {string} params.employeeFolderPath - Absolute folder path containing employee artifacts.
   * @param {string} params.folderName - Folder name (used for stable ID by default).
   * @returns {Promise<Employee>}
   */
  async loadEmployee({ employeeFolderPath, folderName }) {
    const manifestPath = path.join(employeeFolderPath, "employee.json");
    const promptPath = path.join(employeeFolderPath, "prompt.md");
    const rulesPath = path.join(employeeFolderPath, "rules.json");

    const [manifestRaw, promptRaw, rulesRaw] = await Promise.all([
      fs.readFile(manifestPath, "utf8"),
      fs.readFile(promptPath, "utf8"),
      fs.readFile(rulesPath, "utf8"),
    ]);

    /** @type {any} */
    const parsedManifest = JSON.parse(manifestRaw);

    // Backward compatibility + contract normalization:
    // - `tools` is the legacy name; we normalize it to `capabilities`
    // - `version` is treated as `employeeVersion` when `employeeVersion` is absent
    const manifest = { ...parsedManifest };
    if (!manifest.capabilities && Array.isArray(manifest.tools)) {
      manifest.capabilities = manifest.tools;
    }
    if (!manifest.employeeVersion && typeof manifest.version === "string") {
      manifest.employeeVersion = manifest.version;
    }
    const prompt = promptRaw;
    const rules = JSON.parse(rulesRaw);

    const id =
      typeof manifest.id === "string" && manifest.id.trim() !== ""
        ? manifest.id.trim()
        : folderName;

    return {
      id,
      folderName,
      manifest,
      prompt,
      rules,
    };
  }
}

