import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { CONNECTION_STATUSES } from "../integrations/connections/ConnectionStatus.js";
import { evaluatePropertyManagementTemplateReadiness } from "../../../industries/property-management/config/propertyManagementTemplateReadiness.js";
import { MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE } from "../../../industries/property-management/config/mcbrideClientTemplate.js";
import { buildReferralOperationsSummary } from "./ReferralLoopService.js";

function statusTone(status) {
  if (status === "ready") return "READY";
  if (status === "needs_attention") return "NEEDS ATTENTION";
  if (status === "not_configured") return "NOT CONFIGURED";
  return "DEFERRED";
}

function item({ id, label, status, why, nextAction, href = null }) {
  return deepFreeze({
    id,
    label,
    status,
    statusLabel: statusTone(status),
    why,
    nextAction,
    href,
  });
}

/**
 * Live launch readiness probes — owner-facing, not client-branded.
 * Property/PM checks are included only when includePropertyChecks is true.
 */
export function buildMcBrideReadinessProjection({
  businessId,
  stack = null,
  integrationPlatform = null,
  knowledgeDocumentCount = 0,
  knowledgeDocuments = [],
  membershipCount = 0,
  importRunSummary = null,
  subjectCount = null,
  unresolvedSubjectInterestCount = 0,
  template = MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE,
  includePropertyChecks = true,
} = {}) {
  const configReadiness = includePropertyChecks
    ? evaluatePropertyManagementTemplateReadiness({ template })
    : { configurationChecks: [] };
  const parties = stack?.businessGraphRuntime?.getParties?.() ?? [];
  const subjects = stack?.businessSubjectRuntime?.getSubjects?.() ?? [];
  const effectiveSubjectCount = subjectCount == null ? subjects.length : Number(subjectCount);
  const preferences = stack?.communicationPreferenceRuntime?.getPreferences?.()
    ?? stack?.communicationPreferenceRuntime?.exportState?.()?.preferences
    ?? [];
  const campaignWorks = (stack?.workRuntime?.getWorkItems?.() ?? []).filter((work) => work?.metadata?.campaignPreparation);
  const emailConnection = (integrationPlatform?.connectionRuntime?.getConnections?.() ?? [])
    .find((c) => String(c.connectionType) === "business_email") ?? null;
  const emailReady = emailConnection
    && [CONNECTION_STATUSES.CONNECTED, CONNECTION_STATUSES.DEGRADED].includes(emailConnection.status);
  const readyDocs = (Array.isArray(knowledgeDocuments) ? knowledgeDocuments : [])
    .filter((doc) => String(doc.status) === "ready" && !doc.deletedAt);
  const knowledgeReady = knowledgeDocumentCount > 0 || readyDocs.length > 0;
  const referral = buildReferralOperationsSummary({ stack });

  /** @type {ReturnType<typeof item>[]} */
  const checks = [
    item({
      id: "crm_data",
      label: "CRM data",
      status: parties.length > 0 || importRunSummary?.committed ? "ready" : "needs_attention",
      why: parties.length > 0
        ? `${parties.length} people are available for follow-up and campaigns.`
        : "Campaigns and follow-up need classified contacts.",
      nextAction: parties.length > 0 ? "Review people and relationships." : "Import and commit a CRM CSV.",
      href: businessId ? `/b/${businessId}/people` : null,
    }),
  ];

  if (includePropertyChecks) {
    checks.push(
      item({
        id: "properties",
        label: "Properties / listings",
        status: effectiveSubjectCount > 0 ? "ready" : "needs_attention",
        why: effectiveSubjectCount > 0
          ? `${effectiveSubjectCount} properties are available for campaigns and interest tracking.`
          : "Property campaigns need imported listings with trusted identity.",
        nextAction: effectiveSubjectCount > 0 ? "Review properties and interested people." : "Import a trusted property/listing CSV.",
        href: businessId ? `/b/${businessId}/properties` : null,
      }),
      item({
        id: "unresolved_property_interest",
        label: "Unresolved property interest",
        status: unresolvedSubjectInterestCount > 0 ? "needs_attention" : "ready",
        why: unresolvedSubjectInterestCount > 0
          ? `${unresolvedSubjectInterestCount} property interest values need human review.`
          : "No unresolved property interest values are blocking operations.",
        nextAction: unresolvedSubjectInterestCount > 0
          ? "Review ambiguous property interest values before linking people to listings."
          : "Continue normal property operations.",
        href: businessId ? `/b/${businessId}/properties` : null,
      }),
    );
  }

  checks.push(
    item({
      id: "consent",
      label: "Communication consent",
      status: Array.isArray(preferences) && preferences.length > 0 ? "ready" : "needs_attention",
      why: "Marketing campaigns must respect opt-in, opt-out, and suppression.",
      nextAction: Array.isArray(preferences) && preferences.length > 0
        ? "Review consent before sending campaigns."
        : "Import consent or record preferences before marketing outreach.",
      href: businessId ? `/b/${businessId}/people` : null,
    }),
    item({
      id: "approved_knowledge",
      label: "Approved Knowledge",
      status: knowledgeReady ? "ready" : "needs_attention",
      why: knowledgeReady
        ? "Approved knowledge is available for drafts and campaigns."
        : "Upload approved policies and client-communication knowledge.",
      nextAction: knowledgeReady ? "Keep knowledge current." : "Upload approved follow-up knowledge.",
      href: businessId ? `/b/${businessId}/knowledge` : null,
    }),
    item({
      id: "team_assignment",
      label: "Team assignment",
      status: membershipCount > 0 ? "ready" : "needs_attention",
      why: "Follow-up and campaign work need human owners.",
      nextAction: membershipCount > 0 ? "Confirm assignees on open work." : "Invite team members and configure ownership.",
      href: businessId ? `/b/${businessId}/team` : null,
    }),
    item({
      id: "business_email",
      label: "Business email",
      status: emailReady ? "ready" : "needs_attention",
      why: emailReady
        ? "Approved campaigns can be sent through the connected email account."
        : "Campaigns can be approved but cannot be sent until business email is connected.",
      nextAction: emailReady
        ? "Email is connected and ready for governed sends."
        : "Connect the business email account in Integrations.",
      href: businessId ? `/b/${businessId}/integrations?focus=business_email` : null,
    }),
    item({
      id: "campaign_delivery",
      label: "Campaign delivery",
      status: emailReady ? "ready" : "needs_attention",
      why: emailReady
        ? `${campaignWorks.length} campaign preparation(s) are available. Sending still requires approving the exact version, then an explicit send.`
        : "Delivery stays blocked until business email is connected.",
      nextAction: emailReady
        ? "Approve a campaign version, then use Send approved campaign."
        : "Connect business email, then send from approved campaign Work.",
      href: businessId ? `/b/${businessId}/home` : null,
    }),
    item({
      id: "inbound_website",
      label: "Website inquiries",
      status: "deferred",
      why: "Automatic website form intake may still need Launch prove for this business.",
      nextAction: "Connect forms or Meta leads in Integrations / Launch Center when purchased.",
      href: businessId ? `/b/${businessId}/integrations` : null,
    }),
    item({
      id: "sms",
      label: "SMS",
      status: "deferred",
      why: "SMS is available after Twilio + A2P registration and Launch prove.",
      nextAction: "Use email until SMS is connected and proven in Launch Center.",
      href: businessId ? `/b/${businessId}/integrations?focus=sms_channel` : null,
    }),
  );

  if (includePropertyChecks) {
    checks.push(
      item({
        id: "appfolio",
        label: "PMS sync",
        status: "deferred",
        why: "Continuous property-management software sync is not part of every launch.",
        nextAction: "Continue using CRM and property CSV imports unless a PMS connection is purchased.",
      }),
    );
  }

  checks.push(
    item({
      id: "missed_call",
      label: "Missed-call handling",
      status: "deferred",
      why: "Automatic missed-call intake depends on Phone/voice prove.",
      nextAction: "Handle missed calls through inquiry and follow-up until voice is proven.",
      href: businessId ? `/b/${businessId}/integrations?focus=voice_channel` : null,
    }),
    item({
      id: "referrals",
      label: "Referrals",
      status: referral.introductionsRecorded > 0 || referral.referralSourceCount > 0 ? "ready" : "not_configured",
      why: referral.introductionsRecorded > 0
        ? `${referral.introductionsRecorded} referral introduction(s) are recorded with clear attribution.`
        : "Referral sources can be classified. Introductions are recorded only when the introduced person is identified.",
      nextAction: "Record referred introductions from referral replies or outreach outcomes.",
      href: businessId ? `/b/${businessId}/home` : null,
    }),
  );

  const blocking = checks.filter((check) => check.status === "needs_attention" || check.status === "not_configured");
  const deferred = checks.filter((check) => check.status === "deferred");
  const ready = checks.filter((check) => check.status === "ready");

  let launchState = "Not ready";
  if (blocking.length === 0) {
    launchState = deferred.length ? "Ready with deferred capabilities" : "Ready";
  }
  const criticalIds = new Set(
    includePropertyChecks
      ? ["crm_data", "properties", "business_email", "approved_knowledge", "team_assignment"]
      : ["crm_data", "business_email", "approved_knowledge", "team_assignment"],
  );
  const criticalBlocking = checks.filter((check) => criticalIds.has(check.id) && check.status !== "ready");
  if (criticalBlocking.length === 0) {
    launchState = deferred.length || blocking.some((check) => !criticalIds.has(check.id))
      ? "Ready with deferred capabilities"
      : "Ready";
  } else {
    launchState = "Not ready";
  }

  return deepFreeze({
    businessId: businessId ? String(businessId) : null,
    generatedAt: new Date().toISOString(),
    launchState,
    includePropertyChecks: Boolean(includePropertyChecks),
    summary: {
      ready: ready.length,
      needsAttention: checks.filter((check) => check.status === "needs_attention").length,
      notConfigured: checks.filter((check) => check.status === "not_configured").length,
      deferred: deferred.length,
    },
    checks,
    configurationChecks: configReadiness.configurationChecks,
    referral,
  });
}

/** Alias for universal call sites. */
export const buildLaunchReadinessProjection = buildMcBrideReadinessProjection;
