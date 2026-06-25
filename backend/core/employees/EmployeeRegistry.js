import fs from "node:fs/promises";

import { EmployeeLoader } from "./EmployeeLoader.js";

/**
 * EmployeeRegistry keeps track of discovered employees.
 * It does discovery + registration + lookup/listing only.
 *
 * No AI, no providers, no execution.
 */
export class EmployeeRegistry {
  /**
   * @param {object} params
   * @param {string} params.employeesRootPath - Root folder containing employee subfolders.
   * @param {EmployeeLoader} [params.loader]
   */
  constructor({ employeesRootPath, loader = new EmployeeLoader() }) {
    if (!employeesRootPath) {
      throw new Error("employeesRootPath is required.");
    }

    this.employeesRootPath = employeesRootPath;
    this.loader = loader;

    /** @type {Map<string, any>} */
    this.employeesById = new Map();
  }

  /**
   * Discover employees under `employeesRootPath`, load them, and register them.
   * Discovery rules: a folder is considered an employee if it contains `employee.json`.
   *
   * @returns {Promise<void>}
   */
  async discover() {
    const dirents = await fs.readdir(this.employeesRootPath, { withFileTypes: true });

    const candidateDirs = dirents
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const loadPromises = candidateDirs.map(async (folderName) => {
      const employeeFolderPath = `${this.employeesRootPath}/${folderName}`;
      const manifestPath = `${employeeFolderPath}/employee.json`;

      // Fast existence check for discovery.
      try {
        await fs.access(manifestPath);
      } catch {
        return;
      }

      const employee = await this.loader.loadEmployee({ employeeFolderPath, folderName });
      this.registerEmployee(employee);
    });

    await Promise.all(loadPromises);
  }

  /**
   * Register a loaded employee in-memory by ID.
   *
   * @param {any} employee
   */
  registerEmployee(employee) {
    if (!employee || typeof employee !== "object") return;
    if (!employee.id || typeof employee.id !== "string") return;
    this.employeesById.set(employee.id, employee);
  }

  /**
   * Return employee by ID.
   *
   * @param {string} id
   * @returns {any | undefined}
   */
  getById(id) {
    return this.employeesById.get(id);
  }

  /**
   * List available employees.
   * Returns metadata only (no prompts/rules payloads).
   *
   * @returns {Array<{ id: string, name?: string, version?: string, description?: string }>}
   */
  listAvailable() {
    return [...this.employeesById.values()].map((e) => ({
      id: e.id,
      name: e?.manifest?.name,
      version: e?.manifest?.version,
      description: e?.manifest?.description,
    }));
  }
}

import fs from "node:fs/promises";

import { EmployeeLoader } from "./EmployeeLoader.js";

/**
 * EmployeeRegistry keeps track of discovered employees.
 * It does discovery + registration + lookup/listing only.
 *
 * No AI, no providers, no execution.
 */
export class EmployeeRegistry {
  /**
   * @param {object} params
   * @param {string} params.employeesRootPath - Root folder containing employee subfolders.
   * @param {EmployeeLoader} [params.loader]
   */
  constructor({ employeesRootPath, loader = new EmployeeLoader() }) {
    if (!employeesRootPath) {
      throw new Error("employeesRootPath is required.");
    }

    this.employeesRootPath = employeesRootPath;
    this.loader = loader;

    /** @type {Map<string, any>} */
    this.employeesById = new Map();
  }

  /**
   * Discover employees under `employeesRootPath`, load them, and register them.
   * Discovery rules: a folder is considered an employee if it contains `employee.json`.
   *
   * @returns {Promise<void>}
   */
  async discover() {
    const dirents = await fs.readdir(this.employeesRootPath, { withFileTypes: true });

    const candidateDirs = dirents
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    // Load all candidates; registry can be validated later by EmployeeRunner.
    const loadPromises = candidateDirs.map(async (folderName) => {
      const employeeFolderPath = `${this.employeesRootPath}/${folderName}`;
      const manifestPath = `${employeeFolderPath}/employee.json`;

      // Fast existence check for discovery.
      try {
        await fs.access(manifestPath);
      } catch {
        return;
      }

      const employee = await this.loader.loadEmployee({ employeeFolderPath, folderName });
      this.registerEmployee(employee);
    });

    await Promise.all(loadPromises);
  }

  /**
   * Register a loaded employee in-memory by ID.
   *
   * @param {any} employee
   */
  registerEmployee(employee) {
    if (!employee || typeof employee !== "object") return;
    if (!employee.id || typeof employee.id !== "string") return;
    this.employeesById.set(employee.id, employee);
  }

  /**
   * Return employee by ID.
   *
   * @param {string} id
   * @returns {any | undefined}
   */
  getById(id) {
    return this.employeesById.get(id);
  }

  /**
   * List available employees.
   * Returns metadata only (no prompts/rules payloads).
   *
   * @returns {Array<{ id: string, name?: string, version?: string, description?: string }>}
   */
  listAvailable() {
    return [...this.employeesById.values()].map((e) => ({
      id: e.id,
      name: e?.manifest?.name,
      version: e?.manifest?.version,
      description: e?.manifest?.description,
    }));
  }
}

