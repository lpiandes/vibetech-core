/**
 * Client-safe product error presentation — never show raw machine codes.
 */

export type ProductErrorView = {
  title: string;
  message: string;
  whatHappened: string;
  dataSafe: boolean;
  nextAction: string;
  canRetry: boolean;
  supportReferenceId: string | null;
};

const REASON_MAP: Record<string, Omit<ProductErrorView, "supportReferenceId">> = {
  stale_approval_specification_hash: {
    title: "Plan changed since approval",
    message: "Someone updated the plan after it was approved.",
    whatHappened: "The approval no longer matches the current Business OS plan.",
    dataSafe: true,
    nextAction: "Check readiness again, then approve the new plan.",
    canRetry: true,
  },
  stale_approval_specification: {
    title: "Plan changed since approval",
    message: "The approved plan is out of date.",
    whatHappened: "Approval was bound to an older plan version.",
    dataSafe: true,
    nextAction: "Review the latest plan, then approve again.",
    canRetry: true,
  },
  stale_approval_plan_hash: {
    title: "Readiness plan changed",
    message: "The readiness checklist no longer matches your approval.",
    whatHappened: "A newer readiness check replaced the prior plan.",
    dataSafe: true,
    nextAction: "Re-check readiness, then approve and go live.",
    canRetry: true,
  },
  missing_business_os: {
    title: "Your operating system is not live yet",
    message: "This business does not have an operating system yet.",
    whatHappened: "Go-live has not completed for this business.",
    dataSafe: true,
    nextAction: "Continue with VIBETech to finish your recommendation and go live.",
    canRetry: false,
  },
  permission_denied: {
    title: "You do not have access",
    message: "Your role cannot perform this action.",
    whatHappened: "Permission check blocked the request.",
    dataSafe: true,
    nextAction: "Ask an owner to grant access, or switch businesses.",
    canRetry: false,
  },
  database_unavailable: {
    title: "Service temporarily unavailable",
    message: "We could not reach the database.",
    whatHappened: "A storage connection failed.",
    dataSafe: true,
    nextAction: "Wait a moment and try again. Contact support if it continues.",
    canRetry: true,
  },
  relation_does_not_exist: {
    title: "Setup incomplete",
    message: "Required database tables are missing.",
    whatHappened: "Migrations have not been applied on this environment.",
    dataSafe: true,
    nextAction: "Ask a platform admin to run database migrations, then retry.",
    canRetry: true,
  },
  research_failed: {
    title: "Website review unavailable",
    message: "VIBETech could not review that website right now.",
    whatHappened: "Website research failed or timed out.",
    dataSafe: true,
    nextAction: "Continue the conversation without it, or try another URL.",
    canRetry: true,
  },
  invalid_url: {
    title: "Website address needs a fix",
    message: "That doesn’t look like a website address we can open.",
    whatHappened: "The URL could not be understood.",
    dataSafe: true,
    nextAction: "Try something like www.yourcompany.com, or say you don’t have a website.",
    canRetry: true,
  },
  discovery_incomplete: {
    title: "A few more questions first",
    message: "VIBETech needs a fuller picture before recommending your operating system.",
    whatHappened: "Discovery is not complete yet (at least 10 answers).",
    dataSafe: true,
    nextAction: "Keep answering the remaining questions, then ask for the recommendation.",
    canRetry: true,
  },
  upload_failed: {
    title: "Document not saved",
    message: "That file could not be added to your conversation.",
    whatHappened: "Upload processing failed.",
    dataSafe: true,
    nextAction: "Try a smaller file or a different format (PDF, DOCX, TXT, CSV).",
    canRetry: true,
  },
  dry_run_failed: {
    title: "Readiness check incomplete",
    message: "VIBETech could not finish the readiness checklist.",
    whatHappened: "The readiness simulation failed.",
    dataSafe: true,
    nextAction: "Fix any checklist warnings, then check again.",
    canRetry: true,
  },
  validation_failed: {
    title: "Plan needs a small fix",
    message: "Something in the recommendation could not be validated for install.",
    whatHappened: "The Business OS plan failed a safety check before readiness.",
    dataSafe: true,
    nextAction: "Go back to the plan, try Update plan again, then check readiness.",
    canRetry: true,
  },
  install_failed: {
    title: "Go-live did not finish",
    message: "Your business was not changed completely.",
    whatHappened: "Going live stopped before completion.",
    dataSafe: true,
    nextAction: "Use Try again to resume. Nothing silent was left half-applied without a status.",
    canRetry: true,
  },
  provider_connection_failed: {
    title: "Connection failed",
    message: "The external provider could not be connected.",
    whatHappened: "Provider authentication or setup failed.",
    dataSafe: true,
    nextAction: "Check credentials and try connecting again.",
    canRetry: true,
  },
  unsupported_capability: {
    title: "Not available yet",
    message: "This business cannot use that capability right now.",
    whatHappened: "The requested capability is missing or unsupported.",
    dataSafe: true,
    nextAction: "Ask VIBETech to propose an improvement, or choose another path.",
    canRetry: false,
  },
  empty_analytics: {
    title: "No metrics yet",
    message: "There is not enough evidence to show analytics.",
    whatHappened: "No fabricated metrics are shown when evidence is missing.",
    dataSafe: true,
    nextAction: "Operate the business or connect sources, then return to Performance.",
    canRetry: false,
  },
  session_create_failed: {
    title: "Could not start",
    message: "A new conversation with VIBETech could not be started.",
    whatHappened: "Session creation failed.",
    dataSafe: true,
    nextAction: "Refresh and try again. If it continues, contact support.",
    canRetry: true,
  },
  duplicate_open_request: {
    title: "Request already open",
    message: "You already have an identical access request waiting for review.",
    whatHappened: "Duplicate open requests are blocked.",
    dataSafe: true,
    nextAction: "Wait for the owner to decide, or cancel the existing request.",
    canRetry: false,
  },
  approver_role_required: {
    title: "Only owners can decide",
    message: "Your role cannot approve or reject access requests.",
    whatHappened: "Approval requires an owner or administrator.",
    dataSafe: true,
    nextAction: "Ask an owner to review the request.",
    canRetry: false,
  },
  reason_required: {
    title: "Reason required",
    message: "Please explain why support access is needed.",
    whatHappened: "Support entry requires a written reason for the audit trail.",
    dataSafe: true,
    nextAction: "Enter a clear reason, then try again.",
    canRetry: true,
  },
  platform_admin_required: {
    title: "Platform admin only",
    message: "This action is limited to VIBETech platform administrators.",
    whatHappened: "Your account is not a platform admin.",
    dataSafe: true,
    nextAction: "Sign in with a platform admin account, or contact VIBETech.",
    canRetry: false,
  },
  installed_specification_required: {
    title: "Go live with your business first",
    message: "Improvements need a live operating system before VIBETech can revise it.",
    whatHappened: "No installed specification was found for this business.",
    dataSafe: true,
    nextAction: "Finish going live for this business, then ask VIBETech to improve it.",
    canRetry: false,
  },
  email_not_configured: {
    title: "Email delivery not configured",
    message: "The invitation was saved, but email could not be sent yet.",
    whatHappened: "SMTP or Resend is not configured in this environment.",
    dataSafe: true,
    nextAction: "Copy the invite link to share now, or ask an admin to configure email delivery.",
    canRetry: true,
  },
  membership_required: {
    title: "Membership required",
    message: "That person is not an active member of this business.",
    whatHappened: "Access grants require an active membership.",
    dataSafe: true,
    nextAction: "Invite them first, then approve the access request.",
    canRetry: false,
  },
  owner_escalation_requires_owner: {
    title: "Owner approval required",
    message: "Only an owner can grant owner-level access.",
    whatHappened: "Owner escalation was blocked for safety.",
    dataSafe: true,
    nextAction: "Ask the business owner to approve this change.",
    canRetry: false,
  },
};

export function createSupportReferenceId(prefix = "vt") {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${rand}`;
}

export function presentProductError(input: unknown, opts: { supportReferenceId?: string | null } = {}): ProductErrorView {
  const raw = extractRaw(input);
  const key = matchReasonKey(raw);
  const mapped = key ? REASON_MAP[key] : null;
  const supportReferenceId = opts.supportReferenceId ?? createSupportReferenceId();

  if (mapped) {
    return { ...mapped, supportReferenceId };
  }

  return {
    title: "Something went wrong",
    message: humanFallback(raw),
    whatHappened: "The action could not be completed.",
    dataSafe: true,
    nextAction: "Try again. If it continues, share the support reference with VIBETech.",
    canRetry: true,
    supportReferenceId,
  };
}

export function formatProductErrorMessage(input: unknown): string {
  const view = presentProductError(input);
  return `${view.message} ${view.nextAction} (Ref: ${view.supportReferenceId})`;
}

function extractRaw(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input;
  if (input instanceof Error) return input.message;
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    return String(obj.reason ?? obj.error ?? obj.message ?? obj.code ?? "");
  }
  return String(input);
}

function matchReasonKey(raw: string): string | null {
  const text = String(raw ?? "").toLowerCase();
  if (!text) return null;
  // Exact / specific keys before generic substring matches (e.g. "installed_*" contains "install").
  if (text.includes("installed_specification_required")) return "installed_specification_required";
  if (text.includes("missing_business_os") || (text.includes("business os") && text.includes("not"))) {
    return "missing_business_os";
  }
  if (text.includes("stale_approval_specification_hash") || text.includes("stale approval specification hash")) {
    return "stale_approval_specification_hash";
  }
  if (text.includes("stale_approval_plan")) return "stale_approval_plan_hash";
  if (text.includes("stale_approval")) return "stale_approval_specification";
  if (text.includes("relation") && text.includes("does not exist")) return "relation_does_not_exist";
  if (text.includes("econnrefused") || (text.includes("database") && text.includes("unavailable"))) {
    return "database_unavailable";
  }
  if (text.includes("permission") || text.includes("forbidden") || text.includes("not authorized")) {
    return "permission_denied";
  }
  if (text.includes("invalid_url") || text.includes("invalid url")) return "invalid_url";
  if (text.includes("discovery_incomplete")) return "discovery_incomplete";
  if (text.includes("research")) return "research_failed";
  if (text.includes("upload")) return "upload_failed";
  if (text.includes("validation_failed") || text.includes("validation failed")) return "validation_failed";
  if (text.includes("dry_run") || text.includes("dry run") || text.includes("launch readiness") || text.includes("readiness check")) {
    return "dry_run_failed";
  }
  if (text.includes("install_failed") || text.includes("launch failed") || text.includes("going live stopped")) {
    return "install_failed";
  }
  if (text.includes("provider") || text.includes("oauth") || text.includes("smtp")) {
    return "provider_connection_failed";
  }
  if (text.includes("unsupported") || text.includes("capability")) return "unsupported_capability";
  if (text.includes("analytics") || text.includes("no evidence")) return "empty_analytics";
  if (text.includes("start session") || text.includes("could not start") || text.includes("session_create")) {
    return "session_create_failed";
  }
  for (const key of Object.keys(REASON_MAP)) {
    if (text.includes(key)) return key;
  }
  return null;
}

function humanFallback(raw: string): string {
  const cleaned = String(raw ?? "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Please try again in a moment.";
  if (/^[a-z0-9_.:/-]+$/i.test(cleaned) && cleaned.includes("_")) {
    return "Please try again in a moment.";
  }
  if (cleaned.length > 180) return `${cleaned.slice(0, 177)}…`;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
