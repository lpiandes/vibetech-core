/**
 * Owner-facing hand-holding for Integrations "Test it works".
 * Driven by prove action — UI and confirm copy stay out of per-connection hardcoding.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { proveActionForConnectionId } from "../connectionProveRegistry.js";

/**
 * @typedef {{
 *   destinationKind?: "phone" | "email" | null,
 *   needsConfirm?: boolean,
 *   beforeTitle: string,
 *   beforeSteps: string[],
 *   destinationHint?: string | null,
 *   confirmTitle?: string | null,
 *   confirmSteps?: string[],
 *   successTitle: string,
 *   successSteps: string[],
 * }} ProveOwnerGuidance
 */

/** @type {Record<string, ProveOwnerGuidance>} */
const BY_ACTION = {
  send_test_email: {
    destinationKind: "email",
    needsConfirm: true,
    beforeTitle: "Test business email",
    beforeSteps: [
      "Enter an inbox you can open right now.",
      "We send one short test from your connected mailbox.",
      "Open that inbox, then come back and confirm you got it.",
    ],
    destinationHint: "Where should we send the test email?",
    confirmTitle: "Check your inbox",
    confirmSteps: [
      "Open the address you entered.",
      "Look for a short VIBETech / prove test message from your business email.",
      "When you see it, tap Yes — I got it.",
    ],
    successTitle: "Email works",
    successSteps: [
      "This channel is tested with a real send.",
      "If Today still lists email, refresh — the checklist should clear.",
    ],
  },
  create_test_event: {
    destinationKind: null,
    needsConfirm: true,
    beforeTitle: "Test Google Calendar",
    beforeSteps: [
      "We’ll create a short “VIBETech prove test” event on your connected calendar.",
      "Open Calendar and confirm you see it.",
      "Come back and tap Yes — I got it.",
    ],
    confirmTitle: "Check your calendar",
    confirmSteps: [
      "Open Google Calendar (or Outlook) for this business.",
      "Find “VIBETech prove test” around now.",
      "When you see it, tap Yes — I got it.",
    ],
    successTitle: "Calendar works",
    successSteps: [
      "Scheduling is tested with a real event.",
      "You can delete the prove event anytime.",
    ],
  },
  send_test_sms: {
    destinationKind: "phone",
    needsConfirm: true,
    beforeTitle: "Test text messaging",
    beforeSteps: [
      "Enter a mobile number you have with you (country code, e.g. +1…).",
      "We send one short test text from your business number.",
      "When it arrives, confirm here.",
    ],
    destinationHint: "Mobile number for the test text",
    confirmTitle: "Check your texts",
    confirmSteps: [
      "Open Messages on that phone.",
      "Look for a short VIBETech test text.",
      "When you see it, tap Yes — I got it.",
    ],
    successTitle: "Texting works",
    successSteps: [
      "SMS is tested with a real send.",
      "US delivery still needs carrier (A2P) approval when that status is pending.",
    ],
  },
  place_test_call: {
    destinationKind: "phone",
    needsConfirm: true,
    beforeTitle: "Test business phone",
    beforeSteps: [
      "Enter a phone you can answer right now (country code, e.g. +1…).",
      "We’ll place a short prove call to that number.",
      "Answer it, then confirm here.",
    ],
    destinationHint: "Phone number for the test call",
    confirmTitle: "Did the call reach you?",
    confirmSteps: [
      "Check recent calls on that phone.",
      "You should see a short inbound prove call from your business line.",
      "If you got it, tap Yes — I got it.",
    ],
    successTitle: "Phone works",
    successSteps: [
      "Voice is tested with a real dial.",
      "If Today still lists phone, refresh the page.",
    ],
  },
  place_test_outbound_call: {
    destinationKind: "phone",
    needsConfirm: true,
    beforeTitle: "Test outbound call",
    beforeSteps: [
      "Enter a phone you can answer.",
      "We’ll place an approved outbound prove call.",
      "Confirm when it reaches you.",
    ],
    destinationHint: "Phone for the outbound test",
    confirmTitle: "Did you get the call?",
    confirmSteps: [
      "Answer or check missed calls on that phone.",
      "When you’ve confirmed the dial, tap Yes — I got it.",
    ],
    successTitle: "Outbound call works",
    successSteps: ["Outbound dialing is tested."],
  },
  submit_test_form: {
    destinationKind: null,
    needsConfirm: false,
    beforeTitle: "Test website forms",
    beforeSteps: [
      "We’ll record a controlled test form lead (no live website click needed).",
      "You’ll see proof on this screen, then open Decisions to approve the follow-up draft.",
    ],
    successTitle: "Form test recorded — do this next",
    successSteps: [
      "Confirm the proof listed above (contact + draft).",
      "Open Decisions — approve or dismiss the pending follow-up draft.",
      "That’s the same path a real website lead uses.",
    ],
  },
  submit_test_chat: {
    destinationKind: null,
    needsConfirm: false,
    beforeTitle: "Test website chat",
    beforeSteps: [
      "We’ll run a controlled chat turn and save a contact.",
      "You’ll see proof on this screen.",
    ],
    successTitle: "Chat test passed",
    successSteps: [
      "Confirm the prove contact in the proof list above.",
      "Live widget chats use the same intake path.",
    ],
  },
  ingest_test_lead: {
    destinationKind: null,
    needsConfirm: false,
    beforeTitle: "Test Meta Lead Forms",
    beforeSteps: [
      "We’ll ingest a controlled Facebook-style test lead.",
      "You’ll see proof here, then open Decisions for the follow-up draft.",
    ],
    successTitle: "Meta lead test recorded",
    successSteps: [
      "Confirm the proof listed above.",
      "Open Decisions — approve or dismiss the pending follow-up draft.",
      "Live Instant Form leads arrive the same way via webhook.",
    ],
  },
  sync_test_crm_contact: {
    destinationKind: null,
    needsConfirm: false,
    beforeTitle: "Test CRM sync",
    beforeSteps: [
      "We’ll create a prove contact in your connected CRM.",
      "Then confirm a provider record id comes back.",
    ],
    successTitle: "CRM sync works",
    successSteps: [
      "Open your CRM — look for the VIBETech prove / test contact.",
      "Integrations should show this channel as tested.",
    ],
  },
};

const FALLBACK = {
  destinationKind: null,
  needsConfirm: false,
  beforeTitle: "Test it works",
  beforeSteps: ["We’ll run a controlled live check for this channel."],
  successTitle: "Test finished",
  successSteps: ["Refresh Connections if the status looks stale."],
};

export function proveGuidanceForAction(action) {
  const row = BY_ACTION[String(action ?? "")] ?? FALLBACK;
  return deepFreeze({
    destinationKind: row.destinationKind ?? null,
    needsConfirm: row.needsConfirm === true,
    beforeTitle: row.beforeTitle,
    beforeSteps: [...(row.beforeSteps ?? [])],
    destinationHint: row.destinationHint ?? null,
    confirmTitle: row.confirmTitle ?? null,
    confirmSteps: [...(row.confirmSteps ?? [])],
    successTitle: row.successTitle,
    successSteps: [...(row.successSteps ?? [])],
  });
}

export function proveGuidanceForConnectionId(connectionId) {
  const mapped = proveActionForConnectionId(connectionId);
  if (!mapped?.action) return proveGuidanceForAction(null);
  return proveGuidanceForAction(mapped.action);
}

export function listProveGuidanceActions() {
  return deepFreeze(Object.keys(BY_ACTION));
}
