import { architectRoutes } from "../../components/architect/architectSemantics.ts";

/**
 * Session stages where the owner has already moved past discovery — Home must send them
 * back to the install/recovery trail (readiness → approval → go live), never back to a
 * fresh discovery conversation. "installed" is included because a builder session can end
 * up here while canonical Business OS persistence never completed (the Approve/Open bug):
 * that must resolve on the install page (which self-heals), not lose the session.
 */
const INSTALL_STAGE_KEYS = new Set([
  "dry_run_ready",
  "awaiting_approval",
  "installing",
  "failed",
  "installed",
]);

export type OnboardingSessionCard = {
  sessionId?: string | null;
  stageKey?: string | null;
  updatedAt?: string | null;
};

/**
 * Home (pre-install) must never link to a bare, sessionless `/b/{businessId}/architect` when
 * a durable builder session already exists for this business — that silently starts a brand
 * new session and strands the owner's prior answers/plan/approval. Callers should pass
 * sessions already ordered most-recently-updated first (AiBuilderService#listSessions does).
 */
export function resolveOnboardingHomeHref({
  businessId,
  sessions = [],
}: {
  businessId: string;
  sessions?: OnboardingSessionCard[] | null | undefined;
}): { href: string; sessionId: string | null; stageKey: string | null } {
  const resumable = (sessions ?? []).find((row) => {
    const stage = String(row?.stageKey ?? "").trim();
    return Boolean(stage) && stage !== "archived" && Boolean(row?.sessionId);
  }) ?? null;

  if (!resumable?.sessionId) {
    return {
      href: `/b/${encodeURIComponent(businessId)}/architect`,
      sessionId: null,
      stageKey: null,
    };
  }

  const sessionId = String(resumable.sessionId);
  const stageKey = String(resumable.stageKey ?? "");
  const routes = architectRoutes(sessionId, businessId);
  const href = INSTALL_STAGE_KEYS.has(stageKey) ? routes.install : routes.session;
  return { href, sessionId, stageKey };
}
