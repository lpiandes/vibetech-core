import { validateIndustryPackage } from "./IndustryPackageValidator.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { PROFESSIONAL_SERVICES_FIXTURE_PACKAGE } from "../../../industries/fixtures/professional-services/ProfessionalServicesFixturePackage.js";
import { OPERATIONS_FIXTURE_PACKAGE } from "../../../industries/fixtures/operations/OperationsFixturePackage.js";

function fail(message) {
  throw new Error(`IndustryPackageRegistry: ${message}`);
}

const BUILTIN_PACKAGES = [
  PROPERTY_MANAGEMENT_PACKAGE,
  PROFESSIONAL_SERVICES_FIXTURE_PACKAGE,
  OPERATIONS_FIXTURE_PACKAGE,
];

export class IndustryPackageRegistry {
  constructor({ packages } = {}) {
    this._packages = new Map();
    for (const pkg of BUILTIN_PACKAGES) {
      this.register(pkg);
    }
    if (packages && typeof packages === "object") {
      for (const pkg of Object.values(packages)) {
        this.register(pkg);
      }
    }
  }

  register(industryPackage) {
    validateIndustryPackage(industryPackage);
    const id = String(industryPackage.id);
    if (this._packages.has(id)) fail(`duplicate package id: ${id}`);
    this._packages.set(id, industryPackage);
    return industryPackage;
  }

  getPackage(id) {
    return this._packages.get(String(id ?? "")) ?? null;
  }

  listPackages() {
    return [...this._packages.values()];
  }
}

export function getDefaultIndustryPackageRegistry() {
  return new IndustryPackageRegistry();
}

export { PROPERTY_MANAGEMENT_PACKAGE, PROFESSIONAL_SERVICES_FIXTURE_PACKAGE, OPERATIONS_FIXTURE_PACKAGE };
