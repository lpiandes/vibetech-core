import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createCapabilityPackage, presentCapabilityHonestyMatrix } from "./CapabilityPackage.js";

/**
 * In-process registry of Capability Packages (scheduling, newsletters, etc.).
 */
export class CapabilityPackageRegistry {
  constructor() {
    this._byId = new Map();
  }

  register(packageInput, { replace = false } = {}) {
    const pkg = createCapabilityPackage(packageInput);
    if (this._byId.has(pkg.id) && !replace) {
      throw new Error(`CapabilityPackageRegistry: duplicate id ${pkg.id}`);
    }
    this._byId.set(pkg.id, pkg);
    return pkg;
  }

  get(id) {
    return this._byId.get(String(id)) ?? null;
  }

  list({ availability = null, industry = null } = {}) {
    let rows = [...this._byId.values()];
    if (availability) {
      rows = rows.filter((pkg) => pkg.availability === availability);
    }
    if (industry) {
      rows = rows.filter((pkg) => !pkg.industries.length || pkg.industries.includes(String(industry)));
    }
    return deepFreeze(rows);
  }

  honestyMatrix() {
    return presentCapabilityHonestyMatrix(this.list());
  }
}

let defaultRegistry = null;

export function getDefaultCapabilityPackageRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = new CapabilityPackageRegistry();
    registerDefaultCapabilityPackages(defaultRegistry);
  }
  return defaultRegistry;
}

export function resetCapabilityPackageRegistryForTests() {
  defaultRegistry = null;
  return getDefaultCapabilityPackageRegistry();
}

export function registerDefaultCapabilityPackages(registry) {
  const packages = [
    {
      id: "pkg.appointment_setter",
      label: "Lead Appointment Setting",
      description: "Qualify Meta and form leads by SMS, then create calendar holds for team confirmation.",
      industries: [],
      availability: "available",
      setupRequirements: ["meta_lead_ads", "sms_channel", "calendar_connection"],
      discoveryTopics: ["customers", "communications", "operations", "integrations"],
      askCapabilityIds: ["architect.change.enable_sms_messaging", "architect.change.enable_scheduling", "architect.change.enable_facebook_leads"],
      workTypes: ["lead_intake", "appointment_request"],
      modules: ["people", "pipelines", "work", "schedule", "communications"],
      employeeArchetypes: ["appointment_setter"],
      ownerPromise: "Connect Meta Lead Forms, Twilio SMS, and Google Calendar. First-touch texts send automatically to book appointments; STOP ends outreach.",
      neverSilentSend: false,
    },
    {
      id: "pkg.weekly_newsletter",
      label: "Weekly newsletter drafts",
      description: "Recurring update drafts for contacts — owner approves before any send.",
      industries: ["property_management", "professional_services", "sports", "other"],
      availability: "available",
      setupRequirements: ["business_email"],
      discoveryTopics: ["communications", "outcomes"],
      askCapabilityIds: [
        "architect.change.add_campaign",
        "architect.change.enable_weekly_newsletter",
      ],
      workTypes: ["campaign_draft", "newsletter_prepare"],
      modules: ["campaigns", "communications"],
      employeeArchetypes: ["communications"],
      ownerPromise: "VIBETech prepares the draft each week. Connect business email first. Nothing sends until you approve and can edit the draft.",
      neverSilentSend: true,
    },
    {
      id: "pkg.inquiry_reply_drafts",
      label: "Inquiry reply drafts",
      description: "Draft first replies to inquiries using owner-approved facts.",
      industries: ["property_management", "professional_services", "other"],
      availability: "available",
      setupRequirements: [],
      discoveryTopics: ["communications", "customers"],
      askCapabilityIds: ["architect.change.configure_inquiry_replies"],
      workTypes: ["inquiry_response", "lead_response"],
      modules: ["inbox", "people"],
      employeeArchetypes: ["concierge", "communications"],
      ownerPromise: "Replies are drafted for your approval. Auto-send only if you explicitly enable it later.",
      neverSilentSend: true,
    },
    {
      id: "pkg.scheduling",
      label: "Schedule coordination",
      description: "Practices, games, appointments, and visits as governed work — in-app first.",
      industries: ["sports", "property_management", "dental", "professional_services", "other"],
      availability: "available",
      setupRequirements: [],
      discoveryTopics: ["operations", "services"],
      askCapabilityIds: ["architect.change.enable_scheduling"],
      workTypes: ["schedule_coordination", "practice", "game", "appointment"],
      modules: ["schedule", "work"],
      employeeArchetypes: ["scheduler"],
      ownerPromise: "Schedules are proposed as work you can review. Calendar sync is optional setup later.",
      neverSilentSend: true,
    },
    {
      id: "pkg.fundraising",
      label: "Fundraising campaigns",
      description: "Track fundraisers and sponsorship outreach with approvals.",
      industries: ["sports", "other"],
      availability: "available",
      setupRequirements: [],
      discoveryTopics: ["outcomes", "communications"],
      askCapabilityIds: ["architect.change.enable_fundraising"],
      workTypes: ["fundraising_campaign", "outreach_draft"],
      modules: ["campaigns", "work"],
      employeeArchetypes: ["fundraiser"],
      ownerPromise: "Campaigns and outreach drafts need your approval before anyone is contacted.",
      neverSilentSend: true,
    },
    {
      id: "pkg.calendar_sync",
      label: "External calendar sync",
      description: "Publish approved schedules to Google Calendar.",
      industries: [],
      availability: "available",
      setupRequirements: ["calendar_connection"],
      discoveryTopics: ["integrations", "operations"],
      askCapabilityIds: ["architect.change.enable_calendar_sync", "architect.change.enable_scheduling"],
      workTypes: ["schedule_coordination", "appointment"],
      modules: ["schedule"],
      employeeArchetypes: ["scheduler"],
      ownerPromise: "Connect Google Calendar first. Events are created or updated only after you approve.",
      neverSilentSend: true,
    },
    {
      id: "pkg.sms_messaging",
      label: "Text messaging",
      description: "Send approved SMS through your Twilio number.",
      industries: [],
      availability: "available",
      setupRequirements: ["sms_channel"],
      discoveryTopics: ["communications", "integrations"],
      askCapabilityIds: ["architect.change.enable_sms_messaging"],
      workTypes: ["sms_draft", "inquiry_response"],
      modules: ["communications"],
      employeeArchetypes: ["communications"],
      ownerPromise: "Connect Twilio first. Texts are drafted for your approval — nothing sends silently.",
      neverSilentSend: true,
    },
    {
      id: "pkg.phone_voice",
      label: "Phone calling",
      description: "Place approved outbound calls through Twilio Voice.",
      industries: [],
      availability: "available",
      setupRequirements: ["voice_channel"],
      discoveryTopics: ["communications", "integrations"],
      askCapabilityIds: ["architect.change.enable_phone_voice"],
      workTypes: ["call_draft", "missed_call_followup"],
      modules: ["communications"],
      employeeArchetypes: ["ai_caller"],
      ownerPromise: "Connect phone first. Outbound calls need your approval before dialing.",
      neverSilentSend: true,
    },
    {
      id: "pkg.facebook_leads",
      label: "Facebook lead intake",
      description: "Ingest Facebook Lead Ads form submissions into your intake queue.",
      industries: [],
      availability: "available",
      setupRequirements: ["meta_lead_ads"],
      discoveryTopics: ["customers", "integrations"],
      askCapabilityIds: ["architect.change.enable_facebook_leads"],
      workTypes: ["lead_intake"],
      modules: ["people", "inbox"],
      employeeArchetypes: ["facebook_lead_specialist", "intake_specialist"],
      ownerPromise: "Connect Facebook Lead Ads first. Follow-up messages still need your approval.",
      neverSilentSend: true,
    },
    {
      id: "pkg.autonomous_customer_email",
      label: "Silent customer email send",
      description: "Send to customers without approval.",
      industries: [],
      availability: "not_yet",
      setupRequirements: ["business_email", "owner_policy_auto_send"],
      discoveryTopics: [],
      askCapabilityIds: [],
      workTypes: [],
      modules: [],
      employeeArchetypes: [],
      ownerPromise: "Not available. Customer messages always need approval unless you later enable a governed policy.",
      neverSilentSend: true,
    },
    {
      id: "pkg.custom_ai_worker",
      label: "Custom AI Worker",
      description: "Any custom AI teammate can create durable work and artifacts for their job. Outbound never silent-sends.",
      industries: [],
      availability: "available",
      setupRequirements: [],
      discoveryTopics: ["operations", "outcomes", "team"],
      askCapabilityIds: ["architect.change.add_employee"],
      workTypes: ["custom_ai_task"],
      modules: ["work", "digital_workforce"],
      employeeArchetypes: ["operations_coordinator", "coordinator"],
      ownerPromise: "Create any custom AI teammate. They run specialty jobs as Work with your review on anything sent outside VIBETech.",
      neverSilentSend: true,
    },
  ];

  for (const entry of packages) {
    registry.register(entry, { replace: true });
  }
  return registry;
}
