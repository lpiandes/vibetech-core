import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Adaptive discovery question catalog.
 * Progressive: first proposal can be produced before every question is answered.
 */
export const DISCOVERY_QUESTION_CATALOG = deepFreeze([
  q("company_name", "company_identity", "What is the business name?", "We use this to label the operating system.", ["businessProfile"], true),
  q("industry", "company_identity", "What industry best describes the business?", "Chooses reusable foundations and terminology.", ["businessProfile", "modules"], true),
  q("services", "products_services", "What products or services does the business offer?", "Shapes modules and request types.", ["businessProfile", "requestDefinitions"], true),
  q("customer_types", "customer_client_types", "Who are the main customers or clients?", "Defines relationship classifications.", ["relationshipDefinitions", "terminology"], true),
  q("important_records", "important_records", "What durable records must the team browse every week?", "Creates owner-relevant workspaces — not one tab per task.", ["modules", "subjectDefinitions", "navigation"], true),
  q("incoming_requests", "incoming_requests", "What kinds of requests come in regularly?", "Maps to request and work types.", ["requestDefinitions", "workDefinitions"], true),
  q("recurring_operations", "recurring_operations", "Which operations repeat weekly or monthly?", "Drives campaigns and recurring work.", ["campaignDefinitions", "workflowDefinitions"], false),
  q("approvals", "work_and_approvals", "What always needs human approval before it goes out?", "Sets governance policies.", ["governancePolicies"], true),
  q("team_roles", "team_roles", "What roles are on the team?", "Shapes assignment and permissions.", ["teamAndAssignmentRules", "permissions"], false),
  q("channels", "communication_channels", "Which communication channels are used today?", "Determines inbox and campaign setup.", ["integrationRequirements", "campaignDefinitions"], true),
  q("scheduling", "scheduling", "Does the business manage appointments, practices, or visits?", "Adds scheduling modules when needed.", ["modules", "capabilityRequirements"], false),
  q("knowledge", "documents_and_knowledge", "What documents should guide drafts and decisions?", "Sets knowledge requirements.", ["knowledgeRequirements"], false),
  q("current_systems", "current_software", "What software is used today?", "Marks integrations as required or deferred.", ["integrationRequirements", "businessProfile"], false),
  q("marketing", "marketing", "Are newsletters or outreach campaigns part of operations?", "Enables campaign preparation when relevant.", ["campaignDefinitions", "capabilityRequirements"], false),
  q("reporting", "reporting", "What should owners see on the home dashboard?", "Selects registered dashboard widgets.", ["dashboardDefinitions"], false),
  q("pain_points", "owner_pain_points", "What slows the owner down most today?", "Prioritizes modules and digital workforce.", ["businessProfile", "employeeDefinitions"], true),
  q("terminology", "terminology", "What words should the product use for people and records?", "Presentation labels only — never new runtimes.", ["terminology"], false),
  q("automation_tolerance", "automation_tolerance", "How much should VIBETech prepare automatically vs wait for approval?", "Keeps human approval as the default for customer messages.", ["governancePolicies"], true),
  q("digital_workforce", "desired_digital_workforce", "Which digital helpers would be most useful?", "Maps to reusable employee archetypes.", ["employeeDefinitions"], false),
  q("launch_priorities", "launch_priorities", "What must work in the first 30 days?", "Separates ready, setup-required, and deferred items.", ["readinessRequirements", "unresolvedRequirements"], true),
  q("website_url", "company_identity", "What is the public website URL, if any?", "Optional research evidence — never treated as unquestionable truth.", ["sourceEvidence", "businessProfile"], false),
  q("compliance", "risks_compliance", "Any compliance or consent concerns we must respect?", "Hardens governance and readiness.", ["governancePolicies", "readinessRequirements"], false),
]);

function q(id, category, prompt, why, affectedSections, requiredForInitialProposal) {
  return {
    questionId: id,
    category,
    prompt,
    why,
    affectedSections,
    requiredForInitialProposal: Boolean(requiredForInitialProposal),
  };
}

export function listDiscoveryQuestions() {
  return DISCOVERY_QUESTION_CATALOG;
}

/**
 * Returns next unanswered questions, prioritizing gaps that block an initial proposal.
 */
export function nextDiscoveryQuestions({ answers = [], limit = 3 } = {}) {
  const answered = new Set(answers.map((entry) => entry.questionId));
  const unanswered = DISCOVERY_QUESTION_CATALOG.filter((question) => !answered.has(question.questionId));
  const required = unanswered.filter((question) => question.requiredForInitialProposal);
  const optional = unanswered.filter((question) => !question.requiredForInitialProposal);
  return deepFreeze([...required, ...optional].slice(0, limit));
}

export function discoveryProgress({ answers = [] } = {}) {
  const answeredIds = new Set(answers.map((entry) => entry.questionId));
  const required = DISCOVERY_QUESTION_CATALOG.filter((question) => question.requiredForInitialProposal);
  const requiredAnswered = required.filter((question) => answeredIds.has(question.questionId));
  return deepFreeze({
    answeredCount: answeredIds.size,
    totalCount: DISCOVERY_QUESTION_CATALOG.length,
    requiredAnswered: requiredAnswered.length,
    requiredTotal: required.length,
    readyForInitialProposal: requiredAnswered.length >= Math.min(5, required.length),
    confidence: answers.length
      ? Number((answers.reduce((sum, entry) => sum + Number(entry.confidence ?? 0.5), 0) / answers.length).toFixed(2))
      : 0,
  });
}
