/**
 * Delivery playbooks for every commercial offer class.
 * A playbook is complete only when steps + acceptanceCriteria are non-empty.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function playbook(id, title, offerClass, steps, acceptanceCriteria, slaNotes = "") {
  return deepFreeze({
    id,
    title,
    offerClass,
    steps: steps.map((s, i) => ({
      id: s.id ?? `step_${i + 1}`,
      label: s.label,
      owner: s.owner ?? "shared",
      required: s.required !== false,
    })),
    acceptanceCriteria: [...acceptanceCriteria],
    slaNotes: String(slaNotes ?? ""),
  });
}

const consultingSteps = [
  { id: "intake", label: "Capture objectives, systems, constraints, success metrics", owner: "shared" },
  { id: "discovery", label: "Run discovery sessions / audits", owner: "vibetech" },
  { id: "findings", label: "Deliver written findings and recommendations", owner: "vibetech" },
  { id: "readout", label: "Executive readout and next-step decision", owner: "shared" },
];

const customFactorySteps = [
  { id: "intake", label: "Structured brief (industry, channels, systems, approvals, SLA)", owner: "shared" },
  { id: "scope", label: "Admin assigns entitlements and soft caps", owner: "vibetech" },
  { id: "architect", label: "Package Ask / Architect produces installable plan", owner: "shared" },
  { id: "install", label: "Install workers and workflows under caps", owner: "vibetech" },
  { id: "prove", label: "Run required prove missions with provider evidence", owner: "shared" },
  { id: "acceptance", label: "Client signs acceptance checklist", owner: "client" },
  { id: "go_live", label: "Approval-gated go-live", owner: "shared" },
  { id: "handoff", label: "Company Rules + operator runbook + optional retainer", owner: "vibetech" },
];

const PLAYBOOKS = deepFreeze({
  consulting_tech_stack: playbook(
    "consulting_tech_stack",
    "Technology Stack Assessment",
    "consulting",
    consultingSteps,
    ["Inventory of systems delivered", "Risk/gap list signed", "Recommended integration sequence"],
    "Delivery within agreed SOW window; platform used only as evidence capture.",
  ),
  consulting_ai_readiness: playbook(
    "consulting_ai_readiness",
    "AI Readiness Assessment",
    "consulting",
    consultingSteps,
    ["Readiness scorecard delivered", "Data/process/people blockers listed", "Pilot recommendation"],
  ),
  consulting_process_review: playbook(
    "consulting_process_review",
    "Business Process Review",
    "consulting",
    consultingSteps,
    ["Current-state process map", "Target operating model", "Automation candidates ranked"],
  ),
  consulting_ai_strategy: playbook(
    "consulting_ai_strategy",
    "AI Strategy and Roadmap",
    "consulting",
    consultingSteps,
    ["12-month roadmap", "Budget bands", "Pilot → scale gates"],
  ),
  consulting_executive: playbook(
    "consulting_executive",
    "Executive AI Consulting",
    "consulting",
    consultingSteps,
    ["Executive brief", "Decision log", "Owner assignments"],
  ),
  consulting_hourly: playbook(
    "consulting_hourly",
    "Hourly Consulting",
    "consulting",
    [
      { id: "scope", label: "Confirm hourly scope and rate", owner: "shared" },
      { id: "work", label: "Deliver advisory hours", owner: "vibetech" },
      { id: "notes", label: "Written notes and action items", owner: "vibetech" },
    ],
    ["Hours logged", "Action items delivered"],
    "$350/hour billed outside app unless otherwise contracted.",
  ),
  consulting_workshop: playbook(
    "consulting_workshop",
    "Custom Workshop or Training",
    "consulting",
    [
      { id: "design", label: "Design agenda and materials", owner: "vibetech" },
      { id: "deliver", label: "Facilitate workshop", owner: "shared" },
      { id: "followup", label: "Send materials and follow-ups", owner: "vibetech" },
    ],
    ["Workshop delivered", "Materials shared", "Follow-up owners named"],
  ),
  custom_build_factory: playbook(
    "custom_build_factory",
    "Custom Build Factory",
    "custom_build",
    customFactorySteps,
    [
      "All required prove missions verified",
      "Sample real case completed with evidence",
      "Approvals and escalation owner named",
      "Go-live approved",
      "Handoff runbook attached",
    ],
    "Nothing customer-facing goes live without acceptance + prove evidence.",
  ),
  managed_rft: playbook(
    "managed_rft",
    "Managed Revenue Follow-Through",
    "ready",
    [
      { id: "connect", label: "Connect email & calendar", owner: "client" },
      { id: "observe", label: "Observe baseline", owner: "vibetech" },
      { id: "confirm", label: "Confirm operating responsibility", owner: "shared" },
      { id: "replay", label: "Replay window", owner: "shared" },
      { id: "shadow", label: "Shadow mode", owner: "vibetech" },
      { id: "prove", label: "Prove connections + sample opportunity", owner: "shared" },
      { id: "go_live", label: "Go live approval-gated", owner: "shared" },
    ],
    [
      "Gmail + Google Calendar connected and proven",
      "Responsibility confirmed",
      "At least one proof-backed outcome path",
      "Exceptions route to a named owner",
    ],
  ),
  sku_ai_receptionist: playbook(
    "sku_ai_receptionist",
    "AI Receptionist",
    "ready",
    customFactorySteps,
    ["Twilio voice proven", "Knowledge cited in test call", "Call notes land in People/Work", "Acceptance signed"],
  ),
  sku_voice_inbound: playbook(
    "sku_voice_inbound",
    "AI Inbound Call Agent custom build",
    "custom_build",
    customFactorySteps,
    ["Inbound script live", "Voice prove passed", "Escalation path tested"],
  ),
  sku_voice_outbound: playbook(
    "sku_voice_outbound",
    "AI Outbound Call Agent custom build",
    "custom_build",
    customFactorySteps,
    ["Approved campaign list", "Outbound GRANT", "Twilio outbound ledger", "Sample call evidenced"],
  ),
  sku_voice_scheduling: playbook(
    "sku_voice_scheduling",
    "Appointment Scheduling Agent custom build",
    "custom_build",
    customFactorySteps,
    ["Calendar connected", "Live slot book proven", "Confirmation path tested"],
  ),
  sku_voice_support: playbook(
    "sku_voice_support",
    "Customer Support Voice Agent custom build",
    "custom_build",
    customFactorySteps,
    ["Knowledge scoped to support", "Voice prove passed", "Ticket/Work routing tested"],
  ),
  sku_voice_custom: playbook(
    "sku_voice_custom",
    "Custom Voice Agent",
    "custom_build",
    customFactorySteps,
    ["SOW intents documented", "Voice + knowledge prove", "Acceptance signed"],
  ),
  sku_lead_qualification: playbook(
    "sku_lead_qualification",
    "AI Lead Qualification",
    "ready",
    customFactorySteps,
    ["Intake source proven", "Qualification rules in Company Rules", "Follow-up draft approval tested"],
  ),
  sku_lead_follow_up: playbook(
    "sku_lead_follow_up",
    "Automated Lead Follow-Up",
    "ready",
    customFactorySteps,
    ["Forms/email/SMS path proven", "Approval gate works", "Outcomes proof-backed"],
  ),
  sku_crm_automation: playbook(
    "sku_crm_automation",
    "CRM Automation (in-platform)",
    "custom_build",
    customFactorySteps,
    ["Contact/work updates proven", "Approval path tested"],
  ),
  sku_sales_assistant: playbook(
    "sku_sales_assistant",
    "AI Sales Assistant",
    "custom_build",
    customFactorySteps,
    ["Knowledge loaded", "Draft outreach approve→send proven"],
  ),
  sku_email_marketing: playbook(
    "sku_email_marketing",
    "Email Marketing Automation",
    "custom_build",
    customFactorySteps,
    ["Template saved", "Prepare & review → approve → send proven"],
  ),
  sku_social_content: playbook(
    "sku_social_content",
    "Social Media Content Automation",
    "custom_build",
    customFactorySteps,
    ["Channel adapters live", "Draft→approve→publish proven"],
  ),
  sku_marketing_content: playbook(
    "sku_marketing_content",
    "Marketing Content Engine",
    "custom_build",
    customFactorySteps,
    ["Content pipeline installed", "Approval gate proven"],
  ),
  sku_sales_analytics: playbook(
    "sku_sales_analytics",
    "Sales Analytics Dashboard",
    "custom_build",
    customFactorySteps,
    ["Dashboard wired to proof-backed outcomes only", "No invented metrics"],
  ),
  sku_support_agent: playbook(
    "sku_support_agent",
    "AI Customer Support Agent",
    "custom_build",
    customFactorySteps,
    ["Knowledge scoped", "Support path proven"],
  ),
  sku_website_forms: playbook(
    "sku_website_forms",
    "Website lead capture (forms)",
    "ready",
    customFactorySteps,
    ["Form embed live", "Lead appears in People", "Prove mission green"],
  ),
  sku_website_native_chat: playbook(
    "sku_website_native_chat",
    "Native Website Chatbot",
    "ready",
    customFactorySteps,
    ["Widget embed live", "Knowledge-backed reply", "Lead capture to People", "Chat prove green"],
  ),
  sku_knowledge_assistant: playbook(
    "sku_knowledge_assistant",
    "Internal Knowledge Base Assistant",
    "ready",
    customFactorySteps,
    ["Knowledge uploaded", "Cite prove passed", "Ask grounded answers verified"],
  ),
  sku_workflow_automation: playbook(
    "sku_workflow_automation",
    "Workflow Automation",
    "custom_build",
    customFactorySteps,
    ["Workflows installed under caps", "Sample run evidenced"],
  ),
  sku_scheduling: playbook(
    "sku_scheduling",
    "Scheduling Automation",
    "custom_build",
    customFactorySteps,
    ["Calendar connected", "Book/HOLD path proven"],
  ),
  sku_document_processing: playbook(
    "sku_document_processing",
    "Document Processing Automation",
    "custom_build",
    customFactorySteps,
    ["Ingest path live", "Structured output to Work/Knowledge proven"],
  ),
  sku_reporting: playbook(
    "sku_reporting",
    "Reporting and Dashboard Automation",
    "custom_build",
    customFactorySteps,
    ["Scheduled digest or dashboard live", "Proof-backed numbers only"],
  ),
  sku_basic_integration: playbook(
    "sku_basic_integration",
    "Basic System Integration",
    "ready",
    customFactorySteps,
    ["Email/calendar/SMS (as scoped) connected and proven"],
  ),
  sku_crm_external: playbook(
    "sku_crm_external",
    "External CRM Integration",
    "custom_build",
    customFactorySteps,
    ["HubSpot or HighLevel sync proven both directions for scoped objects"],
  ),
  sku_multi_system: playbook(
    "sku_multi_system",
    "Multi-System Integration",
    "custom_build",
    customFactorySteps,
    ["Each sold adapter connected and proven", "Failure/escalation path tested"],
  ),
  managed_essential: playbook(
    "managed_essential",
    "Essential Managed Package",
    "managed_ops",
    [
      ...customFactorySteps,
      { id: "retainer", label: "Activate managed-ops retainer SLA", owner: "vibetech" },
    ],
    ["Soft caps enforced", "Prove green", "Weekly ops checklist owner named"],
  ),
  managed_growth: playbook(
    "managed_growth",
    "Growth Managed Package",
    "managed_ops",
    [
      ...customFactorySteps,
      { id: "retainer", label: "Activate managed-ops retainer SLA", owner: "vibetech" },
    ],
    ["Soft caps enforced", "Prove green", "Weekly ops checklist owner named"],
  ),
  managed_professional: playbook(
    "managed_professional",
    "Professional Managed Package",
    "managed_ops",
    [
      ...customFactorySteps,
      { id: "retainer", label: "Activate managed-ops retainer SLA", owner: "vibetech" },
    ],
    ["Entitlements live", "Prove green", "QBR cadence scheduled"],
  ),
  managed_enterprise: playbook(
    "managed_enterprise",
    "Enterprise Managed / Deployment",
    "managed_ops",
    [
      ...customFactorySteps,
      { id: "security", label: "Security/access review", owner: "shared" },
      { id: "retainer", label: "Enterprise SLA active", owner: "vibetech" },
    ],
    ["Security checklist signed", "Prove green", "Named success owner"],
  ),
  managed_custom: playbook(
    "managed_custom",
    "Custom Managed Services",
    "managed_ops",
    [
      { id: "sow", label: "SOW signed", owner: "shared" },
      ...customFactorySteps,
      { id: "retainer", label: "Custom retainer SLA active", owner: "vibetech" },
    ],
    ["SOW scope closed", "Prove/acceptance complete", "Retainer owners named"],
  ),
  addon_agent: playbook(
    "addon_agent",
    "Additional AI Agent",
    "managed_ops",
    [
      { id: "configure", label: "Configure additional worker", owner: "vibetech" },
      { id: "prove", label: "Prove worker path", owner: "shared" },
    ],
    ["Worker live under caps", "Prove evidence saved"],
  ),
  addon_workflow: playbook(
    "addon_workflow",
    "Additional Workflow",
    "managed_ops",
    [
      { id: "install", label: "Install workflow", owner: "vibetech" },
      { id: "prove", label: "Prove sample run", owner: "shared" },
    ],
    ["Workflow live", "Sample run evidenced"],
  ),
  addon_integration: playbook(
    "addon_integration",
    "Additional Integration",
    "managed_ops",
    [
      { id: "connect", label: "Connect integration", owner: "client" },
      { id: "prove", label: "Prove integration", owner: "shared" },
    ],
    ["Connected and proven"],
  ),
  addon_training: playbook(
    "addon_training",
    "AI Employee Training",
    "consulting",
    consultingSteps,
    ["Training curriculum delivered", "Workers updated", "Quiz/readout complete"],
  ),
  addon_prompt_opt: playbook(
    "addon_prompt_opt",
    "Prompt Engineering and Optimization",
    "consulting",
    consultingSteps,
    ["Prompt changes documented", "Before/after sample verified"],
  ),
  addon_dashboard: playbook(
    "addon_dashboard",
    "Executive Dashboard",
    "custom_build",
    customFactorySteps,
    ["Dashboard live", "Proof-backed metrics only"],
  ),
  addon_sales_coaching: playbook(
    "addon_sales_coaching",
    "Sales Coaching and Analytics",
    "consulting",
    consultingSteps,
    ["Coaching cadence set", "Analytics review delivered"],
  ),
  addon_qbr: playbook(
    "addon_qbr",
    "Quarterly Business Review",
    "consulting",
    [
      { id: "prep", label: "Prepare QBR pack from Outcomes evidence", owner: "vibetech" },
      { id: "meeting", label: "Facilitate QBR", owner: "shared" },
      { id: "actions", label: "Publish action list", owner: "vibetech" },
    ],
    ["QBR delivered", "Actions owned"],
  ),
  addon_advisor: playbook(
    "addon_advisor",
    "Dedicated AI Advisor",
    "consulting",
    consultingSteps,
    ["Advisor named", "Cadence active", "Monthly notes delivered"],
  ),
  addon_priority_support: playbook(
    "addon_priority_support",
    "Priority Support",
    "managed_ops",
    [
      { id: "entitle", label: "Enable priority support flag", owner: "vibetech" },
      { id: "contact", label: "Publish contact path in Settings", owner: "vibetech" },
    ],
    ["Flag live", "SLA contact path visible"],
    "Human SLA — not an in-app ticket queue.",
  ),
  usage_voice: playbook("usage_voice", "Voice Minutes Metering", "usage", [
    { id: "meter", label: "Meter inbound/outbound minutes", owner: "vibetech" },
    { id: "surface", label: "Show usage in Settings", owner: "vibetech" },
  ], ["Usage visible", "Overage rate documented"]),
  usage_sms: playbook("usage_sms", "SMS Metering", "usage", [
    { id: "meter", label: "Meter SMS segments", owner: "vibetech" },
    { id: "surface", label: "Show usage in Settings", owner: "vibetech" },
  ], ["Usage visible", "Included 1000 enforced"]),
  usage_email: playbook("usage_email", "Email Metering", "usage", [
    { id: "meter", label: "Meter emails", owner: "vibetech" },
    { id: "surface", label: "Show usage in Settings", owner: "vibetech" },
  ], ["Usage visible"]),
  usage_ai_credits: playbook("usage_ai_credits", "AI Credits Metering", "usage", [
    { id: "meter", label: "Meter AI work credits / Ask usage", owner: "vibetech" },
    { id: "surface", label: "Show usage in Settings", owner: "vibetech" },
  ], ["Usage visible", "Ask quota linked"]),
  usage_api_wallet: playbook("usage_api_wallet", "API Wallet", "usage", [
    { id: "wallet", label: "Track provider spend wallet", owner: "vibetech" },
    { id: "surface", label: "Show wallet in Settings", owner: "vibetech" },
  ], ["Wallet visible", "Margin rule documented"]),
  usage_storage: playbook("usage_storage", "Storage Metering", "usage", [
    { id: "meter", label: "Meter storage GB", owner: "vibetech" },
    { id: "surface", label: "Show usage in Settings", owner: "vibetech" },
  ], ["Usage visible"]),
  usage_users: playbook("usage_users", "Additional Users Metering", "usage", [
    { id: "meter", label: "Count staff users", owner: "vibetech" },
    { id: "surface", label: "Show usage in Settings", owner: "vibetech" },
  ], ["Usage visible"]),
});

export function getPlaybook(id) {
  return PLAYBOOKS[String(id ?? "").trim()] ?? null;
}

export function listPlaybooks() {
  return deepFreeze(Object.values(PLAYBOOKS));
}

export function assertPlaybookComplete(id) {
  const pb = getPlaybook(id);
  if (!pb) return deepFreeze({ ok: false, reason: "missing_playbook" });
  if (!pb.steps?.length) return deepFreeze({ ok: false, reason: "missing_steps" });
  if (!pb.acceptanceCriteria?.length) return deepFreeze({ ok: false, reason: "missing_acceptance" });
  return deepFreeze({ ok: true, playbookId: pb.id });
}

export function listMissingPlaybooksForMatrix(matrixRows = []) {
  const missing = [];
  for (const row of matrixRows) {
    const check = assertPlaybookComplete(row.deliveryPlaybookId);
    if (!check.ok) missing.push({ offerId: row.id, playbookId: row.deliveryPlaybookId, reason: check.reason });
  }
  return deepFreeze(missing);
}
