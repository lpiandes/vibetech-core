/**
 * Knowledge-backed AI phone receptionist (inbound TwiML Gather loop).
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createLlmProvider, llmIsLiveAvailable } from "../../providers/createLlmProvider.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function escapeXml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build TwiML for greeting + gather.
 */
export function buildReceptionistGatherTwiml({
  sayText,
  actionUrl,
  gatherTimeout = 6,
} = {}) {
  const say = escapeXml(sayText || "Thanks for calling. How can I help?");
  const action = escapeXml(actionUrl);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" speechTimeout="auto" timeout="${Number(gatherTimeout) || 6}" action="${action}" method="POST">
    <Say voice="Polly.Joanna">${say}</Say>
  </Gather>
  <Say voice="Polly.Joanna">Sorry, I did not catch that. Please call again or leave a message with our team.</Say>
</Response>`;
}

export function buildReceptionistHangupTwiml({ sayText } = {}) {
  const say = escapeXml(sayText || "Thanks for calling. Goodbye.");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${say}</Say>
  <Hangup/>
</Response>`;
}

/**
 * Decide receptionist reply from speech + knowledge snippets.
 */
export async function runVoiceReceptionistTurn({
  speech = "",
  businessName = "the business",
  knowledgeSnippets = [],
  llmProvider = null,
  nowISO = new Date().toISOString(),
} = {}) {
  const heard = safeString(speech);
  const snippets = (Array.isArray(knowledgeSnippets) ? knowledgeSnippets : [])
    .map((s) => safeString(s?.text ?? s?.body ?? s?.title ?? s))
    .filter(Boolean)
    .slice(0, 6);

  const lower = heard.toLowerCase();
  let intent = "answer";
  if (/\b(book|appoint|schedule|reserv)\b/.test(lower)) intent = "book";
  else if (/\b(message|callback|call me back|leave)\b/.test(lower)) intent = "message";
  else if (/\b(bye|goodbye|that's all|hang up)\b/.test(lower)) intent = "goodbye";

  let reply = null;
  if (llmIsLiveAvailable() || llmProvider) {
    try {
      const provider = llmProvider || createLlmProvider({ preferLive: true });
      const prompt = [
        "You are a concise phone receptionist for a small business on VIBETech.",
        "Speak in short spoken sentences (under 45 words). Do not invent facts.",
        "If knowledge does not cover the answer, say you will have the team follow up.",
        `Business: ${businessName}`,
        `Caller said: ${heard || "(silence)"}`,
        `Knowledge:\n${snippets.map((s, i) => `${i + 1}. ${s.slice(0, 400)}`).join("\n") || "(none)"}`,
        'Return JSON only: { "reply": string, "intent": "answer"|"book"|"message"|"goodbye" }',
      ].join("\n");
      const raw = await provider.generate(prompt, { json: true, temperature: 0.2 });
      const match = String(raw ?? "").match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : null;
      if (parsed?.reply) {
        reply = safeString(parsed.reply).slice(0, 400);
        if (parsed.intent) intent = String(parsed.intent);
      }
    } catch {
      /* fallback */
    }
  }

  if (!reply) {
    if (intent === "goodbye") {
      reply = `Thanks for calling ${businessName}. Goodbye.`;
    } else if (intent === "book") {
      reply = `I can help with an appointment for ${businessName}. I will check open times and book the next available slot when Calendar and team availability are set up.`;
    } else if (intent === "message") {
      reply = `Got it. I will leave a message for the team at ${businessName} to call you back.`;
    } else if (snippets[0]) {
      reply = `Based on our information: ${snippets[0].slice(0, 220)}`;
    } else {
      reply = `Thanks for calling ${businessName}. I will have someone from the team follow up with you shortly.`;
    }
  }

  return deepFreeze({
    ok: true,
    intent,
    reply,
    heard,
    at: typeof nowISO === "function" ? nowISO() : String(nowISO),
  });
}
