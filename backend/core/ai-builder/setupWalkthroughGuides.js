/**
 * Shared owner walkthrough copy for dry-run + post-live Home/Settings.
 * Keep in-app paths and external platform steps concrete.
 */

export const SETUP_GUIDES_BY_STEP = Object.freeze({
  email: {
    id: "email",
    title: "Connect business email",
    summary: "Teammates draft customer messages, but nothing sends without your approval — and email must be connected first.",
    whereInApp: "Connections → Business email",
    inApp: [
      "After go-live, open Connections in the left navigation.",
      "Select Business email.",
      "Click Connect and sign in with the inbox that should send and receive for your business.",
      "Confirm the connection shows Connected.",
    ],
    external: [
      "Use a Google Workspace or Microsoft 365 mailbox you own (not a personal throwaway).",
      "If Google asks for permission, allow VIBETech to send on your behalf — sends still wait for your approval inside VIBETech.",
    ],
  },
  calendar: {
    id: "calendar",
    title: "Connect Google Calendar",
    summary: "Scheduling can run in-app first; calendar sync publishes approved events to Google Calendar.",
    whereInApp: "Connections → Google Calendar",
    inApp: [
      "Open Connections → Google Calendar.",
      "Click Connect and choose the Google account that owns the business calendar.",
      "Approve calendar access when Google prompts you.",
      "Back in VIBETech, confirm the status is Connected.",
    ],
    external: [
      "In Google Calendar (calendar.google.com), make sure you can create events on the target calendar.",
      "If your organization uses Google Workspace, an admin may need to allow calendar access for third-party apps.",
    ],
  },
  sms: {
    id: "sms",
    title: "Connect text messaging (Twilio)",
    summary: "SMS outreach stays approval-gated. Connect Twilio so drafts can use a real number after you approve.",
    whereInApp: "Connections → Text messaging",
    inApp: [
      "Open Connections → Text messaging (Twilio).",
      "Click Connect and enter your Twilio Account SID and Auth Token (from the Twilio Console).",
      "Choose or paste the Twilio phone number that will send texts.",
      "Save and confirm the connection shows Connected.",
      "Complete A2P / 10DLC registration next if prompted — carriers require it for US business SMS.",
    ],
    external: [
      "Create or open your Twilio account at twilio.com/console.",
      "Copy Account SID and Auth Token from the Twilio Console dashboard.",
      "Buy or select a phone number under Phone Numbers → Manage → Active numbers.",
      "For US traffic: start A2P 10DLC brand + campaign registration in Twilio (Messaging → Regulatory Compliance) — this can take days for carrier approval.",
    ],
  },
  a2p_registration: {
    id: "a2p_registration",
    title: "Finish Twilio A2P / 10DLC registration",
    summary: "US carriers block most business SMS until A2P registration is complete — even if Twilio is connected.",
    whereInApp: "Connections → Text messaging → A2P",
    inApp: [
      "Open Connections → Text messaging.",
      "Open the A2P / 10DLC section and follow the on-screen checklist.",
      "Enter your legal business name, address, and use case exactly as they appear on official filings.",
      "Mark the step complete in VIBETech once Twilio shows the campaign as Approved.",
    ],
    external: [
      "In Twilio Console: Messaging → Regulatory Compliance → Brands / Campaigns.",
      "Register your Brand (EIN / business details), then create a Campaign that matches how you text customers.",
      "Wait for carrier approval — do not expect reliable SMS delivery until the campaign status is Approved.",
    ],
  },
  voice: {
    id: "voice",
    title: "Connect phone (Twilio Voice)",
    summary: "Live outbound calling may still be limited; connecting Twilio Voice prepares call scripts and follow-up queues.",
    whereInApp: "Connections → Phone",
    inApp: [
      "Open Connections → Phone (Twilio Voice).",
      "Connect with the same Twilio account used for SMS (or a dedicated Voice account).",
      "Select the Twilio number that should ring for business calls.",
      "Confirm Connected status in VIBETech.",
    ],
    external: [
      "In Twilio Console, enable Voice on your number (Phone Numbers → Active numbers → Voice configuration).",
      "Optionally configure a TwiML app or webhook later — VIBETech will guide you when voice actions go live.",
    ],
  },
  knowledge: {
    id: "knowledge",
    title: "Add approved business knowledge",
    summary: "AI teammates draft from facts you approve — upload policies, pricing, and FAQs so answers stay accurate.",
    whereInApp: "Knowledge",
    inApp: [
      "Open Knowledge from the left navigation.",
      "Click Add document and upload PDFs, DOCX, or paste key policies.",
      "Tag documents with the topics teammates should use (pricing, intake, scheduling, etc.).",
      "Confirm at least one document is Active before expecting high-quality drafts.",
    ],
    external: [],
  },
  team: {
    id: "team",
    title: "Invite your team",
    summary: "Owners and staff need memberships before they can use the right workspaces.",
    whereInApp: "Team",
    inApp: [
      "Open Team from the left navigation.",
      "Click Invite teammate and enter each person’s email.",
      "Assign the role that matches what they should see (Owner, Admin, Team member, etc.).",
      "Ask them to accept the invite email before expecting them on the team roster.",
    ],
    external: [
      "Have them check spam for the invite if it does not arrive within a few minutes.",
    ],
  },
});

export const SETUP_GUIDES_BY_INTEGRATION = Object.freeze({
  business_email: SETUP_GUIDES_BY_STEP.email,
  email: SETUP_GUIDES_BY_STEP.email,
  calendar: SETUP_GUIDES_BY_STEP.calendar,
  google_calendar: SETUP_GUIDES_BY_STEP.calendar,
  sms_channel: SETUP_GUIDES_BY_STEP.sms,
  sms: SETUP_GUIDES_BY_STEP.sms,
  text: SETUP_GUIDES_BY_STEP.sms,
  voice_channel: SETUP_GUIDES_BY_STEP.voice,
  voice: SETUP_GUIDES_BY_STEP.voice,
  phone: SETUP_GUIDES_BY_STEP.voice,
  meta_lead_ads: {
    id: "meta_lead_ads",
    title: "Connect Facebook Lead Ads",
    summary: "Until Meta sync ships fully, use email/web form intake — still connect Meta when you are ready to pull leads automatically.",
    whereInApp: "Connections → Facebook Lead Ads",
    inApp: [
      "Open Connections → Facebook Lead Ads.",
      "Click Connect and sign into the Meta Business account that owns your Page and lead forms.",
      "Select the Page and Lead Ads forms VIBETech should read.",
      "Confirm Connected. Until sync is fully live, also keep a web form or email intake path.",
    ],
    external: [
      "In Meta Business Suite (business.facebook.com), confirm you are Admin on the Page.",
      "Under Leads → Instant Forms, note which forms should sync.",
      "If Meta asks for permissions, allow leads retrieval for that business.",
    ],
  },
});

export const SETUP_GUIDES_BY_CAPABILITY = Object.freeze({
  scheduling: {
    id: "scheduling",
    title: "Turn on scheduling + connect calendar",
    summary: "Scheduling starts from Work + Connections. Google Calendar sync needs a connected calendar before events publish outside VIBETech.",
    whereInApp: "Work + Connections → Google Calendar",
    inApp: [
      "After go-live, open Work to create or review the first practice / appointment as in-app work (no calendar required yet).",
      "When you want events on Google Calendar: open Connections → Google Calendar and Connect.",
      "Approve an event in VIBETech before expecting it to appear on Google Calendar.",
    ],
    external: [
      "In Google Calendar, confirm you can edit the calendar you connect.",
      "Workspace admins may need to allow third-party calendar access.",
    ],
  },
});

export function getSetupGuide(stepId) {
  return SETUP_GUIDES_BY_STEP[String(stepId)]
    ?? SETUP_GUIDES_BY_INTEGRATION[String(stepId)]
    ?? SETUP_GUIDES_BY_CAPABILITY[String(stepId)]
    ?? null;
}

export function matchGuideFromText(text) {
  const lower = String(text).toLowerCase();
  if (/a2p|10dlc/.test(lower)) return SETUP_GUIDES_BY_STEP.a2p_registration;
  if (/sms|text messaging|twilio/.test(lower) && !/voice|phone/.test(lower)) return SETUP_GUIDES_BY_STEP.sms;
  if (/voice|phone/.test(lower)) return SETUP_GUIDES_BY_STEP.voice;
  if (/calendar|scheduling/.test(lower)) return SETUP_GUIDES_BY_CAPABILITY.scheduling;
  if (/email|inbox|gmail|outlook/.test(lower)) return SETUP_GUIDES_BY_STEP.email;
  if (/facebook|meta|lead ads/.test(lower)) return SETUP_GUIDES_BY_INTEGRATION.meta_lead_ads;
  if (/knowledge|document/.test(lower)) return SETUP_GUIDES_BY_STEP.knowledge;
  if (/invite|team/.test(lower)) return SETUP_GUIDES_BY_STEP.team;
  return null;
}
