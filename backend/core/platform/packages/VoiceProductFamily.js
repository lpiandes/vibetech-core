/**
 * Voice product family (Phase 3).
 * Separate packageIds + honesty boundaries + prove requirements.
 * `voice_custom_agent` stays a human/operator-led engagement; the rest are live product paths.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getSalesPackage } from "./SalesPackageCatalog.js";

export const VOICE_FAMILY_PACKAGE_IDS = deepFreeze([
  "ai_receptionist",
  "voice_inbound_agent",
  "voice_outbound_agent",
  "voice_scheduling_agent",
  "voice_support_agent",
  "voice_custom_agent",
]);

const FAMILY = deepFreeze({
  ai_receptionist: {
    packageId: "ai_receptionist",
    role: "inbound_receptionist",
    sellableToday: true,
    honestyBoundary:
      "Knowledge-backed inbound + call notes. Booking → appointment Work and a calendar HOLD when Google Calendar is connected (team confirms).",
    requiredProveMissionIds: ["voice_calls", "knowledge_consult"],
    grantRequiredForOutbound: true,
    liveSlotBook: false,
    calendarHoldOnBook: true,
  },
  voice_inbound_agent: {
    packageId: "voice_inbound_agent",
    role: "inbound_specialized",
    sellableToday: true,
    honestyBoundary: "Inbound voice specialization of receptionist with Knowledge + approvals.",
    requiredProveMissionIds: ["voice_calls", "knowledge_consult", "outbound_approvals"],
    grantRequiredForOutbound: true,
    liveSlotBook: false,
    calendarHoldOnBook: false,
  },
  voice_outbound_agent: {
    packageId: "voice_outbound_agent",
    role: "outbound_campaign",
    sellableToday: true,
    honestyBoundary: "Campaign dialer with owner GRANT before each customer dial; usage meters outbound minutes.",
    requiredProveMissionIds: ["voice_calls", "outbound_approvals"],
    grantRequiredForOutbound: true,
    liveSlotBook: false,
    calendarHoldOnBook: false,
  },
  voice_scheduling_agent: {
    packageId: "voice_scheduling_agent",
    role: "scheduling_voice",
    sellableToday: true,
    honestyBoundary: "Live Google Calendar slot book prove + voice scheduling worker. Not a public self-serve booking page.",
    requiredProveMissionIds: ["voice_calls", "calendar_scheduling"],
    grantRequiredForOutbound: true,
    liveSlotBook: true,
    calendarHoldOnBook: true,
  },
  voice_support_agent: {
    packageId: "voice_support_agent",
    role: "support_voice",
    sellableToday: true,
    honestyBoundary: "Support-scoped inbound voice worker with Knowledge + support Work routing.",
    requiredProveMissionIds: ["voice_calls", "knowledge_consult"],
    grantRequiredForOutbound: true,
    liveSlotBook: false,
    calendarHoldOnBook: false,
  },
  voice_custom_agent: {
    packageId: "voice_custom_agent",
    role: "custom_voice",
    sellableToday: false,
    honestyBoundary: "Human + platform services wrapper — operator-led engagement, not one-click install.",
    requiredProveMissionIds: ["voice_calls", "knowledge_consult", "outbound_approvals"],
    grantRequiredForOutbound: true,
    liveSlotBook: false,
    calendarHoldOnBook: false,
  },
});

export function listVoiceProductFamily() {
  return deepFreeze(
    VOICE_FAMILY_PACKAGE_IDS.map((id) => {
      const def = FAMILY[id];
      const pkg = getSalesPackage(id);
      return {
        ...def,
        label: pkg?.label ?? id,
        commercialStatus: pkg?.commercialStatus ?? "roadmap",
        catalogSellable: pkg?.sellable === true,
        launchMissionIds: pkg?.launchMissionIds ?? def.requiredProveMissionIds,
      };
    }),
  );
}

export function getVoiceProduct(packageId) {
  const id = String(packageId ?? "").trim();
  return listVoiceProductFamily().find((row) => row.packageId === id) ?? null;
}

export function voiceFamilyHonestyNote(packageId) {
  return getVoiceProduct(packageId)?.honestyBoundary ?? null;
}

export function isVoiceFamilySellableToday(packageId) {
  return getVoiceProduct(packageId)?.sellableToday === true;
}
