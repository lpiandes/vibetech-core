import crypto from "node:crypto";

import { businessRecordToActivation } from "../persistence/platformMappers.js";
import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../../workspace/activation/activateWorkspace.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { workspaceActivationRegistry } from "../../workspace/activation/WorkspaceActivationRegistry.js";
import { MEMBERSHIP_ROLES } from "../permissions/rolePermissions.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

/**
 * Provision empty runtime workspace for a business record.
 */
export function provisionEmptyBusinessWorkspace(business) {
  const activation = businessRecordToActivation(business);
  workspaceActivationRegistry.set(business.id, activation);
  activateWorkspace({
    workspaceId: business.id,
    nowISO: NOW_ISO,
    activation,
  });
  return activation;
}

/**
 * @param {{ store: object, createAndDeliverInvitation: Function }} deps
 */
export function createPlatformBusinessService({ store, createAndDeliverInvitation }) {
  if (!store) throw new Error("createPlatformBusinessService requires a platform store");
  if (typeof createAndDeliverInvitation !== "function") {
    throw new Error("createPlatformBusinessService requires createAndDeliverInvitation");
  }

  async function createBusinessWithOwnerInvite({
    name,
    ownerEmail,
    createdByUserId,
    industryPackageId = PROPERTY_MANAGEMENT_PACKAGE_ID,
  }) {
    const businessId = crypto.randomUUID();
    const businessName = String(name).trim() || "New Business";
    const packageConfiguration = buildEmptyPropertyManagementConfiguration({
      companyName: businessName,
      workspaceId: businessId,
    });

    const business = await store.createBusiness({
      id: businessId,
      name: businessName,
      kind: "NORMAL",
      industryPackageId,
      industryPackageVersion: 1,
      packageConfiguration,
    });

    provisionEmptyBusinessWorkspace(business);

    const invite = await createAndDeliverInvitation({
      businessId: business.id,
      email: ownerEmail,
      role: MEMBERSHIP_ROLES.OWNER,
      invitedByUserId: createdByUserId,
      businessName: business.name,
    });

    await store.recordAuditEvent({
      actorUserId: createdByUserId,
      businessId: business.id,
      action: "business.created",
      targetType: "business",
      targetId: business.id,
      metadata: { name: business.name, ownerEmail },
    });

    return { business, invitation: invite };
  }

  return {
    provisionEmptyBusinessWorkspace,
    createBusinessWithOwnerInvite,
  };
}
