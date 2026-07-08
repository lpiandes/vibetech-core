/**
 * Demo company configuration — NOT the reusable package default.
 * Horizon Properties is a deterministic Property Management workspace fixture.
 */
export function buildHorizonPropertiesDemoConfiguration() {
  return {
    companyName: "Horizon Properties",
    workspaceId: "ws_horizon_properties",
    portfolioType: "residential_multifamily",
    operatingRegions: ["Hartford, CT"],
    businessHours: "Mon-Fri 9am-6pm ET",
    humanTeamMembers: [
      { id: "tm_leasing", name: "Alex Morgan", role: "Leasing Manager" },
      { id: "tm_maintenance", name: "Jordan Lee", role: "Maintenance Lead" },
      { id: "tm_owner_relations", name: "Sam Patel", role: "Owner Relations" },
    ],
    digitalEmployeesEnabled: [
      "pm_resident_prospect_coordinator",
      "pm_maintenance_coordinator",
      "pm_owner_success_coordinator",
    ],
    approvalRoles: [{ id: "role_property_manager", displayName: "Property Manager" }],
    communicationChannels: {
      email: { status: "connected", senderIdentity: "leasing@horizonproperties.example" },
      sms: { status: "not_connected" },
      voice: { status: "not_connected" },
    },
    automationAssignedTo: {
      prospect: "tm_leasing",
      showing: "tm_leasing",
      maintenance: "tm_maintenance",
      owner: "tm_owner_relations",
      vendor: "tm_maintenance",
    },
  };
}
