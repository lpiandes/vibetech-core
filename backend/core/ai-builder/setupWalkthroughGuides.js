/**
 * Shared owner walkthrough copy for dry-run + post-live Home/Settings.
 * Keep in-app paths and external platform steps concrete.
 */

export const SETUP_GUIDES_BY_STEP = Object.freeze({
  email: {
    id: "email",
    title: "Choose customer email inbox",
    summary: "Your VIBETech login identifies you. This separate permission lets approved customer email send through the mailbox you choose.",
    whereInApp: "Connections → Customer email inbox",
    inApp: [
      "After go-live, open Connections in the left navigation.",
      "Select Customer email inbox.",
      "Click Choose inbox and sign in with the mailbox that should send and receive for your business. It can be the same Google account you used to sign into VIBETech.",
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
    title: "Connect text messaging",
    summary: "VIBETech provisions a Twilio number from your business details — then you prove with a test text.",
    whereInApp: "Home → Connect text messaging (or Connections → Text messaging)",
    inApp: [
      "Open Connect text messaging from Home or Integrations",
      "Enter legal business name and address (used for carrier brand registration)",
      "Optional: preferred area code",
      "Tap Set up texting for my business — we buy/assign a number",
      "When the number is ready, run Send test text on Home and confirm you received it",
    ],
    external: [
      "No Twilio Console required for standard setup",
      "US customer texts may wait until A2P brand/campaign is approved (can take days)",
      "Advanced: you can still paste your own Twilio SID/token/From if you prefer",
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
    title: "Connect Meta Lead Forms",
    summary: "Pull Facebook lead-form submissions into the intake queue after you connect the Page and verify a test lead.",
    whereInApp: "Connections → Meta Lead Forms",
    inApp: [
      "Open Connections → Meta Lead Forms.",
      "Click Connect and sign into the Meta Business account that owns your Page and lead forms.",
      "Select the Page and Lead Ads forms VIBETech should read.",
      "Confirm Connected, then submit a Meta test lead and confirm it appears in your intake queue.",
    ],
    external: [
      "In Meta Business Suite (business.facebook.com), confirm you are Admin on the Page.",
      "Under Leads → Instant Forms, note which forms should sync.",
      "If Meta asks for permissions, allow leads retrieval for that business.",
    ],
  },
  google_search_console: {
    id: "google_search_console",
    title: "Connect Google Search Console",
    summary: "Read verified website search performance. This is reporting only — SEO changes remain owner-approved work.",
    whereInApp: "Connections → Google Search Console",
    inApp: ["Open Connections → Google Search Console.", "Click Connect with Google and approve read-only access.", "Choose the Google account that can see the verified website property.", "Confirm Connected, then run a search-performance report."],
    external: ["Verify the website in Google Search Console before connecting.", "Make sure the selected Google account is an Owner or Full user for that property."],
  },
  google_ads: {
    id: "google_ads",
    title: "Connect Google Ads",
    summary: "Read campaign performance and create owner-approved campaign changes. No campaign can be created without approval.",
    whereInApp: "Connections → Google Ads",
    inApp: ["Open Connections → Google Ads.", "Enter the Ads customer ID, developer token, and access token.", "Click Connect and confirm the account probe passes.", "Run a performance report before asking VIBETech to draft a campaign."],
    external: ["In Google Ads, confirm the selected account has API access.", "Create or obtain a Google Ads API developer token and ensure it is approved for your use case.", "If a manager account is used, copy its ID as well."],
  },
  meta_ads: {
    id: "meta_ads",
    title: "Connect Meta Ads",
    summary: "Read performance and create owner-approved campaigns as paused drafts. Activation stays in your hands.",
    whereInApp: "Connections → Meta Ads",
    inApp: ["Open Connections → Meta Ads.", "Enter the Meta ad-account ID and access token.", "Click Connect and confirm the account probe passes.", "Review the first paused campaign draft in Meta Ads Manager before activating it."],
    external: ["In Meta Business Suite, confirm the token owner can manage the selected ad account.", "Use a current token with ads_read and ads_management permissions.", "Set META_GRAPH_API_VERSION on the VIBETech server to a currently supported Meta Graph API version."],
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
