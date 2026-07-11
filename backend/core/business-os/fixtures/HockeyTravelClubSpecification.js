import { createBusinessOSSpecification } from "../BusinessOSSpecification.js";

const NOW = "2026-07-10T20:00:00.000Z";

/**
 * Non-real-estate proof blueprint: hockey travel club.
 * Uses BusinessSubject for durable entities; no hockey-specific core runtimes.
 */
export function createHockeyTravelClubSpecification({
  businessId = null,
  generatedAt = NOW,
} = {}) {
  const modules = [
    module("home", "Home", "operations", 1, ["readiness_checklist", "work_queue"]),
    module("teams", "Teams", "records", 2, ["subject_import"], { subjectTypes: ["team"] }),
    module("players", "Players", "records", 3, ["crm_import", "relationship_classification"], { subjectTypes: ["player"] }),
    module("schedule", "Schedule", "planning", 4, ["scheduling"], {
      secondaryNavigationItems: [
        { id: "sec_games", label: "Games" },
        { id: "sec_travel", label: "Travel" },
      ],
    }),
    module("practices", "Practices", "planning", 5, ["scheduling"], { subjectTypes: ["practice"] }),
    module("drills", "Drill Library", "knowledge", 6, ["drill_library", "approved_knowledge"], { subjectTypes: ["drill"] }),
    module("scouting", "Scouting Reports", "records", 7, ["scouting_reports"], { subjectTypes: ["scouting_report"] }),
    module("work", "Work Queue", "operations", 8, ["work_queue"]),
    module("digital_workforce", "Digital Workforce", "workforce", 9, ["digital_workforce", "team_assignment"]),
    module("knowledge", "Knowledge", "knowledge", 10, ["approved_knowledge"]),
    module("reports", "Reports", "analytics", 11, ["relationship_operations_intelligence"]),
    module("settings", "Settings", "configuration", 12, []),
  ];

  return createBusinessOSSpecification({
    specificationId: "bos_fixture_hockey_travel_club",
    specificationVersion: 1,
    businessId,
    status: "proposed",
    generatedAt,
    businessProfile: {
      businessName: "Northline Travel Hockey Club",
      industry: "sports",
      subIndustry: "youth_travel_hockey",
      businessModel: "club_operations_and_player_development",
      services: ["team_management", "practice_planning", "travel_scheduling", "scouting", "parent_communication"],
      customerTypes: ["player", "parent", "coach", "scout"],
      channels: ["email", "inbox"],
      goals: ["organized schedules", "shared drill library", "clear scouting follow-up"],
      painPoints: ["scattered schedules", "inconsistent drill reuse", "manual scouting follow-up"],
      terminologyPreferences: {
        BusinessSubject: "Team asset",
        Party: "Player or parent",
        Work: "Club work",
      },
    },
    terminology: {
      operatingSystemTitle: "Hockey Club Operating System",
      presentation: {
        BusinessSubject: "Club record",
        Party: "Person",
        Work: "Club work",
        Request: "Club request",
        team: "Team",
        player: "Player",
        practice: "Practice",
        drill: "Drill",
        scouting_report: "Scouting report",
      },
    },
    modules,
    navigation: {
      primaryItems: modules
        .filter((entry) => entry.primaryNavigationEligible)
        .map((entry) => ({ moduleId: entry.moduleId, label: entry.label })),
      secondaryItemsByModule: {
        schedule: [
          { id: "sec_games", label: "Games" },
          { id: "sec_travel", label: "Travel" },
        ],
      },
      utilityItems: [],
      roleOverrides: {
        coach: {
          primaryItems: [
            { moduleId: "home", label: "Home" },
            { moduleId: "practices", label: "Practices" },
            { moduleId: "drills", label: "Drill Library" },
            { moduleId: "players", label: "Players" },
            { moduleId: "work", label: "Work Queue" },
          ],
        },
      },
      maximumPrimaryItems: 8,
      overflowBehavior: "more",
    },
    subjectDefinitions: [
      { subjectType: "team", label: "Team", keyAttributes: ["name", "ageGroup"] },
      { subjectType: "player", label: "Player", keyAttributes: ["displayName", "position"] },
      { subjectType: "practice", label: "Practice", keyAttributes: ["date", "location"] },
      { subjectType: "drill", label: "Drill", keyAttributes: ["name", "skillFocus"] },
      { subjectType: "scouting_report", label: "Scouting report", keyAttributes: ["opponent", "date"] },
    ],
    relationshipDefinitions: [
      { relationshipType: "PLAYER", label: "Player" },
      { relationshipType: "PARENT", label: "Parent" },
      { relationshipType: "COACH", label: "Coach" },
      { relationshipType: "SCOUT", label: "Scout" },
      { relationshipType: "MEMBER_OF", label: "Member of team" },
    ],
    requestDefinitions: [
      { requestType: "TRAVEL_QUESTION", label: "Travel question" },
      { requestType: "PRACTICE_CHANGE", label: "Practice change" },
      { requestType: "SCOUTING_FOLLOW_UP", label: "Scouting follow-up" },
    ],
    workDefinitions: [
      { workType: "schedule_coordination", label: "Schedule coordination" },
      { workType: "practice_prep", label: "Practice prep" },
      { workType: "scouting_follow_up", label: "Scouting follow-up" },
      { workType: "parent_communication_review", label: "Parent communication review" },
    ],
    workflowDefinitions: [
      { workflowId: "practice_prep_loop", label: "Practice preparation" },
      { workflowId: "scouting_follow_up_loop", label: "Scouting follow-up" },
    ],
    employeeDefinitions: [
      {
        employeeId: "hockey_schedule_coordinator",
        label: "Schedule Coordinator",
        archetypeId: "scheduler",
        purpose: "Coordinate games, travel, and practice timing.",
        capabilities: ["scheduling"],
        applicableModules: ["schedule", "practices", "work"],
        acceptedWorkTypes: ["schedule_coordination"],
        communicationPermissions: { customerFacingRequiresApproval: true },
        approvalRequirements: ["human_approval"],
      },
      {
        employeeId: "hockey_practice_planner",
        label: "Practice Planner",
        archetypeId: "document_specialist",
        purpose: "Assemble practice plans from the drill library.",
        capabilities: ["drill_library", "approved_knowledge"],
        applicableModules: ["practices", "drills", "knowledge"],
        acceptedWorkTypes: ["practice_prep"],
        communicationPermissions: { customerFacingRequiresApproval: true },
      },
      {
        employeeId: "hockey_scouting_analyst",
        label: "Scouting Analyst",
        archetypeId: "analyst",
        purpose: "Summarize scouting reports and recommend follow-up.",
        capabilities: ["scouting_reports"],
        applicableModules: ["scouting", "reports", "work"],
        acceptedWorkTypes: ["scouting_follow_up"],
        communicationPermissions: { customerFacingRequiresApproval: true },
      },
      {
        employeeId: "hockey_player_development",
        label: "Player Development Coordinator",
        archetypeId: "coordinator",
        purpose: "Track player development plans and practice focus areas.",
        capabilities: ["drill_library", "approved_knowledge"],
        applicableModules: ["players", "practices", "drills", "work"],
        acceptedWorkTypes: ["practice_prep"],
        communicationPermissions: { customerFacingRequiresApproval: true },
      },
      {
        employeeId: "hockey_travel_coordinator",
        label: "Travel Coordinator",
        archetypeId: "scheduler",
        purpose: "Coordinate travel logistics for games and tournaments.",
        capabilities: ["scheduling"],
        applicableModules: ["schedule", "work"],
        acceptedWorkTypes: ["schedule_coordination"],
        communicationPermissions: { customerFacingRequiresApproval: true },
      },
    ],
    dashboardDefinitions: [
      {
        dashboardId: "club_home",
        label: "Club home",
        widgets: [
          { id: "w_attention", componentType: "attention_queue", dataSource: "attention", label: "Needs attention" },
          { id: "w_calendar", componentType: "calendar_deadlines", dataSource: "calendar", label: "Upcoming schedule" },
          { id: "w_work", componentType: "work_queue", dataSource: "work", label: "Club work" },
          { id: "w_workforce", componentType: "digital_workforce", dataSource: "workforce", label: "Digital workforce" },
        ],
      },
      {
        dashboardId: "club_reports",
        label: "Reports",
        widgets: [
          { id: "w_metrics", componentType: "metric_cards", dataSource: "metrics", label: "Club metrics" },
          { id: "w_subjects", componentType: "subject_summaries", dataSource: "subjects", label: "Teams and players" },
          { id: "w_charts", componentType: "charts", dataSource: "analytics", label: "Trends" },
        ],
      },
    ],
    campaignDefinitions: [],
    knowledgeRequirements: [
      { categoryId: "HOCKEY_DRILLS", required: true },
      { categoryId: "HOCKEY_TRAVEL_POLICIES", required: true },
    ],
    integrationRequirements: [
      { integrationId: "business_email", label: "Business email", status: "required" },
      { integrationId: "calendar", label: "Calendar", status: "required" },
    ],
    teamAndAssignmentRules: {
      approvalRequiredBeforeWorkCreation: true,
      customerFacingRequiresApproval: true,
    },
    permissions: [
      { permissionId: "work.view", label: "View work" },
      { permissionId: "people.view", label: "View people" },
      { permissionId: "team.manage", label: "Manage team" },
    ],
    roleDefinitions: [
      {
        roleId: "club_owner",
        label: "Club Owner",
        membershipRole: "OWNER",
        moduleVisibility: modules.map((entry) => entry.moduleId),
        permissions: ["*"],
      },
      {
        roleId: "director",
        label: "Director",
        membershipRole: "ADMIN",
        moduleVisibility: modules.map((entry) => entry.moduleId),
        permissions: ["work.view", "work.manage", "people.view", "team.manage", "performance.view"],
      },
      {
        roleId: "head_coach",
        label: "Head Coach",
        membershipRole: "MANAGER",
        moduleVisibility: ["home", "teams", "players", "schedule", "practices", "drills", "scouting", "work", "knowledge"],
        permissions: ["work.view", "work.manage", "people.view"],
      },
      {
        roleId: "assistant_coach",
        label: "Assistant Coach",
        membershipRole: "EMPLOYEE",
        moduleVisibility: ["home", "practices", "drills", "players", "work"],
        permissions: ["work.view", "people.view"],
      },
      {
        roleId: "team_manager",
        label: "Team Manager",
        membershipRole: "MANAGER",
        moduleVisibility: ["home", "teams", "players", "schedule", "work", "knowledge"],
        permissions: ["work.view", "people.view", "inbox.view"],
      },
      {
        roleId: "scout",
        label: "Scout",
        membershipRole: "EMPLOYEE",
        moduleVisibility: ["home", "scouting", "players", "work"],
        permissions: ["work.view", "people.view"],
      },
      {
        roleId: "player_parent",
        label: "Player / Parent",
        membershipRole: "VIEWER",
        moduleVisibility: ["home", "schedule", "knowledge"],
        permissions: ["work.view"],
        limited: true,
      },
    ],
    accessRequestPolicies: [
      {
        policyId: "hockey_module_access_request",
        requestKinds: ["module_access", "role_upgrade", "temporary_access"],
        requiresApproval: true,
        autoApprove: false,
        approverRoles: ["OWNER", "ADMIN"],
      },
    ],
    teamDefinitions: [
      { teamId: "coaching", label: "Coaching staff", roleIds: ["head_coach", "assistant_coach"] },
      { teamId: "scouting", label: "Scouting", roleIds: ["scout"] },
    ],
    source: { kind: "fixture", fixtureId: "hockey_travel_club" },
    provenance: { fixture: "hockey_travel_club", gold: false },
    assumptions: [
      { id: "no_hockey_runtime", text: "Teams, players, drills, and scouting reports use BusinessSubject — no HockeyRuntime." },
    ],
    capabilityGaps: [],
    governancePolicies: [
      { policyId: "human_approval_parent_comms", label: "Parent-facing messages require approval", enforced: true },
    ],
    readinessRequirements: [
      { requirementId: "teams_loaded", label: "Teams recorded", requiredForLaunch: true },
      { requirementId: "players_loaded", label: "Players recorded", requiredForLaunch: true },
      { requirementId: "drill_library", label: "Drill library started", requiredForLaunch: true },
    ],
    capabilityRequirements: [
      { capabilityId: "work_queue" },
      { capabilityId: "digital_workforce" },
      { capabilityId: "approved_knowledge" },
      { capabilityId: "scheduling" },
      { capabilityId: "drill_library" },
      { capabilityId: "scouting_reports" },
      { capabilityId: "crm_import" },
      { capabilityId: "subject_import" },
    ],
    unresolvedRequirements: [
      { id: "travel_vendor_booking", question: "Should travel booking connect to an external vendor later?" },
    ],
    sourceEvidence: [
      { evidenceId: "fixture", kind: "fixture", ref: "hockey_travel_club" },
    ],
    metadata: {
      fixture: true,
      verticalProof: "hockey_travel_club",
    },
  });
}

function module(moduleId, label, moduleType, navigationPriority, capabilityIds, extra = {}) {
  return {
    moduleId,
    label,
    description: label,
    moduleType,
    capabilityIds,
    primaryNavigationEligible: moduleId !== "settings",
    navigationPriority,
    roleVisibility: [],
    primaryActions: [],
    emptyState: `No ${label.toLowerCase()} yet.`,
    ...extra,
  };
}
