import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * VIBETech ops playbook for managed Meta + TikTok lead ads → appointment setter.
 * This documents the operator workflow (not an automated pipeline) for standing
 * up lead ads on behalf of a business and wiring them into the SMS appointment
 * setter. Campaign creation stays paused/approval-gated at every step — see
 * MetaAdsIntegrationAdapter#createLeadCampaignScaffold and
 * TikTokLeadAdsIntegrationAdapter for the adapter-level scaffolding this
 * playbook drives.
 *
 * Activation: once the owner has reviewed a paused campaign, activating it
 * can go through either Ads Manager directly, or the adapters' explicit
 * ACTIVATE_AD_CAMPAIGN action — which both adapters refuse unless the caller
 * passes BOTH `ownerApproved: true` AND `confirmActivate: true`. Nothing in
 * this playbook (or the adapters) ever sets those flags automatically.
 */

export const MANAGED_LEAD_ADS_STEPS = deepFreeze([
  {
    id: "collect_offer",
    title: "Collect the offer",
    description: "Confirm what the business is offering (service, price anchor, promo) and who it's for. This becomes the ad copy and the SMS qualifying script.",
    ownerInputRequired: true,
  },
  {
    id: "collect_creatives",
    title: "Collect or draft creatives",
    description: "Gather business photos/video or draft simple creative (image + headline + primary text) for Meta and a vertical video/image for TikTok. Both must include required disclosures (privacy policy link for lead forms).",
    ownerInputRequired: true,
  },
  {
    id: "set_budget",
    title: "Set the budget",
    description: "Confirm a daily budget the owner has approved. VIBETech never activates spend without this explicit approval on record.",
    ownerInputRequired: true,
  },
  {
    id: "launch_meta",
    title: "Launch Meta lead campaign (paused)",
    description: "Use MetaAdsIntegrationAdapter CREATE_EXTERNAL_RECORD (recordType: lead_campaign_scaffold) to create a paused campaign + ad set + lead-form creative referencing the connected Page and lead form.",
    adapter: "meta_ads",
    capability: "CREATE_EXTERNAL_RECORD",
    ownerInputRequired: false,
  },
  {
    id: "launch_tiktok",
    title: "Launch TikTok lead campaign (paused)",
    description: "Use TikTokLeadAdsIntegrationAdapter CREATE_AD_CAMPAIGN to create a paused campaign when platform TikTok Marketing API credentials are configured. Otherwise this step stays manual (managed_ops_required) until VIBETech ops configures credentials.",
    adapter: "tiktok_lead_ads",
    capability: "CREATE_AD_CAMPAIGN",
    ownerInputRequired: false,
  },
  {
    id: "confirm_webhook",
    title: "Confirm lead webhook is live",
    description: "Verify the Meta Page is subscribed to the leadgen webhook and (when configured) the TikTok lead webhook is pointed at the platform. New leads must land in People and fire the appointment-setter automation.",
    ownerInputRequired: false,
  },
  {
    id: "confirm_setter",
    title: "Confirm the SMS appointment setter is wired",
    description: "Confirm Twilio SMS is connected (white-glove provisioning or the owner's own account) and at least one teammate has bookable weekly availability, so a new lead gets an instant qualifying text and a bookable slot.",
    ownerInputRequired: false,
  },
  {
    id: "review_and_activate",
    title: "Owner reviews and activates",
    description: "Owner (or VIBETech ops with owner sign-off) reviews the paused campaigns in Ads Manager / TikTok Ads Manager and activates — either directly in Ads Manager, or via each adapter's ACTIVATE_AD_CAMPAIGN action (capability shared by meta_ads and tiktok_lead_ads), which requires explicit ownerApproved: true AND confirmActivate: true and never flips a campaign to active automatically.",
    ownerInputRequired: true,
  },
]);

export function listManagedLeadAdsSteps() {
  return MANAGED_LEAD_ADS_STEPS;
}

/**
 * Launch-Center-shaped missions for VIBETech ops (internal), mirroring the
 * PlatformCapabilityStatusRegistry mission shape closely enough to render
 * alongside owner-facing missions without a bespoke UI.
 */
export function listManagedLeadAdsMissions({ businessId = null, baseHref = null } = {}) {
  const base = baseHref || (businessId ? `/b/${encodeURIComponent(businessId)}` : "");
  return deepFreeze(
    MANAGED_LEAD_ADS_STEPS.map((step, index) => deepFreeze({
      id: `managed_lead_ads_${step.id}`,
      title: step.title,
      detail: step.description,
      href: base ? `${base}/integrations` : "/integrations",
      ownerInputRequired: step.ownerInputRequired,
      adapter: step.adapter ?? null,
      capability: step.capability ?? null,
      missionIndex: index + 1,
      audience: "vibetech_ops",
    })),
  );
}
