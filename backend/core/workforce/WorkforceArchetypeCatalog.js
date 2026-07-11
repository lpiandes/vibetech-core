import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  BUSINESS_OS_EMPLOYEE_ARCHETYPES,
  getEmployeeArchetype,
  listEmployeeArchetypeIds,
  resolveEmployeeArchetype,
} from "../business-os/BusinessOSEmployeeArchetypes.js";

/**
 * Org templates + AI position picks by industry.
 * Always specialize reusable archetypes — never invent one-off agents.
 */
export const WORKFORCE_ORG_TEMPLATES = deepFreeze({
  property_management: {
    departments: [
      { departmentId: "ops", label: "Operations", purpose: "Day-to-day property operations." },
      { departmentId: "leasing", label: "Leasing & Relationships", purpose: "Prospects, tenants, and owners." },
      { departmentId: "admin", label: "Administration", purpose: "Knowledge, compliance, and reporting." },
    ],
    teams: [
      { teamId: "ops_core", label: "Operations Core", departmentId: "ops" },
      { teamId: "leasing_core", label: "Leasing Core", departmentId: "leasing" },
      { teamId: "owner_office", label: "Owner Office", departmentId: "admin" },
    ],
    humanRoles: [
      { roleId: "owner", label: "Owner", membershipRole: "OWNER", departmentId: "admin", reportsTo: null },
      { roleId: "manager", label: "Property Manager", membershipRole: "MANAGER", departmentId: "ops", reportsTo: "owner" },
      { roleId: "coordinator_human", label: "Office Coordinator", membershipRole: "EMPLOYEE", departmentId: "leasing", reportsTo: "manager" },
    ],
    aiPositions: [
      { archetypeId: "intake_specialist", title: "Prospect Intake Coordinator", departmentId: "leasing", teamId: "leasing_core", reportsTo: "manager" },
      { archetypeId: "follow_up_specialist", title: "Relationship Follow-Up Specialist", departmentId: "leasing", teamId: "leasing_core", reportsTo: "manager" },
      { archetypeId: "operations_monitor", title: "Maintenance Operations Coordinator", departmentId: "ops", teamId: "ops_core", reportsTo: "manager" },
      { archetypeId: "campaign_coordinator", title: "Campaign Coordinator", departmentId: "admin", teamId: "owner_office", reportsTo: "owner" },
      { archetypeId: "executive_assistant", title: "Owner Briefing Assistant", departmentId: "admin", teamId: "owner_office", reportsTo: "owner" },
    ],
  },
  dental: {
    departments: [
      { departmentId: "front_office", label: "Front Office", purpose: "Patients, scheduling, and communications." },
      { departmentId: "clinical", label: "Clinical Support", purpose: "Treatment coordination and notes review." },
      { departmentId: "admin", label: "Practice Administration", purpose: "Compliance, knowledge, and reporting." },
    ],
    teams: [
      { teamId: "front_desk", label: "Front Desk", departmentId: "front_office" },
      { teamId: "care_coord", label: "Care Coordination", departmentId: "clinical" },
      { teamId: "practice_ops", label: "Practice Ops", departmentId: "admin" },
    ],
    humanRoles: [
      { roleId: "owner", label: "Practice Owner", membershipRole: "OWNER", departmentId: "admin", reportsTo: null },
      { roleId: "manager", label: "Office Manager", membershipRole: "MANAGER", departmentId: "front_office", reportsTo: "owner" },
      { roleId: "hygiene_lead", label: "Clinical Lead", membershipRole: "EMPLOYEE", departmentId: "clinical", reportsTo: "manager" },
    ],
    aiPositions: [
      { archetypeId: "intake_specialist", title: "Patient Intake Coordinator", departmentId: "front_office", teamId: "front_desk", reportsTo: "manager" },
      { archetypeId: "scheduler", title: "Appointment Scheduler", departmentId: "front_office", teamId: "front_desk", reportsTo: "manager" },
      { archetypeId: "follow_up_specialist", title: "Treatment Follow-Up Specialist", departmentId: "clinical", teamId: "care_coord", reportsTo: "hygiene_lead" },
      { archetypeId: "reviewer", title: "Clinical Notes Reviewer", departmentId: "clinical", teamId: "care_coord", reportsTo: "hygiene_lead" },
      { archetypeId: "compliance_reviewer", title: "Compliance Reviewer", departmentId: "admin", teamId: "practice_ops", reportsTo: "owner" },
    ],
  },
  sports: {
    departments: [
      { departmentId: "ops", label: "Club Operations", purpose: "Schedule, travel, and logistics." },
      { departmentId: "performance", label: "Performance", purpose: "Practice, scouting, and player development." },
      { departmentId: "admin", label: "Club Administration", purpose: "Parents, knowledge, and reporting." },
    ],
    teams: [
      { teamId: "travel", label: "Travel & Schedule", departmentId: "ops" },
      { teamId: "coaching_support", label: "Coaching Support", departmentId: "performance" },
      { teamId: "front_office", label: "Front Office", departmentId: "admin" },
    ],
    humanRoles: [
      { roleId: "owner", label: "Club Director", membershipRole: "OWNER", departmentId: "admin", reportsTo: null },
      { roleId: "manager", label: "Operations Manager", membershipRole: "MANAGER", departmentId: "ops", reportsTo: "owner" },
      { roleId: "coach", label: "Head Coach", membershipRole: "EMPLOYEE", departmentId: "performance", reportsTo: "owner" },
    ],
    aiPositions: [
      { archetypeId: "scheduler", title: "Scheduling Coordinator", departmentId: "ops", teamId: "travel", reportsTo: "manager" },
      { archetypeId: "coordinator", title: "Travel Coordinator", departmentId: "ops", teamId: "travel", reportsTo: "manager" },
      { archetypeId: "document_specialist", title: "Practice Planning Assistant", departmentId: "performance", teamId: "coaching_support", reportsTo: "coach" },
      { archetypeId: "analyst", title: "Scouting Analyst", departmentId: "performance", teamId: "coaching_support", reportsTo: "coach" },
      { archetypeId: "communications_specialist", title: "Parent Communications Specialist", departmentId: "admin", teamId: "front_office", reportsTo: "owner" },
    ],
  },
  default: {
    departments: [
      { departmentId: "ops", label: "Operations", purpose: "Core day-to-day work." },
      { departmentId: "growth", label: "Customer & Growth", purpose: "Customers, follow-up, and campaigns." },
      { departmentId: "admin", label: "Administration", purpose: "Knowledge, compliance, and reporting." },
    ],
    teams: [
      { teamId: "ops_team", label: "Operations Team", departmentId: "ops" },
      { teamId: "customer_team", label: "Customer Team", departmentId: "growth" },
      { teamId: "owner_office", label: "Owner Office", departmentId: "admin" },
    ],
    humanRoles: [
      { roleId: "owner", label: "Owner", membershipRole: "OWNER", departmentId: "admin", reportsTo: null },
      { roleId: "manager", label: "Manager", membershipRole: "MANAGER", departmentId: "ops", reportsTo: "owner" },
      { roleId: "specialist", label: "Specialist", membershipRole: "EMPLOYEE", departmentId: "growth", reportsTo: "manager" },
    ],
    aiPositions: [
      { archetypeId: "coordinator", title: "Operations Coordinator", departmentId: "ops", teamId: "ops_team", reportsTo: "manager" },
      { archetypeId: "follow_up_specialist", title: "Follow-Up Specialist", departmentId: "growth", teamId: "customer_team", reportsTo: "manager" },
      { archetypeId: "reviewer", title: "Owner Review Specialist", departmentId: "admin", teamId: "owner_office", reportsTo: "owner" },
      { archetypeId: "document_specialist", title: "Knowledge Specialist", departmentId: "admin", teamId: "owner_office", reportsTo: "owner" },
      { archetypeId: "analyst", title: "Performance Analyst", departmentId: "admin", teamId: "owner_office", reportsTo: "owner" },
    ],
  },
});

export function resolveOrgTemplate(industry) {
  const key = String(industry ?? "default");
  return WORKFORCE_ORG_TEMPLATES[key] ?? WORKFORCE_ORG_TEMPLATES.default;
}

export {
  BUSINESS_OS_EMPLOYEE_ARCHETYPES,
  getEmployeeArchetype,
  listEmployeeArchetypeIds,
  resolveEmployeeArchetype,
};
