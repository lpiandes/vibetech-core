import test from "node:test";
import assert from "node:assert/strict";

import {
  packagesMissingDefaultEmployees,
  syncPurchasedPackagesOntoInstallation,
  healPurchasedPackagesForBusiness,
} from "./syncPurchasedPackagesOntoInstallation.js";
import { filterEmployeesForPurchasedPackages } from "./SalesPackageCatalog.js";

test("packagesMissingDefaultEmployees detects social screener gap", () => {
  const receptionist = filterEmployeesForPurchasedPackages([], ["ai_receptionist"]);
  assert.equal(
    packagesMissingDefaultEmployees(receptionist, ["ai_receptionist", "social_background_screening"])
      .includes("social_background_screening"),
    true,
  );
  const both = filterEmployeesForPurchasedPackages(
    [],
    ["ai_receptionist", "social_background_screening"],
  );
  assert.deepEqual(
    packagesMissingDefaultEmployees(both, ["ai_receptionist", "social_background_screening"]),
    [],
  );
});

test("syncPurchasedPackagesOntoInstallation injects social screener and restores pending Ask", async () => {
  const receptionist = filterEmployeesForPurchasedPackages([], ["ai_receptionist"]);
  let saved = null;
  const platformStore = {
    async getBusinessOSInstallation() {
      return {
        id: "install_1",
        businessId: "biz_1",
        specificationId: "spec_1",
        specificationVersion: 1,
        planId: "plan_1",
        status: "installed",
        configuration: {
          purchasedPackages: ["ai_receptionist"],
          employees: receptionist,
        },
        history: [],
      };
    },
    async upsertBusinessOSInstallation(row) {
      saved = row;
      return row;
    },
  };

  const result = await syncPurchasedPackagesOntoInstallation({
    platformStore,
    businessId: "biz_1",
    purchasedPackages: ["ai_receptionist", "social_background_screening"],
    packageConfiguration: {
      purchasedPackages: ["ai_receptionist", "social_background_screening"],
      // pending was wiped by the prior re-save bug
    },
    ensurePendingAsk: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.added, 1);
  assert.deepEqual(result.packagesInjected, ["social_background_screening"]);
  assert.deepEqual(result.pendingPackageAsk?.packages, ["social_background_screening"]);
  assert.equal(
    saved.configuration.employees.some(
      (e) => e.employeeId === "emp_social_background_screener_default",
    ),
    true,
  );
  assert.deepEqual(
    saved.configuration.pendingPackageAsk.packages,
    ["social_background_screening"],
  );
});

test("healPurchasedPackagesForBusiness does not resurrect Ask by default (layout-safe)", async () => {
  const receptionist = filterEmployeesForPurchasedPackages([], ["ai_receptionist"]);
  let businessConfig = {
    purchasedPackages: ["ai_receptionist", "social_background_screening"],
  };
  const platformStore = {
    async getBusinessById() {
      return { id: "biz_1", packageConfiguration: businessConfig };
    },
    async updateBusinessPackageConfiguration({ packageConfiguration }) {
      businessConfig = packageConfiguration;
      return { id: "biz_1", packageConfiguration };
    },
    async getBusinessOSInstallation() {
      return {
        id: "install_1",
        businessId: "biz_1",
        specificationId: "spec_1",
        configuration: {
          purchasedPackages: ["ai_receptionist"],
          employees: receptionist,
        },
        history: [],
      };
    },
    async upsertBusinessOSInstallation(row) {
      return row;
    },
  };

  const heal = await healPurchasedPackagesForBusiness({
    platformStore,
    businessId: "biz_1",
  });
  assert.equal(heal.ok, true);
  assert.equal(heal.added, 1);
  assert.equal(heal.pendingRestored, false);
  assert.equal(businessConfig.pendingPackageAsk, undefined);
});

test("healPurchasedPackagesForBusiness writes pending when ensurePendingAsk is true", async () => {
  const receptionist = filterEmployeesForPurchasedPackages([], ["ai_receptionist"]);
  let businessConfig = {
    purchasedPackages: ["ai_receptionist", "social_background_screening"],
  };
  const platformStore = {
    async getBusinessById() {
      return { id: "biz_1", packageConfiguration: businessConfig };
    },
    async updateBusinessPackageConfiguration({ packageConfiguration }) {
      businessConfig = packageConfiguration;
      return { id: "biz_1", packageConfiguration };
    },
    async getBusinessOSInstallation() {
      return {
        id: "install_1",
        businessId: "biz_1",
        specificationId: "spec_1",
        configuration: {
          purchasedPackages: ["ai_receptionist"],
          employees: receptionist,
        },
        history: [],
      };
    },
    async upsertBusinessOSInstallation(row) {
      return row;
    },
  };

  const heal = await healPurchasedPackagesForBusiness({
    platformStore,
    businessId: "biz_1",
    ensurePendingAsk: true,
  });
  assert.equal(heal.ok, true);
  assert.equal(heal.added, 1);
  assert.equal(heal.pendingRestored, true);
  assert.deepEqual(businessConfig.pendingPackageAsk.packages, ["social_background_screening"]);
});
