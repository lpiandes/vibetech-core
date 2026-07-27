/**
 * Cross-tenant platform exceptions — only what needs a VIBETech human.
 * Happy-path A2P carrier wait stays owner-visible in Integrations / Launch — not this queue.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * @param {{
 *   businesses?: object[],
 *   listCredentials?: (businessId: string) => Promise<object[]>,
 *   failedInstalls?: object[],
 *   trustHubConfigured?: boolean,
 * }} input
 */
export async function buildOperatorActions({
  businesses = [],
  listCredentials = async () => [],
  failedInstalls = [],
  trustHubConfigured = Boolean(
    String(process.env.TWILIO_A2P_CUSTOMER_PROFILE_SID || "").trim()
    && String(process.env.TWILIO_A2P_PROFILE_BUNDLE_SID || "").trim(),
  ),
} = {}) {
  const actions = [];

  for (const business of Array.isArray(businesses) ? businesses : []) {
    const businessId = String(business?.id ?? "");
    const businessName = String(business?.name ?? "Business");
    if (!businessId) continue;

    let credentials = [];
    try {
      credentials = await listCredentials(businessId);
    } catch {
      credentials = [];
    }

    const smsCred = (Array.isArray(credentials) ? credentials : []).find((row) => {
      const provider = String(row?.providerType ?? "").toLowerCase();
      return provider === "twilio_sms" || provider.startsWith("twilio_sms");
    });

    if (smsCred) {
      const meta = smsCred.metadata && typeof smsCred.metadata === "object" ? smsCred.metadata : {};
      const a2p = String(meta.a2pRegistrationStatus ?? meta.brand?.a2pRegistrationStatus ?? "pending").toLowerCase();
      const provisioned = meta.provisionedBy === "platform" || Boolean(meta.brand);
      if (provisioned && a2p !== "complete" && a2p !== "approved") {
        const brand = meta.brand && typeof meta.brand === "object" ? meta.brand : {};
        const brandSubmitted = Boolean(meta.brandRegistrationSid || brand.brandRegistrationSid);
        const brandFieldsOk = Boolean(
          String(brand.legalBusinessName || "").trim() && String(brand.ein || "").trim(),
        );
        const failed = a2p === "failed" || a2p === "rejected";
        const platformMisconfig = !trustHubConfigured && !brandSubmitted;
        const needsException = failed || platformMisconfig || !brandFieldsOk;

        // Carrier-pending after auto-submit with complete brand → owner waits; not a platform queue item.
        if (needsException) {
          actions.push(buildA2pAction({
            businessId,
            businessName,
            fromNumber: String(meta.fromNumber ?? smsCred.secrets?.fromNumber ?? brand.fromNumber ?? ""),
            phoneSid: meta.phoneSid ?? null,
            brand,
            updatedAt: smsCred.updatedAt ?? null,
            reason: failed
              ? "failed"
              : platformMisconfig
                ? "trust_hub_missing"
                : "brand_incomplete",
            trustHubConfigured,
          }));
        }
      }
    }
  }

  for (const install of Array.isArray(failedInstalls) ? failedInstalls : []) {
    const businessId = String(install?.businessId ?? "");
    if (!businessId) continue;
    actions.push(deepFreeze({
      id: `install_failed:${businessId}:${install.specificationId ?? "unknown"}`,
      kind: "install_failed",
      urgency: "high",
      title: `Install failed/partial — ${install.businessName || businessId}`,
      summary: `Business OS install status is ${install.status ?? "failed"}. Open the business and inspect install checkpoints.`,
      businessId,
      businessName: install.businessName ?? null,
      href: `/admin/businesses/${encodeURIComponent(businessId)}`,
      steps: [
        "Open the business in Admin → Businesses",
        "Enter via Support access if you need the live portal",
        "Check install status, warnings, and action checkpoints",
        "Re-run install or fix the blocking step, then confirm Home loads",
      ],
      payload: {
        status: install.status ?? null,
        specificationId: install.specificationId ?? null,
      },
      createdAt: install.updatedAt ?? null,
    }));
  }

  actions.sort((a, b) => {
    const rank = { critical: 0, high: 1, normal: 2 };
    const ra = rank[a.urgency] ?? 3;
    const rb = rank[b.urgency] ?? 3;
    if (ra !== rb) return ra - rb;
    return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
  });

  return deepFreeze(actions);
}

function buildA2pAction({
  businessId,
  businessName,
  fromNumber,
  phoneSid,
  brand,
  updatedAt,
  reason,
  trustHubConfigured,
}) {
  const legalName = brand.legalBusinessName || brand.dba || businessName;
  let title = `A2P exception — ${businessName}`;
  let summary = "SMS A2P needs a platform fix before carriers will deliver.";
  let urgency = "high";
  /** @type {string[]} */
  let steps = [];

  if (reason === "trust_hub_missing") {
    urgency = "critical";
    title = `A2P Trust Hub not configured — ${businessName}`;
    summary = "Platform env is missing Trust Hub bundle SIDs, so Brand Registration cannot auto-submit. Set them once for all clients.";
    steps = [
      "In production env set TWILIO_A2P_CUSTOMER_PROFILE_SID and TWILIO_A2P_PROFILE_BUNDLE_SID (Twilio Trust Hub bundles)",
      "Restart app/worker so SMS A2P auto-submit can run",
      `Open ${businessName} → Integrations → Text messaging → re-submit / refresh A2P`,
      "Confirm Brand Registration SID appears; carrier approval can still take days",
      "Owner proves send in Launch Center after Approved",
    ];
  } else if (reason === "brand_incomplete") {
    title = `A2P brand details incomplete — ${businessName}`;
    summary = "Owner must finish brand fields (legal name + EIN) in Integrations before registration can submit.";
    steps = [
      `Open workspace → Integrations → Text messaging for ${businessName}`,
      "Complete legal business name, EIN, address, and contact — must match EIN letter",
      "Submit / refresh A2P registration",
      "Owner proves send in Launch after Approved",
    ];
  } else {
    urgency = "critical";
    title = `A2P registration failed — ${businessName}`;
    summary = `Brand/Campaign failed for “${legalName}”. Fix brand data and re-submit; do not mark complete until Twilio shows Approved.`;
    steps = [
      `Open ${businessName} → Integrations → Text messaging`,
      "Compare brand fields to EIN letter / website (legal name must match)",
      "Fix rejected fields and re-submit A2P",
      "If Twilio Console shows a rejection reason, apply that fix then refresh status in VIBETech",
      "Owner proves send in Launch after Approved",
    ];
  }

  return deepFreeze({
    id: `a2p_pending:${businessId}`,
    kind: "a2p_registration",
    urgency,
    title,
    summary: fromNumber
      ? `${summary} Number ${fromNumber} is provisioned.`
      : summary,
    businessId,
    businessName,
    href: `/admin/businesses/${encodeURIComponent(businessId)}`,
    workspaceHref: `/b/${encodeURIComponent(businessId)}/integrations?focus=sms_channel`,
    steps,
    payload: {
      reason,
      trustHubConfigured: Boolean(trustHubConfigured),
      fromNumber: fromNumber || null,
      phoneSid: phoneSid || null,
      legalBusinessName: brand.legalBusinessName ?? null,
      dba: brand.dba ?? null,
      ein: brand.ein ?? null,
      website: brand.website ?? null,
      businessType: brand.businessType ?? null,
      businessIndustry: brand.businessIndustry ?? null,
      address: {
        line1: brand.addressLine1 ?? null,
        line2: brand.addressLine2 ?? null,
        city: brand.city ?? null,
        region: brand.region ?? null,
        postalCode: brand.postalCode ?? null,
        country: brand.country ?? "US",
      },
      contact: {
        firstName: brand.contactFirstName ?? null,
        lastName: brand.contactLastName ?? null,
        title: brand.contactTitle ?? null,
        email: brand.contactEmail ?? null,
        phone: brand.contactPhone ?? null,
      },
      campaign: {
        useCase: brand.campaignUseCase ?? "CUSTOMER_CARE",
        description: brand.campaignDescription ?? null,
        messageFlow: brand.messageFlow ?? null,
        messageSamples: brand.messageSamples ?? [
          brand.messageSample1,
          brand.messageSample2,
        ].filter(Boolean),
        privacyPolicyUrl: brand.privacyPolicyUrl ?? null,
        termsUrl: brand.termsUrl ?? null,
      },
    },
    createdAt: updatedAt,
  });
}
