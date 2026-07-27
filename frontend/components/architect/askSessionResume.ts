/**
 * Ask VIBETech session resume rules — keep continuous Ask free of discovery leftovers.
 */

export function isContinuousImproveSession(session: any): boolean {
  if (!session || typeof session !== "object") return false;
  // Admin package-add Ask is discovery — never continuous chat.
  if (session.metadata?.packageAsk === true || session.businessSummary?.packageAsk === true) {
    return false;
  }
  if (session.metadata?.continuousImprovement) return true;
  if (session.continuousImprovement) return true;
  const mode = String(session.mode ?? session.title ?? session.stageKey ?? "");
  return /improve|continuous|expand_existing/i.test(mode);
}

/**
 * Setup / discovery sessions that produced a real plan or interview.
 */
export function isSetupPlanSession(session: any): boolean {
  if (!session || typeof session !== "object") return false;
  if (isContinuousImproveSession(session)) return false;
  const stage = String(session.stageKey ?? session.currentStage ?? "").toLowerCase();
  if (["archived", "failed", "blocked"].includes(stage)) return false;
  if ([
    "proposal_ready",
    "awaiting_review",
    "dry_run_ready",
    "awaiting_approval",
    "installing",
    "installed",
    "assembling",
    "interviewing",
    "discovering",
    "discovery",
  ].includes(stage)) {
    return true;
  }
  if (session.hasUserMessage === true) return true;
  if (Number(session.messageCount ?? 0) > 0) return true;
  return false;
}

/**
 * Pick a session to resume.
 * For continuous-only (installed business), never fall back to a discovery transcript.
 * For setup, prefer sessions with real progress over empty drafts.
 */
export function pickResumableSessionId(
  sessions: unknown,
  { continuousOnly }: { continuousOnly: boolean },
): string | null {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;
  const open = sessions.filter((row: any) => {
    const stage = String(row?.stageKey ?? row?.currentStage ?? "");
    return !["installed", "failed", "archived", "blocked"].includes(stage);
  });
  const pool = open.length ? open : sessions;
  if (continuousOnly) {
    const continuous = pool.find((row: any) => isContinuousImproveSession(row));
    return continuous?.sessionId ? String(continuous.sessionId) : null;
  }

  const setupPool = pool.filter((row: any) => !isContinuousImproveSession(row));
  const ranked = (setupPool.length ? setupPool : pool)
    .map((row: any) => {
      const stage = String(row?.stageKey ?? row?.currentStage ?? "");
      const progress = Number(row?.progressPercent ?? 0) || 0;
      let score = progress;
      if (row?.hasUserMessage) score += 50;
      if (Number(row?.answerCount ?? 0) > 0) score += 40;
      if (Number(row?.messageCount ?? 0) > 1) score += 10;
      if ([
        "proposal_ready",
        "awaiting_review",
        "dry_run_ready",
        "awaiting_approval",
        "interviewing",
        "assembling",
      ].includes(stage)) {
        score += 30;
      }
      return { row, score, updatedAt: String(row?.updatedAt ?? "") };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.updatedAt.localeCompare(left.updatedAt);
    });

  const pick = ranked[0]?.row;
  return pick?.sessionId ? String(pick.sessionId) : null;
}

export type AskHistoryItem = {
  sessionId: string;
  title: string;
  preview: string;
  updatedAt: string | null;
  kind: "chat" | "setup";
};

/** Ask history for the left rail — chats + setup plans, newest first. Empty drafts stay hidden. */
export function presentAskHistory(
  sessions: unknown,
  { activeSessionId = null }: { activeSessionId?: string | null } = {},
): AskHistoryItem[] {
  if (!Array.isArray(sessions)) return [];
  const rows = sessions
    .filter((row: any) => row?.sessionId && row?.canContinue !== false)
    .filter((row: any) => isContinuousImproveSession(row) || isSetupPlanSession(row))
    .filter((row: any) => isMeaningfulAskHistoryItem(row, activeSessionId))
    .map((row: any) => {
      const setup = isSetupPlanSession(row);
      const businessName = String(row.businessName ?? "").trim();
      const rawTitle = String(row.title ?? row.askTitle ?? "").trim();
      const title = setup
        ? (businessName ? `${businessName} setup` : rawTitle && rawTitle !== "New conversation" ? rawTitle : "Business setup")
        : (rawTitle || "New conversation");
      return {
        sessionId: String(row.sessionId),
        title,
        preview: setup
          ? (String(row.preview ?? "").trim() || String(row.nextAction ?? "Review your operating system plan").trim())
          : String(row.preview ?? "").trim(),
        updatedAt: row.updatedAt == null ? null : String(row.updatedAt),
        kind: setup ? "setup" as const : "chat" as const,
      };
    })
    .sort((left, right) => String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")));

  // Same prompt (e.g. teammate Ask) used to mint many identical chats — keep newest per title.
  // Setup plans always stay (one per business name is fine).
  const seenTitles = new Set<string>();
  const deduped: AskHistoryItem[] = [];
  for (const item of rows) {
    const key = `${item.kind}:${normalizeAskHistoryTitle(item.title)}`;
    const isActive = activeSessionId != null && item.sessionId === String(activeSessionId);
    if (item.kind === "chat" && !isActive && seenTitles.has(key)) continue;
    seenTitles.add(key);
    deduped.push(item);
  }
  return deduped;
}

function normalizeAskHistoryTitle(title: string): string {
  return String(title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Hide blank auto-started drafts ("New conversation" with no user messages).
 * Those all looked identical and reused the readiness next-action as fake preview text.
 */
export function isMeaningfulAskHistoryItem(row: any, activeSessionId: string | null = null): boolean {
  if (!row?.sessionId) return false;
  if (row.emptyAsk === true) return false;
  if (isSetupPlanSession(row)) return true;
  if (row.hasUserMessage === true) return true;
  if (Number(row.messageCount ?? 0) > 0) return true;
  const title = String(row.title ?? row.askTitle ?? "").trim();
  if (title && title !== "New conversation") return true;
  // Never keep the active empty draft in the list — the main pane already shows it.
  if (activeSessionId != null && String(row.sessionId) === String(activeSessionId)) return false;
  return false;
}

export function formatAskHistoryWhen(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) return null;
  const delta = Date.now() - ms;
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
