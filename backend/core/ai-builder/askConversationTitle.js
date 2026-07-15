/**
 * ChatGPT-style conversation titles from transcript — presentation only.
 */

const GENERIC_OPENERS = new Set([
  "hi",
  "hello",
  "hey",
  "help",
  "ok",
  "okay",
  "thanks",
  "thank you",
  "yo",
]);

export function deriveAskConversationTitle(conversation = [], { fallback = "New conversation" } = {}) {
  const users = (Array.isArray(conversation) ? conversation : [])
    .filter((entry) => entry && entry.role === "user")
    .map((entry) => String(entry.text ?? "").trim())
    .filter(Boolean);

  if (!users.length) return fallback;

  const pick = users.find((text) => {
    const lower = text.toLowerCase().replace(/[.!?]+$/g, "").trim();
    return lower.length >= 4 && !GENERIC_OPENERS.has(lower);
  }) ?? users[0];

  let title = pick
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(can you|could you|would you|please|hey|hi|hello)\s+/i, "")
    .trim();

  if (!title) return fallback;

  if (title.length > 48) {
    const cut = title.slice(0, 48);
    const lastSpace = cut.lastIndexOf(" ");
    title = `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim()}…`;
  }

  return title.charAt(0).toUpperCase() + title.slice(1);
}

/**
 * Auto-title only while still on the default / auto-managed name.
 * Never overwrite a locked (manual) title.
 */
export function shouldAutoUpdateAskTitle(metadata = {}, conversation = []) {
  if (metadata?.askTitleLocked === true) return false;
  if (metadata?.askTitleSource === "manual") return false;
  const users = (Array.isArray(conversation) ? conversation : [])
    .filter((entry) => entry?.role === "user" && String(entry.text ?? "").trim());
  if (!users.length) return false;
  const current = String(metadata?.askTitle ?? "").trim();
  if (!current || current === "New conversation") return true;
  // First auto-name only — keep it stable like ChatGPT.
  return Number(metadata?.askTitleAutoVersion ?? 0) < 1;
}

export function withAutoAskTitle(session) {
  if (!session || typeof session !== "object") return session;
  const continuous = Boolean(
    session.metadata?.continuousImprovement
    || /improve|continuous|expand_existing/i.test(String(session.mode ?? "")),
  );
  if (!continuous) return session;
  if (!shouldAutoUpdateAskTitle(session.metadata, session.conversation)) return session;
  const nextTitle = deriveAskConversationTitle(session.conversation);
  if (!nextTitle || nextTitle === String(session.metadata?.askTitle ?? "").trim()) {
    return session;
  }
  return {
    ...session,
    metadata: {
      ...(session.metadata ?? {}),
      askTitle: nextTitle,
      askTitleSource: "auto",
      askTitleAutoVersion: 1,
    },
  };
}
