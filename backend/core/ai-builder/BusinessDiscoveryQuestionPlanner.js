import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderQuestion } from "./BuilderQuestion.js";
import { questionMatchesPackageAsk, specializePackageAskQuestion } from "../platform/packages/SalesPackageCatalog.js";
import { planNextResponsibilityQuestions } from "./responsibility/planResponsibilityQuestions.js";

/**
 * Deterministic adaptive question planner.
 * Asks only relevant unanswered questions; never pretends uncertainty is resolved.
 */
export const DISCOVERY_TOPIC_ORDER = Object.freeze([
  "identity",
  "industry",
  "services",
  "customers",
  "operations",
  "team",
  "software",
  "communications",
  "approvals",
  "integrations",
  "pain_points",
  "permissions",
  "outcomes",
  "expansion",
]);

/** Adaptive follow-ups when industry is other — keyed by detected vertical signal. */
export const OTHER_INDUSTRY_SIGNAL_QUESTIONS = Object.freeze({
  campaign: [
    "q_other_campaign_race",
    "q_other_campaign_audiences",
    "q_other_campaign_restrictions",
  ],
  clinic: [
    "q_other_clinic_scheduling",
    "q_other_clinic_intake",
    "q_other_clinic_billing",
  ],
  club: [
    "q_other_club_programs",
    "q_other_club_schedule",
    "q_other_club_families",
  ],
  agency: [
    "q_other_agency_clients",
    "q_other_agency_deliverables",
    "q_other_agency_billing",
  ],
  church: [
    "q_other_faith_community",
    "q_other_faith_events",
    "q_other_faith_outreach",
  ],
  default: [
    "q_other_vertical_shape",
    "q_other_primary_workflow",
    "q_other_communication_priority",
  ],
});

export const DISCOVERY_QUESTION_BANK = Object.freeze([
  createBuilderQuestion({
    questionId: "q_business_understanding",
    prompt: "Tell me about your business. What do you sell, who do you serve, and how does work move through the company today?\n\nYou can type, paste a website URL, or describe what is in documents you will upload.",
    why: "VIBETech learns company identity, services, customers, systems, and constraints before assuming any responsibilities.",
    required: true,
    topic: "identity",
  }),
  createBuilderQuestion({
    questionId: "q_vibetech_responsibilities",
    prompt: "Tell me everything you want VIBETech to take responsibility for. Be very specific: what should happen, when should it happen, and what result should be produced? List as many responsibilities as you want.\n\nExamples:\n• When someone misses a call, text the caller within two minutes.\n• Every Wednesday, find our active listings and prepare a newsletter.\n• Follow up with proposals that have had no reply for five business days.\n• When a lead submits our form, qualify it, assign it and schedule a call.\n• After a job is won, collect the required documents and prepare the handoff.\n• Alert me when a customer request is about to miss its response deadline.",
    why: "You describe outcomes in normal language. VIBETech determines triggers, systems, rules, approvals, and proof — after you confirm what we heard.",
    required: true,
    topic: "identity",
  }),
  // Legacy combined opener — kept so in-flight sessions that answered it still resolve.
  createBuilderQuestion({
    questionId: "q_tell_us",
    prompt: "Describe your business and what you want or need from VIBETech.",
    why: "We tailor every follow-up from what you do and what success looks like for you.",
    required: false,
    topic: "identity",
  }),
  createBuilderQuestion({
    questionId: "q_company_name",
    prompt: "What is the company name?",
    why: "We show this across your home and team invitations.",
    required: true,
    topic: "identity",
  }),
  createBuilderQuestion({
    questionId: "q_website",
    prompt: "Do you have a website we can review? Paste the URL, or say you don’t have one.",
    why: "A website helps VIBETech learn how you present the business.",
    required: true,
    topic: "identity",
  }),
  createBuilderQuestion({
    questionId: "q_industry",
    prompt: "What industry are you in?",
    why: "Type it in your own words — youth hockey, dental practice, landscaping, church, agency, anything. We’ll tailor follow-ups from what you write.",
    required: true,
    topic: "industry",
  }),
  createBuilderQuestion({
    questionId: "q_services",
    prompt: "What services or products do you offer?",
    why: "Services shape the work your team will manage day to day.",
    required: true,
    topic: "services",
  }),
  createBuilderQuestion({
    questionId: "q_customers",
    prompt: "Who are your customers or clients?",
    why: "Knowing who you serve shapes People and follow-up work.",
    required: true,
    topic: "customers",
  }),
  createBuilderQuestion({
    questionId: "q_value_promise",
    prompt: "What outcome do customers hire you for?",
    why: "Your value promise shapes positioning, intake, and what AI teammates prioritize.",
    required: true,
    topic: "services",
  }),
  createBuilderQuestion({
    questionId: "q_locations",
    prompt: "Where do you operate (cities, regions, or online)?",
    why: "Locations help with scheduling, service areas, and reporting.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_team_size",
    prompt: "About how many people work in the business?",
    why: "Team size guides how much oversight the owner needs by default.",
    required: false,
    topic: "team",
  }),
  createBuilderQuestion({
    questionId: "q_roles",
    prompt: "What roles do people have day to day?",
    why: "Roles decide who can see and approve different kinds of work.",
    required: false,
    topic: "team",
  }),
  createBuilderQuestion({
    questionId: "q_software",
    prompt: "List all the software you already use day to day. Examples: Google Calendar, Google Meet, Outlook, Dentrix, Open Dental, QuickBooks, AppFolio, Slack, Facebook Ads — include anything your team lives in.",
    why: "We map these to Connections you can sign into, note what stays external, and avoid promising sync we do not support yet.",
    required: true,
    topic: "software",
  }),
  createBuilderQuestion({
    questionId: "q_repetitive_work",
    prompt: "What work do people repeat every week?",
    why: "That is where VIBETech can take load first.",
    required: true,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_desired_workflows",
    prompt: "What processes do you want automated? List everything, specifically.",
    why: "Each process becomes an automation path — for example: FB lead comes in → email → SMS → update pipeline.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_bottlenecks",
    prompt: "Where does work get stuck today?",
    why: "Bottlenecks decide what Architect fixes first in your operating plan.",
    required: true,
    topic: "pain_points",
  }),
  createBuilderQuestion({
    questionId: "q_approvals",
    prompt: "Which actions should always need a human approval?",
    why: "Approval boundaries keep customer-facing and sensitive actions safe.",
    required: true,
    topic: "approvals",
  }),
  createBuilderQuestion({
    questionId: "q_communications",
    prompt: "How do you communicate with customers today (email, text, phone, Facebook, in person)?",
    why: "Each channel you name becomes a Connection you will sign into before VIBETech can send or call.",
    required: true,
    topic: "communications",
  }),
  createBuilderQuestion({
    questionId: "q_scheduling",
    prompt: "Do you schedule appointments, jobs, practices, or visits?",
    why: "Scheduling needs become calendar work in VIBETech. Google Calendar sync is available today; other calendar apps stay external until we add them.",
    required: true,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_sales",
    prompt: "How do new customers usually find and buy from you?",
    why: "Sales process shapes intake and follow-up work.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_lead_sources",
    prompt: "Where do new leads or opportunities usually come from?",
    why: "Lead sources become intake work and campaign follow-ups.",
    required: true,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_request_sources",
    prompt: "How do customers submit requests (portal, email, phone, walk-in)?",
    why: "Request sources become request types and inbox routing.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_documents",
    prompt: "Do you have documents, SOPs, or spreadsheets that run the business? You can upload them, or describe what you use.",
    why: "Documents become knowledge — nothing changes until you confirm.",
    required: true,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_reporting",
    prompt: "What should owners see on a daily dashboard?",
    why: "Home uses real business data only — never fabricated metrics.",
    required: false,
    topic: "outcomes",
  }),
  createBuilderQuestion({
    questionId: "q_compliance",
    prompt: "Are there compliance, consent, or sensitive-data rules we must respect?",
    why: "Sensitive rules become policies and restricted areas of the portal.",
    required: false,
    topic: "permissions",
  }),
  createBuilderQuestion({
    questionId: "q_integrations",
    prompt: "Which accounts will you connect so VIBETech can operate for you?",
    why: "Owner login is required for every live channel. We never pretend a connection works until you connect it and approve each send or call.",
    required: true,
    topic: "integrations",
    answerType: "multi_choice",
    options: [
      "gmail",
      "google_calendar",
      "twilio_sms",
      "twilio_voice",
      "google_ads",
      "google_search_console",
      "meta_platform",
      "none_yet",
    ],
  }),
  createBuilderQuestion({
    questionId: "q_pain_points",
    prompt: "What is the biggest pain point right now?",
    why: "Pain points decide what Architect prioritizes in the first plan.",
    required: true,
    topic: "pain_points",
  }),
  createBuilderQuestion({
    questionId: "q_desired_outcomes",
    prompt: "What does success look like in the first 30 days?",
    why: "Early goals guide readiness checks and the first work queues.",
    required: true,
    topic: "outcomes",
  }),
  createBuilderQuestion({
    questionId: "q_digital_workforce",
    prompt: "Any specific AI roles you want by name? (optional — otherwise we build from your processes)",
    why: "Skip if your process list already covers it. Pack defaults and your automations still install.",
    required: false,
    topic: "team",
  }),
  createBuilderQuestion({
    questionId: "q_owner_oversight",
    prompt: "How involved should the owner be in day-to-day approvals?",
    why: "Owner oversight shapes approval queues and manager permissions.",
    required: false,
    topic: "permissions",
  }),
  createBuilderQuestion({
    questionId: "q_automation_comfort",
    prompt: "How comfortable are you letting AI handle routine work with human approval?",
    why: "Comfort level sets how assertive AI teammates are by default.",
    required: false,
    topic: "permissions",
  }),
  createBuilderQuestion({
    questionId: "q_expansion_plans",
    prompt: "Are you planning new locations, services, or team growth soon?",
    why: "Expansion plans keep the operating system ready to grow without a rebuild.",
    required: false,
    topic: "expansion",
  }),
  createBuilderQuestion({
    questionId: "q_departments",
    prompt: "Do you organize people into departments or teams?",
    why: "Departments shape role templates and work ownership.",
    required: false,
    topic: "team",
  }),
  // Property / real estate pack
  createBuilderQuestion({
    questionId: "q_property_inquiries",
    prompt: "Where do property or rental inquiries come from, and what should the first reply include?",
    why: "Inquiry routing and approved reply facts keep outreach consistent.",
    required: true,
    topic: "communications",
    whenIndustry: ["property_management"],
  }),
  createBuilderQuestion({
    questionId: "q_property_newsletter",
    prompt: "Do you want a recurring update (like a weekly newsletter) for owners or contacts?",
    why: "Recurring updates become draft campaigns you approve before send.",
    required: true,
    topic: "communications",
    whenIndustry: ["property_management"],
  }),
  createBuilderQuestion({
    questionId: "q_property_units",
    prompt: "How is your portfolio shaped — single-family homes, multi-family, commercial, or mixed?",
    why: "Portfolio shape drives subject records, reporting, and maintenance workflows.",
    required: true,
    topic: "operations",
    whenIndustry: ["property_management"],
  }),
  createBuilderQuestion({
    questionId: "q_property_pms",
    prompt: "Which property management software do you use (AppFolio, Buildium, Yardi, spreadsheets, none)?",
    why: "PMS signals become honest connection guidance — we never fake a live PMS integration.",
    required: true,
    topic: "software",
    whenIndustry: ["property_management"],
  }),
  createBuilderQuestion({
    questionId: "q_property_priorities",
    prompt: "Who needs the fastest response — owners, residents, or prospects?",
    why: "Priority audiences shape routing, SLAs, and approval defaults.",
    required: true,
    topic: "customers",
    whenIndustry: ["property_management"],
  }),
  // Dental pack
  createBuilderQuestion({
    questionId: "q_dental_pms",
    prompt: "Which practice management software do you use (Dentrix, Open Dental, Eaglesoft, other)?",
    why: "PMS context shapes scheduling and patient communication assumptions.",
    required: true,
    topic: "software",
    whenIndustry: ["dental"],
  }),
  createBuilderQuestion({
    questionId: "q_dental_billing",
    prompt: "How does insurance and billing work in your practice?",
    why: "Billing reality keeps Architect honest — we do not install insurance billing automation yet.",
    required: true,
    topic: "operations",
    whenIndustry: ["dental"],
  }),
  createBuilderQuestion({
    questionId: "q_dental_recall",
    prompt: "How do hygiene recall and reactivation work today?",
    why: "Recall cadence becomes follow-up work and campaign drafts you approve.",
    required: true,
    topic: "operations",
    whenIndustry: ["dental"],
  }),
  createBuilderQuestion({
    questionId: "q_dental_appointment_model",
    prompt: "How are chairs and appointments scheduled (online booking, front desk, hybrid)?",
    why: "Appointment model drives calendar needs and intake routing.",
    required: true,
    topic: "operations",
    whenIndustry: ["dental"],
  }),
  createBuilderQuestion({
    questionId: "q_dental_first_reply",
    prompt: "What must a first patient reply include (hours, insurance, next openings)?",
    why: "Approved first-reply facts keep outreach consistent and safe.",
    required: true,
    topic: "communications",
    whenIndustry: ["dental"],
  }),
  // Sports pack
  createBuilderQuestion({
    questionId: "q_sports_teams",
    prompt: "What teams, age groups, or programs do you run?",
    why: "Teams become the subjects of your schedule and roster work.",
    required: true,
    topic: "services",
    whenIndustry: ["sports"],
  }),
  createBuilderQuestion({
    questionId: "q_sports_schedule",
    prompt: "How do practices, games, and tournaments get scheduled — and against whom?",
    why: "This shapes schedule coordination and opponent/facility records.",
    required: true,
    topic: "operations",
    whenIndustry: ["sports"],
  }),
  createBuilderQuestion({
    questionId: "q_sports_fundraising",
    prompt: "Do you run fundraisers or sponsorships? What should VIBETech track?",
    why: "Fundraising becomes campaign work with owner approvals before outreach.",
    required: true,
    topic: "outcomes",
    whenIndustry: ["sports"],
  }),
  createBuilderQuestion({
    questionId: "q_sports_opponents",
    prompt: "How do you track opponents, facilities, and ice/field time?",
    why: "Facilities and opponents become schedule records your team can reference.",
    required: true,
    topic: "operations",
    whenIndustry: ["sports"],
  }),
  createBuilderQuestion({
    questionId: "q_sports_parent_comms",
    prompt: "How do you communicate with parents and players (email, text, app, in person)?",
    why: "Communication norms decide which Connections must be live first.",
    required: true,
    topic: "communications",
    whenIndustry: ["sports"],
  }),
  // Professional services pack
  createBuilderQuestion({
    questionId: "q_proservices_engagement",
    prompt: "How do you structure engagements or matters (retainer, project, ongoing advisory)?",
    why: "Engagement model shapes work types and client records.",
    required: true,
    topic: "services",
    whenIndustry: ["professional_services"],
  }),
  createBuilderQuestion({
    questionId: "q_proservices_billing",
    prompt: "Is work billed by the hour, fixed fee, or a mix?",
    why: "Billing model keeps reporting and follow-up honest.",
    required: true,
    topic: "operations",
    whenIndustry: ["professional_services"],
  }),
  createBuilderQuestion({
    questionId: "q_proservices_intake",
    prompt: "How do new clients enter — referral, website, intake form, conflict check?",
    why: "Intake and conflicts become approval-gated workflows.",
    required: true,
    topic: "operations",
    whenIndustry: ["professional_services"],
  }),
  createBuilderQuestion({
    questionId: "q_proservices_client_comms",
    prompt: "What are your client communication norms (response time, channels, who sends)?",
    why: "Norms become channel requirements and approval policies.",
    required: true,
    topic: "communications",
    whenIndustry: ["professional_services"],
  }),
  createBuilderQuestion({
    questionId: "q_proservices_deliverables",
    prompt: "Which deliverables always need owner or partner approval before send?",
    why: "Deliverable approvals become explicit governance rules.",
    required: true,
    topic: "approvals",
    whenIndustry: ["professional_services"],
  }),
  // Political campaigns pack
  createBuilderQuestion({
    questionId: "q_campaign_race_type",
    prompt: "What race or issue are you running (local, state, federal, ballot measure)?",
    why: "Race type shapes audience records and compliance assumptions.",
    required: true,
    topic: "identity",
    whenIndustry: ["political_campaigns"],
  }),
  createBuilderQuestion({
    questionId: "q_campaign_geography",
    prompt: "What geography does this campaign cover?",
    why: "Geography drives outreach segmentation and scheduling.",
    required: true,
    topic: "operations",
    whenIndustry: ["political_campaigns"],
  }),
  createBuilderQuestion({
    questionId: "q_campaign_audiences",
    prompt: "Who are your primary audiences — voters, volunteers, donors, or all three?",
    why: "Audience mix shapes People records and campaign work.",
    required: true,
    topic: "customers",
    whenIndustry: ["political_campaigns"],
  }),
  createBuilderQuestion({
    questionId: "q_campaign_compliance",
    prompt: "What compliance constraints must we respect (consent, quiet hours, disclaimers)?",
    why: "Compliance becomes policies — we do not automate FEC filing yet.",
    required: true,
    topic: "permissions",
    whenIndustry: ["political_campaigns"],
  }),
  createBuilderQuestion({
    questionId: "q_campaign_channels",
    prompt: "Which channels drive fundraising and GOTV (text, email, phone, events, social)?",
    why: "Channels become required Connections and campaign drafts you approve.",
    required: true,
    topic: "communications",
    whenIndustry: ["political_campaigns"],
  }),
  createBuilderQuestion({
    questionId: "q_campaign_ai_restrictions",
    prompt: "What must AI never say or send on behalf of the campaign?",
    why: "Hard restrictions become prohibited actions in your operating plan.",
    required: true,
    topic: "permissions",
    whenIndustry: ["political_campaigns"],
  }),
  // Other / unknown — adaptive follow-ups (required when industry is other)
  createBuilderQuestion({
    questionId: "q_other_vertical_shape",
    prompt: "Describe how your organization is structured and what you deliver day to day.",
    why: "We adapt the operating plan without pretending your vertical has a packaged runtime.",
    required: true,
    topic: "services",
    whenIndustry: ["other"],
    whenOtherSignal: ["default"],
  }),
  createBuilderQuestion({
    questionId: "q_other_primary_workflow",
    prompt: "What is the main workflow you need help running?",
    why: "Primary workflow decides the first work queues and teammates.",
    required: true,
    topic: "operations",
    whenIndustry: ["other"],
    whenOtherSignal: ["default"],
  }),
  createBuilderQuestion({
    questionId: "q_other_communication_priority",
    prompt: "Which communication channel matters most for your customers or community?",
    why: "Channel priority becomes honest connection requirements.",
    required: true,
    topic: "communications",
    whenIndustry: ["other"],
    whenOtherSignal: ["default"],
  }),
  createBuilderQuestion({
    questionId: "q_other_campaign_race",
    prompt: "What are you campaigning for and who must you reach?",
    why: "Campaign context shapes audience records without a packaged FEC engine.",
    required: true,
    topic: "services",
    whenIndustry: ["other"],
    whenOtherSignal: ["campaign"],
  }),
  createBuilderQuestion({
    questionId: "q_other_campaign_audiences",
    prompt: "Who are your voters, volunteers, and donors — and how do you reach them today?",
    why: "Audience and channel facts become intake and connection requirements.",
    required: true,
    topic: "customers",
    whenIndustry: ["other"],
    whenOtherSignal: ["campaign"],
  }),
  createBuilderQuestion({
    questionId: "q_other_campaign_restrictions",
    prompt: "What must outreach never do (consent rules, quiet hours, forbidden claims)?",
    why: "Restrictions become approval and policy boundaries.",
    required: true,
    topic: "permissions",
    whenIndustry: ["other"],
    whenOtherSignal: ["campaign"],
  }),
  createBuilderQuestion({
    questionId: "q_other_clinic_scheduling",
    prompt: "How do patients book and how are chairs scheduled?",
    why: "Scheduling drives calendar needs and intake routing.",
    required: true,
    topic: "operations",
    whenIndustry: ["other"],
    whenOtherSignal: ["clinic"],
  }),
  createBuilderQuestion({
    questionId: "q_other_clinic_intake",
    prompt: "How do new patients enter and what does the first reply need to include?",
    why: "Intake and first-reply facts keep outreach safe.",
    required: true,
    topic: "communications",
    whenIndustry: ["other"],
    whenOtherSignal: ["clinic"],
  }),
  createBuilderQuestion({
    questionId: "q_other_clinic_billing",
    prompt: "How does billing or insurance work in your clinic?",
    why: "We stay honest about billing automation gaps.",
    required: true,
    topic: "operations",
    whenIndustry: ["other"],
    whenOtherSignal: ["clinic"],
  }),
  createBuilderQuestion({
    questionId: "q_other_club_programs",
    prompt: "What programs, teams, or membership tiers do you run?",
    why: "Programs become the subjects of schedule and roster work.",
    required: true,
    topic: "services",
    whenIndustry: ["other"],
    whenOtherSignal: ["club"],
  }),
  createBuilderQuestion({
    questionId: "q_other_club_schedule",
    prompt: "How are practices, events, or sessions scheduled?",
    why: "Scheduling patterns drive calendar and coordination work.",
    required: true,
    topic: "operations",
    whenIndustry: ["other"],
    whenOtherSignal: ["club"],
  }),
  createBuilderQuestion({
    questionId: "q_other_club_families",
    prompt: "How do you communicate with families, members, or participants?",
    why: "Communication norms decide required Connections.",
    required: true,
    topic: "communications",
    whenIndustry: ["other"],
    whenOtherSignal: ["club"],
  }),
  createBuilderQuestion({
    questionId: "q_other_agency_clients",
    prompt: "Who are your clients and how are accounts organized?",
    why: "Client structure shapes People records and work ownership.",
    required: true,
    topic: "customers",
    whenIndustry: ["other"],
    whenOtherSignal: ["agency"],
  }),
  createBuilderQuestion({
    questionId: "q_other_agency_deliverables",
    prompt: "What deliverables do you produce and who approves them?",
    why: "Deliverable approvals become governance rules.",
    required: true,
    topic: "approvals",
    whenIndustry: ["other"],
    whenOtherSignal: ["agency"],
  }),
  createBuilderQuestion({
    questionId: "q_other_agency_billing",
    prompt: "How do you bill — retainer, hourly, project-based, or mixed?",
    why: "Billing model keeps reporting honest.",
    required: true,
    topic: "operations",
    whenIndustry: ["other"],
    whenOtherSignal: ["agency"],
  }),
  createBuilderQuestion({
    questionId: "q_other_faith_community",
    prompt: "Who is your community and how do people participate?",
    why: "Community shape drives People records and outreach norms.",
    required: true,
    topic: "customers",
    whenIndustry: ["other"],
    whenOtherSignal: ["church"],
  }),
  createBuilderQuestion({
    questionId: "q_other_faith_events",
    prompt: "What events or services repeat on a schedule?",
    why: "Recurring events become calendar and announcement work.",
    required: true,
    topic: "operations",
    whenIndustry: ["other"],
    whenOtherSignal: ["church"],
  }),
  createBuilderQuestion({
    questionId: "q_other_faith_outreach",
    prompt: "How do you reach members and visitors (email, text, social, in person)?",
    why: "Outreach channels become connection requirements.",
    required: true,
    topic: "communications",
    whenIndustry: ["other"],
    whenOtherSignal: ["church"],
  }),
]);

export class BusinessDiscoveryQuestionPlanner {
  plan({
    answers = [],
    evidence = [],
    businessSummary = {},
    limit = 3,
    responsibilityRequests = [],
    responsibilityInventoryConfirmed = false,
  } = {}) {
    const answered = new Set(
      answers
        .filter((entry) => !entry.skipped && !entry.unknown)
        .map((entry) => entry.questionId),
    );
    // Legacy sessions that answered q_tell_us have already covered business understanding.
    if (answered.has("q_tell_us")) {
      answered.add("q_business_understanding");
    }

    const knownTopics = new Set(
      evidence.flatMap((entry) => entry.payload?.topics ?? []),
    );
    const industry = resolveDiscoveryIndustry({ answers, businessSummary });
    const packIndustry = resolvePackIndustry(industry);
    const activeOtherQuestionIds = defaultOtherQuestionIds(packIndustry);

    const purchasedPackages = businessSummary?.purchasedPackages ?? [];
    const packageAsk = Boolean(businessSummary?.packageAsk);
    const packageAskPackages = businessSummary?.packageAskPackages ?? null;
    const matchesScope = (question) => questionMatchesPackageAsk(question, purchasedPackages, {
      packageAsk,
      packageAskPackages,
    });

    // Responsibility-driven spine (non–package-Ask): Q1 → Q2 → pause for review → clarify.
    if (!packageAsk) {
      if (!answered.has("q_business_understanding")) {
        const q1 = DISCOVERY_QUESTION_BANK.find((q) => q.questionId === "q_business_understanding");
        return deepFreeze(q1 ? [q1] : []);
      }
      if (!answered.has("q_vibetech_responsibilities") && !answered.has("q_tell_us")) {
        const q2 = DISCOVERY_QUESTION_BANK.find((q) => q.questionId === "q_vibetech_responsibilities");
        return deepFreeze(q2 ? [q2] : []);
      }
      // After Q2: hard pause until owner confirms responsibility inventory.
      if (
        (answered.has("q_vibetech_responsibilities") || (Array.isArray(responsibilityRequests) && responsibilityRequests.length > 0))
        && !responsibilityInventoryConfirmed
      ) {
        return deepFreeze([]);
      }
      if (responsibilityInventoryConfirmed) {
        const clarifying = planNextResponsibilityQuestions({
          responsibilityRequests,
          answers,
          limit,
        });
        if (clarifying.length) return clarifying;
        // Fall through to remaining required bank only after responsibilities are clarified.
      }
    }

    const requiredQuestions = DISCOVERY_QUESTION_BANK.filter((question) => (
      question.required
      && questionMatchesIndustry(question, packIndustry, activeOtherQuestionIds)
      && matchesScope(question)
      // After inventory confirm, skip the old workflow duplicate.
      && !(responsibilityInventoryConfirmed && question.questionId === "q_desired_workflows")
      // Q1/Q2 already handled above for non-package paths; still required for completeness math.
    ));
    const requiredComplete = requiredQuestions.length > 0
      && requiredQuestions.every((question) => answered.has(question.questionId));
    if (requiredComplete && (!responsibilityInventoryConfirmed || packageAsk)) {
      return deepFreeze([]);
    }
    if (requiredComplete && responsibilityInventoryConfirmed) {
      return deepFreeze([]);
    }

    const substantiveCount = answers.filter((entry) => !entry.skipped && entry.answer != null && String(entry.answer).trim()).length;
    if (substantiveCount >= 28) {
      return deepFreeze([]);
    }

    const remaining = DISCOVERY_QUESTION_BANK.filter((question) => !answered.has(question.questionId))
      .filter((question) => questionMatchesIndustry(question, packIndustry, activeOtherQuestionIds))
      .filter((question) => matchesScope(question))
      .filter((question) => question.required || requiredComplete || packageAsk)
      .filter((question) => {
        if (responsibilityInventoryConfirmed && question.questionId === "q_desired_workflows") return false;
        // Do not re-ask Q1/Q2 via topic bank after responsibility spine.
        if (!packageAsk && (question.questionId === "q_business_understanding" || question.questionId === "q_vibetech_responsibilities")) {
          return false;
        }
        if (!question.required && knownTopics.has(question.topic)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.required !== b.required) return a.required ? -1 : 1;
        return DISCOVERY_TOPIC_ORDER.indexOf(a.topic) - DISCOVERY_TOPIC_ORDER.indexOf(b.topic);
      });

    const sliced = remaining.slice(0, Math.max(1, Number(limit) || 3));
    if (!packageAsk) return deepFreeze(sliced);
    const connectedConnectionIds = businessSummary?.connectedConnectionIds ?? [];
    return deepFreeze(
      sliced
        .map((question) => specializePackageAskQuestion(question, {
          packageAsk: true,
          packageAskPackages: packageAskPackages ?? purchasedPackages,
          connectedConnectionIds,
        }))
        .filter((question) => !question?.skipBecauseConnected),
    );
  }
}

/** Questions shown to every business, regardless of its industry. */
export function isUniversalDiscoveryQuestion(question) {
  return !Array.isArray(question?.whenIndustry) || question.whenIndustry.length === 0;
}

/**
 * Sensible default set of "other" industry follow-ups (see
 * OTHER_INDUSTRY_SIGNAL_QUESTIONS.default) for any industry that resolved to
 * "other" — no vertical-specific inference, just enough tailored follow-ups
 * to keep discovery useful instead of falling back to only universal
 * questions. Returns null for pack industries (dental/sports) since they use
 * their own dedicated questions instead.
 */
export function defaultOtherQuestionIds(packIndustry) {
  if (packIndustry !== "other") return null;
  return new Set(OTHER_INDUSTRY_SIGNAL_QUESTIONS.default);
}

export function questionMatchesIndustry(question, industry, activeOtherQuestionIds = null) {
  if (Array.isArray(question.whenIndustry) && question.whenIndustry.length) {
    if (!industry || !question.whenIndustry.includes(String(industry))) return false;
    if (industry === "other") {
      return activeOtherQuestionIds?.has(question.questionId) ?? false;
    }
  }
  return true;
}

export function detectOtherIndustrySignal({ answers = [], businessSummary = {} } = {}) {
  const text = [
    businessSummary.description,
    businessSummary.businessName,
    ...(answers ?? []).map((entry) => entry.answer),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(campaign|election|voter|pac|political|gotv|ballot)\b/.test(text)) return "campaign";
  if (/\b(clinic|patient|dental|medical|therapy|chiro|hygien)\b/.test(text)) return "clinic";
  if (/\b(club|team|league|tournament|hockey|soccer|travel\s*club)\b/.test(text)) return "club";
  if (/\b(agency|consulting|law\s*firm|accounting\s*firm|marketing\s*agency)\b/.test(text)) return "agency";
  if (/\b(church|parish|ministr|congregation|faith)\b/.test(text)) return "church";
  return "default";
}

export function resolveDiscoveryIndustry({ answers = [], businessSummary = {} } = {}) {
  if (businessSummary?.industry) return String(businessSummary.industry);
  const industryAnswer = answers.find((entry) => entry.questionId === "q_industry" && entry.answer);
  return industryAnswer ? String(industryAnswer.answer) : null;
}

/** Industries with dedicated packs. Everything else uses adaptive "other" follow-ups. */
export const DISCOVERY_PACK_INDUSTRIES = Object.freeze([
  "dental",
  "sports",
]);

export function resolvePackIndustry(industry) {
  const value = String(industry ?? "").toLowerCase().replace(/\s+/g, "_");
  if (!value) return null;
  if (DISCOVERY_PACK_INDUSTRIES.includes(value)) return value;
  return "other";
}

export function estimateDiscoveryQuestionCount({ industry = null } = {}) {
  const coreRequired = DISCOVERY_QUESTION_BANK.filter((question) => (
    question.required && isUniversalDiscoveryQuestion(question)
  )).length;
  const packIndustry = resolvePackIndustry(industry);
  const activeOtherQuestionIds = defaultOtherQuestionIds(packIndustry);
  const packRequired = DISCOVERY_QUESTION_BANK.filter((question) => (
    question.required
    && !isUniversalDiscoveryQuestion(question)
    && questionMatchesIndustry(question, packIndustry, activeOtherQuestionIds)
  )).length;
  const total = coreRequired + packRequired;
  return deepFreeze({
    coreRequired,
    packRequired,
    estimatedTotal: Math.min(28, total),
    progressLabel: `Question N of about ${Math.max(coreRequired, total - 2)}–${Math.min(28, total + 2)}`,
  });
}
