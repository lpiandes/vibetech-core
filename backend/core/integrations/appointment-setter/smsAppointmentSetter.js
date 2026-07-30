import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeString(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

/** A slot may be a rich object (from resolveAvailabilitySlots) or a plain label string. */
function slotLabel(slot) {
  if (slot && typeof slot === "object") return String(slot.label ?? slot.startISO ?? "");
  return String(slot ?? "");
}

export function formatSlotsForSms(slots = []) {
  return (slots ?? []).map((slot, i) => `${i + 1}) ${slotLabel(slot)}`).join(", ");
}

function nextBusinessSlots(now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  const label = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
  return [`${label} at 10:00 AM`, `${label} at 2:00 PM`, `${label} at 4:00 PM`];
}

export function buildFirstTouchSms({ businessName = "our team", name = "", bookingUrl = "" } = {}) {
  const greeting = name ? `Hi ${name}` : "Hi";
  return `${greeting} — thanks for your interest in ${businessName}. I can help find a time to talk. Reply with what you need help with, or book here: ${bookingUrl}. Reply STOP to opt out.`;
}

export async function runSmsAppointmentSetterTurn({
  inboundText = "",
  session = {},
  businessName = "our team",
  bookingUrl = "",
  knowledgeSnippets = [],
  llmProvider = null,
} = {}) {
  void knowledgeSnippets;
  void llmProvider;
  const text = safeString(inboundText);
  const lower = text.toLowerCase();
  const stage = session.stage ?? "qualify";
  if (/\b(stop|unsubscribe|cancel|end|quit)\b/.test(lower)) {
    return deepFreeze({ reply: "You’re opted out and will not receive more messages from us.", sessionPatch: { stage: "closed" }, intent: "unsubscribe", bookSlot: null });
  }
  if (stage === "closed") return deepFreeze({ reply: "", sessionPatch: { stage: "closed" }, intent: "closed", bookSlot: null });
  if (stage === "booked") return deepFreeze({ reply: `Thanks — you're all set with ${businessName}. See you at your booked time!`, sessionPatch: { stage: "booked" }, intent: "booked", bookSlot: null });

  const slots = Array.isArray(session.offeredSlots) && session.offeredSlots.length
    ? session.offeredSlots : nextBusinessSlots();
  const bookingRequested = /\b(book|booking|schedule|calendar|appointment|link)\b/.test(lower);
  if (stage === "qualify" && !bookingRequested) {
    return deepFreeze({
      reply: `Thanks${session.name ? `, ${session.name}` : ""}. What would you like help with regarding coverage, insurance, or your appointment?`,
      sessionPatch: { stage: "offer", answers: { need: text }, offeredSlots: slots },
      intent: "qualify",
      bookSlot: null,
    });
  }
  if (stage === "offer" || bookingRequested || stage === "qualify") {
    const choice = lower.match(/\b([123])\b/)?.[1];
    if (choice && slots[Number(choice) - 1]) {
      const selectedSlot = slots[Number(choice) - 1];
      return deepFreeze({
        reply: `Great — I’ll book you for ${slotLabel(selectedSlot)}. Reply YES to confirm, or use ${bookingUrl} to choose another time.`,
        sessionPatch: { stage: "confirm", selectedSlot, offeredSlots: slots },
        intent: "select_slot",
        bookSlot: null,
      });
    }
    return deepFreeze({
      reply: `I can offer: ${formatSlotsForSms(slots)}. Reply 1, 2, or 3 — or book here: ${bookingUrl}`,
      sessionPatch: { stage: "offer", offeredSlots: slots },
      intent: "offer",
      bookSlot: null,
    });
  }
  if (stage === "confirm") {
    if (/\b(yes|confirm|correct|sure|ok)\b/.test(lower)) {
      return deepFreeze({
        reply: `You're booked for ${slotLabel(session.selectedSlot)}. See you then!`,
        sessionPatch: { stage: "booked" },
        intent: "book",
        bookSlot: session.selectedSlot,
      });
    }
    return deepFreeze({
      reply: `Please reply YES to confirm ${slotLabel(session.selectedSlot)}, or use ${bookingUrl} to choose another time.`,
      sessionPatch: { stage: "confirm" },
      intent: "confirm",
      bookSlot: null,
    });
  }
  return deepFreeze({ reply: `Reply with what you need help with, or book here: ${bookingUrl}`, sessionPatch: { stage: "qualify" }, intent: "qualify", bookSlot: null });
}
