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
    nextAction: "Run launch readiness again, then approve the new plan.",
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
    title: "Launch plan changed",
    message: "The launch checklist no longer matches your approval.",
    whatHappened: "A newer launch readiness check replaced the prior plan.",
    dataSafe: true,
    nextAction: "Re-check launch readiness, then approve and launch.",
    canRetry: true,
  },
  missing_business_os: {
    title: "Business OS not installed",
    message: "This business does not have an operating system yet.",
    whatHappened: "Install has not completed for this business.",
    dataSafe: true,
    nextAction: "Open Architect to finish design and launch.",
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
    message: "Architect could not review that website right now.",
    whatHappened: "Website research failed or timed out.",
    dataSafe: true,
    nextAction: "Continue the conversation without it, or try another URL.",
    canRetry: true,
  },
  upload_failed: {
    title: "Document not saved",
    message: "That file could not be added to Architect.",
    whatHappened: "Upload processing failed.",
    dataSafe: true,
    nextAction: "Try a smaller file or a different format (PDF, DOCX, TXT, CSV).",
    canRetry: true,
  },
  dry_run_failed: {
    title: "Launch readiness incomplete",
    message: "Architect could not finish the launch checklist.",
    whatHappened: "The readiness simulation failed.",
    dataSafe: true,
    nextAction: "Fix any checklist warnings, then check again.",
    canRetry: true,
  },
  install_failed: {
    title: "Launch did not finish",
    message: "Your business was not changed completely.",
    whatHappened: "Installation stopped before completion.",
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
    title: "Capability not available yet",
    message: "This business cannot use that capability right now.",
    whatHappened: "The requested capability is missing or unsupported.",
    dataSafe: true,
    nextAction: "Ask Architect to propose an improvement, or choose another path.",
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
    title: "Could not start Architect",
    message: "A new design session could not be created.",
    whatHappened: "Builder session creation failed.",
    dataSafe: true,
    nextAction: "Refresh and try again. If it continues, contact support.",
    canRetry: true,
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
  if (text.includes("stale_approval_specification_hash") || text.includes("stale approval specification hash")) {
    return "stale_approval_specification_hash";
  }
  if (text.includes("stale_approval_plan")) return "stale_approval_plan_hash";
  if (text.includes("stale_approval")) return "stale_approval_specification";
  if (text.includes("relation") && text.includes("does not exist")) return "relation_does_not_exist";
  if (text.includes("econnrefused") || text.includes("database") && text.includes("unavailable")) {
    return "database_unavailable";
  }
  if (text.includes("permission") || text.includes("forbidden") || text.includes("not authorized")) {
    return "permission_denied";
  }
  if (text.includes("research")) return "research_failed";
  if (text.includes("upload")) return "upload_failed";
  if (text.includes("dry_run") || text.includes("dry run") || text.includes("launch readiness")) {
    return "dry_run_failed";
  }
  if (text.includes("install") || text.includes("launch failed")) return "install_failed";
  if (text.includes("provider") || text.includes("oauth") || text.includes("smtp")) {
    return "provider_connection_failed";
  }
  if (text.includes("unsupported") || text.includes("capability")) return "unsupported_capability";
  if (text.includes("analytics") || text.includes("no evidence")) return "empty_analytics";
  if (text.includes("start session") || text.includes("could not start")) return "session_create_failed";
  if (text.includes("business os") && text.includes("not")) return "missing_business_os";
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
