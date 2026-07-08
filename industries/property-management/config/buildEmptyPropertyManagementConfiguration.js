/**
 * Empty Property Management package configuration for normal business onboarding.
 * Installs capabilities, templates, and terminology — not demo business facts.
 */
export function buildEmptyPropertyManagementConfiguration({
  companyName = "New Business",
  workspaceId,
} = {}) {
  return {
    companyName: String(companyName),
    workspaceId: workspaceId ? String(workspaceId) : undefined,
    portfolioType: null,
    operatingRegions: [],
    businessHours: null,
    humanTeamMembers: [],
    digitalEmployeesEnabled: [
      "pm_resident_prospect_coordinator",
      "pm_maintenance_coordinator",
      "pm_owner_success_coordinator",
    ],
    approvalRoles: [],
    communicationChannels: {
      email: { status: "not_connected" },
      sms: { status: "not_connected" },
      voice: { status: "not_connected" },
    },
    automationAssignedTo: {
      prospect: "unassigned",
      showing: "unassigned",
      maintenance: "unassigned",
      owner: "unassigned",
      vendor: "unassigned",
    },
  };
}
