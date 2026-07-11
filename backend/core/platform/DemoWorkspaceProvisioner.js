import { businessRecordToActivation } from "./persistence/platformMappers.js";
import {
  activateWorkspace,
  PROPERTY_MANAGEMENT_PACKAGE_ID,
  HORIZON_PROPERTIES_DEMO_ID,
} from "../workspace/activation/activateWorkspace.js";
import { buildHorizonPropertiesDemoConfiguration } from "../../../industries/property-management/demo/HorizonPropertiesDemoConfig.js";
import { HORIZON_WORKSPACE_ID, resetHorizonDemoWorkspace } from "../integration/HorizonDemoBootstrapRegistry.js";
import { workspaceActivationRegistry } from "../workspace/activation/WorkspaceActivationRegistry.js";

const HORIZON_DEMO_BUSINESS_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Explicit admin/dev action to create the Horizon Properties DEMO workspace.
 * @param {{ store: object }} deps
 */
export function createDemoWorkspaceProvisioner({ store }) {
  if (!store) throw new Error("createDemoWorkspaceProvisioner requires a platform store");

  async function createHorizonDemoBusiness({ nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    const packageConfiguration = buildHorizonPropertiesDemoConfiguration();
    const workspaceId = HORIZON_WORKSPACE_ID;
    const businessId = HORIZON_DEMO_BUSINESS_ID;

    resetHorizonDemoWorkspace({ workspaceId });
    workspaceActivationRegistry.set(workspaceId, {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      industryPackageVersion: 1,
      demoConfigurationId: HORIZON_PROPERTIES_DEMO_ID,
      packageConfiguration,
      businessKind: "DEMO",
    });

    const existing = await store.getBusinessById(businessId);
    const record =
      existing ??
      (await store.createBusiness({
        id: businessId,
        name: "Horizon Properties",
        kind: "DEMO",
        industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
        industryPackageVersion: 1,
        demoConfigurationId: HORIZON_PROPERTIES_DEMO_ID,
        packageConfiguration,
      }));

    const activation = businessRecordToActivation(record);
    const result = activateWorkspace({
      workspaceId,
      nowISO,
      activation: {
        ...activation,
        industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
        industryPackageVersion: 1,
        demoConfigurationId: HORIZON_PROPERTIES_DEMO_ID,
        packageConfiguration,
        businessKind: "DEMO",
        companyId: record.id,
      },
    });

    return { business: record, activation: result };
  }

  return { createHorizonDemoBusiness };
}
