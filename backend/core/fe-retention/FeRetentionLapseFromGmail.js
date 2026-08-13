import { readGmailInboxState } from "../integrations/gmail/GmailInboxStore.js";
import {
  appendFeMessageLog,
  appendUnmatchedCarrierNotice,
  listFeClients,
  readFeRetentionState,
  setFeClientPolicyStatus,
  writeFeRetentionState,
} from "./FeRetentionStore.js";
import { findFeClientForCarrierNotice } from "./FeRetentionGmailMatch.js";

const LAPSE_KEYWORDS = [
  /past\s*due/i,
  /missed\s*(premium|payment)/i,
  /\blapse[d]?\b/i,
  /policy\s*(terminated|cancel)/i,
  /premium\s*(not\s*)?received/i,
  /non[-\s]?payment/i,
  /grace\s*period/i,
  /reinstate/i,
];

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function classifyCarrierNoticeText(text = "") {
  const hay = String(text ?? "");
  if (!hay.trim()) return { match: false, status: null };
  const hits = LAPSE_KEYWORDS.filter((re) => re.test(hay));
  if (!hits.length) return { match: false, status: null };
  const status = /\blapse[d]?\b|terminated|cancel/i.test(hay) ? "lapsed" : "missed";
  return { match: true, status, hitCount: hits.length };
}

/**
 * Scan recent Gmail inbox messages for carrier lapse/missed notices.
 * Marks matching clients and returns candidates for recovery SMS.
 * Unmatched notices become Needs attention cards.
 */
export async function runFeRetentionGmailLapsePass({
  platformStore,
  installation,
  deliverTouchpoint = null,
  integrationPlatform = null,
  emailSender = null,
  maxMessages = 40,
} = {}) {
  let state = readFeRetentionState(installation);
  const inbox = readGmailInboxState(installation);
  const clients = listFeClients(state);
  const messages = (inbox.messages ?? []).slice(0, maxMessages);
  const detections = [];
  const processedIds = new Set(
    (state.messageLog ?? [])
      .filter((r) => r.kind === "gmail_lapse_detect" || r.kind === "gmail_lapse_unmatched")
      .map((r) => String(r.externalReference || "")),
  );

  for (const msg of messages) {
    const gmailId = safeString(msg.gmailMessageId || msg.id);
    if (gmailId && processedIds.has(gmailId)) continue;
    const text = [msg.subject, msg.snippet, msg.bodyText, msg.body].filter(Boolean).join("\n");
    const classified = classifyCarrierNoticeText(text);
    if (!classified.match) continue;
    const client = findFeClientForCarrierNotice(clients, msg);
    if (!client) {
      const noticed = appendUnmatchedCarrierNotice(state, {
        gmailMessageId: gmailId,
        subject: msg.subject ?? null,
        status: classified.status,
      });
      state = noticed.state;
      const logged = appendFeMessageLog(state, {
        kind: "gmail_lapse_unmatched",
        channel: "gmail",
        clientId: null,
        clientName: null,
        to: null,
        body: safeString(msg.subject) || "Unmatched carrier notice",
        ok: true,
        externalReference: gmailId || null,
      });
      state = logged.state;
      processedIds.add(gmailId);
      detections.push({
        gmailMessageId: gmailId,
        matched: false,
        status: classified.status,
        subject: msg.subject ?? null,
      });
      continue;
    }
    if (client.policy?.status === "cancelled") continue;
    if (client.policy?.status === classified.status) {
      detections.push({
        gmailMessageId: gmailId,
        matched: true,
        clientId: client.id,
        status: classified.status,
        already: true,
      });
      continue;
    }

    const updated = setFeClientPolicyStatus(state, {
      clientId: client.id,
      status: classified.status,
      source: "gmail",
    });
    if (!updated.ok) continue;
    state = updated.state;

    const loggedDetect = appendFeMessageLog(state, {
      kind: "gmail_lapse_detect",
      channel: "gmail",
      clientId: client.id,
      clientName: client.name,
      to: null,
      body: safeString(msg.subject),
      ok: true,
      externalReference: gmailId || null,
    });
    state = loggedDetect.state;
    processedIds.add(gmailId);

    if (typeof deliverTouchpoint === "function") {
      const delivered = await deliverTouchpoint({
        platformStore,
        installation,
        state,
        client: updated.client,
        kind: "lapseRecovery",
        integrationPlatform,
        emailSender,
        agentEmail: state.settings?.agentNotifyEmail || null,
        agentPhone: state.settings?.agentNotifyPhone || null,
        actorId: "fe_retention_gmail",
      });
      state = delivered.state;
    }

    detections.push({
      gmailMessageId: gmailId,
      matched: true,
      clientId: client.id,
      status: classified.status,
      already: false,
    });
  }

  state = {
    ...state,
    settings: {
      ...state.settings,
      lastGmailLapseRunAt: new Date().toISOString(),
    },
  };

  if (platformStore && installation) {
    state = await writeFeRetentionState({
      platformStore,
      installation,
      state,
      actorId: "fe_retention_gmail",
      historyAction: "fe_gmail_lapse_pass",
      settingsMode: "preserve_settings",
    });
  }

  return { detections, state };
}
