import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Platform capability registry for Business OS compilation.
 * Separates reusable platform capabilities from package feature IDs and vertical manifests.
 */
export const CAPABILITY_AVAILABILITY = Object.freeze({
  SUPPORTED: "supported",
  SUPPORTED_WITH_CONFIGURATION: "supported_with_configuration",
  MISSING_SETUP: "missing_setup",
  MISSING_REUSABLE_CAPABILITY: "missing_reusable_capability",
  PROHIBITED: "prohibited",
  DEFERRED: "deferred",
});

const BUILTIN_CAPABILITIES = deepFreeze([
  { capabilityId: "crm_import", label: "CRM import", availability: "supported", packageFeatureIds: ["crm_import_dry_run", "crm_import_commit"] },
  { capabilityId: "relationship_classification", label: "Relationship classification", availability: "supported", packageFeatureIds: ["relationship_classification"] },
  { capabilityId: "subject_import", label: "Subject / listing import", availability: "supported", packageFeatureIds: ["property_listing_import"] },
  { capabilityId: "subject_party_linkage", label: "Subject–party linkage", availability: "supported", packageFeatureIds: ["person_property_linkage"] },
  { capabilityId: "relationship_follow_up", label: "Relationship follow-up", availability: "supported", packageFeatureIds: ["relationship_follow_up_queue", "relationship_follow_up_work_assignment", "relationship_follow_up_outcome_resolution"] },
  { capabilityId: "knowledge_guided_drafts", label: "Knowledge-guided drafts", availability: "supported", packageFeatureIds: ["knowledge_guided_draft_assistance"] },
  { capabilityId: "relationship_operations_intelligence", label: "Relationship operations intelligence", availability: "supported", packageFeatureIds: ["relationship_operations_intelligence"] },
  { capabilityId: "campaign_preparation", label: "Campaign preparation", availability: "supported", packageFeatureIds: ["recurring_campaign_preparation", "campaign_audience_personalization", "campaign_approval_readiness", "pkg.weekly_newsletter", "pkg.fundraising"] },
  { capabilityId: "campaign_delivery_email", label: "Email campaign delivery", availability: "supported_with_configuration", packageFeatureIds: ["campaign_email_delivery"], setupRequirements: ["business_email"] },
  { capabilityId: "approved_knowledge", label: "Approved knowledge", availability: "supported", packageFeatureIds: [] },
  { capabilityId: "team_assignment", label: "Team assignment", availability: "supported", packageFeatureIds: [] },
  { capabilityId: "work_queue", label: "Work queue", availability: "supported", packageFeatureIds: [] },
  { capabilityId: "digital_workforce", label: "Digital workforce", availability: "supported", packageFeatureIds: [] },
  { capabilityId: "custom_ai_work", label: "Custom AI Worker", availability: "supported", packageFeatureIds: ["pkg.custom_ai_worker"] },
  { capabilityId: "communications_inbox", label: "Communications inbox", availability: "supported", packageFeatureIds: ["pkg.inquiry_reply_drafts"] },
  { capabilityId: "readiness_checklist", label: "Launch readiness", availability: "supported", packageFeatureIds: [] },
  { capabilityId: "referral_attribution", label: "Referral attribution", availability: "supported", packageFeatureIds: [] },
  { capabilityId: "scheduling", label: "Scheduling", availability: "supported_with_configuration", packageFeatureIds: ["pkg.scheduling", "pkg.calendar_sync"], setupRequirements: ["calendar_connection"] },
  { capabilityId: "drill_library", label: "Drill library", availability: "supported_with_configuration", packageFeatureIds: [], notes: "Uses BusinessSubject + Knowledge modules." },
  { capabilityId: "scouting_reports", label: "Scouting reports", availability: "supported_with_configuration", packageFeatureIds: [], notes: "Uses BusinessSubject + Work review." },
  { capabilityId: "sms_messaging", label: "SMS messaging", availability: "supported_with_configuration", packageFeatureIds: ["sms_inquiry_response", "pkg.sms_messaging"], setupRequirements: ["sms_channel"] },
  { capabilityId: "appfolio_api_sync", label: "AppFolio API sync", availability: "deferred", packageFeatureIds: ["appfolio_api_sync"] },
  { capabilityId: "website_form_automation", label: "Website form automation", availability: "deferred", packageFeatureIds: ["website_form_automation"] },
  { capabilityId: "missed_call_automation", label: "Missed-call automation", availability: "supported_with_configuration", packageFeatureIds: ["phone_and_missed_call_automation", "pkg.phone_voice"], setupRequirements: ["voice_channel"] },
  { capabilityId: "meta_lead_ads", label: "Facebook Lead Ads ingest", availability: "supported_with_configuration", packageFeatureIds: ["pkg.facebook_leads"], setupRequirements: ["meta_lead_ads"] },
  { capabilityId: "autonomous_customer_send", label: "Autonomous customer communication without approval", availability: "prohibited", packageFeatureIds: ["pkg.autonomous_customer_email"] },
  { capabilityId: "arbitrary_codegen", label: "Per-customer source code generation", availability: "prohibited", packageFeatureIds: [] },
  { capabilityId: "vertical_core_runtime", label: "Vertical-specific core runtime tables", availability: "prohibited", packageFeatureIds: [] },
]);

export class BusinessOSCapabilityRegistry {
  constructor({ capabilities = BUILTIN_CAPABILITIES } = {}) {
    this._byId = new Map();
    this._byPackageFeature = new Map();
    for (const capability of capabilities) {
      this.register(capability);
    }
  }

  register(capability) {
    const id = String(capability.capabilityId);
    this._byId.set(id, deepFreeze({ ...capability, capabilityId: id }));
    for (const featureId of capability.packageFeatureIds ?? []) {
      this._byPackageFeature.set(String(featureId), id);
    }
    return this._byId.get(id);
  }

  resolve(capabilityId) {
    return this._byId.get(String(capabilityId ?? "")) ?? null;
  }

  resolvePackageFeature(featureId) {
    const capabilityId = this._byPackageFeature.get(String(featureId ?? ""));
    return capabilityId ? this.resolve(capabilityId) : null;
  }

  list() {
    return [...this._byId.values()];
  }

  classifyRequirement(requirement) {
    const capabilityId = requirement?.capabilityId ?? requirement?.id;
    const resolved = this.resolve(capabilityId) ?? this.resolvePackageFeature(capabilityId);
    if (!resolved) {
      return deepFreeze({
        capabilityId: String(capabilityId ?? ""),
        availability: CAPABILITY_AVAILABILITY.MISSING_REUSABLE_CAPABILITY,
        label: requirement?.label ?? String(capabilityId ?? "Unknown need"),
        message: "No reusable platform capability matches this need yet.",
        proposalRequired: true,
      });
    }
    return deepFreeze({
      capabilityId: resolved.capabilityId,
      availability: resolved.availability,
      label: resolved.label,
      setupRequirements: resolved.setupRequirements ?? [],
      packageFeatureIds: resolved.packageFeatureIds ?? [],
      message: resolved.notes ?? null,
      proposalRequired: resolved.availability === CAPABILITY_AVAILABILITY.MISSING_REUSABLE_CAPABILITY,
      prohibited: resolved.availability === CAPABILITY_AVAILABILITY.PROHIBITED,
      deferred: resolved.availability === CAPABILITY_AVAILABILITY.DEFERRED,
    });
  }
}

export function getDefaultBusinessOSCapabilityRegistry() {
  return new BusinessOSCapabilityRegistry();
}
