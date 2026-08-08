/**
 * Locked ops playbooks for white-glove handoffs.
 * Every connector request should render steps from here — no ad-hoc email copy.
 */

function safe(v) {
  return v == null ? "" : String(v).trim();
}

function fill(template, vars = {}) {
  return String(template ?? "").replace(/\{\{(\w+)\}\}/g, (_, key) => safe(vars[key]) || `(${key})`);
}

/** Industry creative briefs for Meta Lead Ads (paste-ready). */
export function buildMetaCreativeBrief({
  industry = "",
  businessName = "",
  offer = "",
  geo = "",
  website = "",
} = {}) {
  const name = safe(businessName) || "the business";
  const ind = safe(industry).toLowerCase() || "generic";
  const offerLine = safe(offer) || "your primary offer";
  const area = safe(geo) || "your service area";
  const site = safe(website) || "your website";

  const byIndustry = {
    sports: {
      headline: `${name}: register for the season`,
      primaryText: `Spots fill fast. Get schedule, pricing, and next steps for ${offerLine} in ${area}. Reply or submit the form — a coach will follow up.`,
      imagePrompt: `Photoreal sports action photo, youth or adult athletes training, energetic lighting, jersey colors, clean negative space for text overlay "${name}", no logos of real teams, 1080x1080`,
      videoScript: [
        "0–2s: Athlete in motion + logo slate",
        `2–6s: On-screen: ${offerLine} — ${area}`,
        "6–10s: Parents/athletes smiling; CTA “Get details”",
        "10–15s: End card with Lead Form CTA",
      ],
    },
    dental: {
      headline: `${name}: book your visit`,
      primaryText: `New patients welcome. ${offerLine} in ${area}. Fast form — we’ll confirm by text or call. No spam.`,
      imagePrompt: `Bright modern dental office, friendly hygienist silhouette (no faces identifiable), soft teal accents, overlay space for "${name}", 1080x1080`,
      videoScript: [
        "0–3s: Smile / clean office B-roll",
        `3–8s: Text: ${offerLine}`,
        "8–12s: “Takes 30 seconds to request a time”",
        "12–15s: Lead Form CTA",
      ],
    },
    wellness: {
      headline: `${name}: feel better sooner`,
      primaryText: `${offerLine} for clients in ${area}. Tell us your goals — we’ll reach out with next steps.`,
      imagePrompt: `Calm wellness studio, natural light, mobility/therapy vibe, brandable space for "${name}", 1080x1080`,
      videoScript: [
        "0–3s: Calm movement / stretch",
        `3–8s: ${offerLine}`,
        "8–12s: Soft CTA to Instant Form",
        "12–15s: Logo + Lead Form",
      ],
    },
    generic: {
      headline: `${name}: get started today`,
      primaryText: `Interested in ${offerLine}? Serving ${area}. Submit the short form and we’ll follow up quickly.`,
      imagePrompt: `Professional local business hero image for "${name}", clean modern branding, space for headline text, 1080x1080`,
      videoScript: [
        "0–3s: Business intro slate",
        `3–8s: ${offerLine} · ${area}`,
        "8–12s: Social proof / trust line",
        "12–15s: Lead Form CTA",
      ],
    },
  };

  const key = ind.includes("sport") || ind.includes("hockey") || ind.includes("soccer")
    ? "sports"
    : ind.includes("dental") || ind.includes("ortho")
      ? "dental"
      : ind.includes("well") || ind.includes("physio") || ind.includes("mobility") || ind.includes("therapy")
        ? "wellness"
        : "generic";

  const brief = byIndustry[key];
  return {
    industryKey: key,
    businessName: name,
    website: site,
    headline: brief.headline,
    primaryText: brief.primaryText,
    imagePrompt: brief.imagePrompt,
    videoScript: brief.videoScript,
    canvaTips: [
      "Square 1080×1080 for Feed; 1080×1920 for Stories/Reels.",
      "Keep text under ~20% of image; put detail in primary text.",
      "End card must include clear Lead Form CTA.",
    ],
  };
}

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   when: string,
 *   prerequisites?: string[],
 *   steps: string[],
 *   verifyChecklist?: string[],
 *   creativeBrief?: Record<string, unknown> | null,
 * }} OpsPlaybook
 */

const PLAYBOOK_BUILDERS = {
  meta_lead_connect_existing({ origin, businessId, businessName, pageName, pageUrl, webhookUrl, integrationsHref, adminHref }) {
    const name = safe(businessName) || businessId;
    return {
      id: "meta_lead_connect_existing",
      title: `Connect existing Meta Lead Forms — ${name}`,
      when: "Client already has a Facebook Page / Lead Ads and requested VIBETech connect.",
      prerequisites: [
        pageName || pageUrl
          ? `Page: ${[pageName, pageUrl].filter(Boolean).join(" — ")}`
          : "Confirm which Facebook Page runs Lead Ads with the owner.",
        "You have access to Meta Developers (VIBETech app) and Ads Manager.",
      ],
      steps: [
        `Open Admin for “${name}”: ${origin}${adminHref}`,
        "Use Support access if you need owner-level integrations.",
        "Confirm a Lead Form exists on that Page (Instant Form with name, email, phone + privacy policy URL).",
        "Meta Developers → Graph API Explorer (VIBETech app): User token with pages_show_list, pages_read_engagement, leads_retrieval, pages_manage_metadata.",
        "GET /me/accounts → copy Page id + page access_token for the correct Page.",
        `POST ${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/meta with JSON { "pageId": "...", "pageAccessToken": "..." } (ops only — never ask the client).`,
        `Confirm Page subscribed to leadgen + Webhooks callback ${webhookUrl} (verify token = META_LEAD_VERIFY_TOKEN env).`,
        "Send a test lead from Meta → People + META_LEAD automation drafts.",
        `Confirm Integrations shows connected: ${integrationsHref}`,
      ],
      verifyChecklist: [
        "Test lead appears in People",
        "META_LEAD automation created a draft (approval-gated)",
        "Integrations → Meta Lead Forms = Connected",
      ],
      creativeBrief: null,
    };
  },

  meta_lead_create_from_scratch({
    origin, businessId, businessName, webhookUrl, integrationsHref, adminHref, industry, offer, geo, website,
  }) {
    const name = safe(businessName) || businessId;
    const creativeBrief = buildMetaCreativeBrief({
      industry, businessName: name, offer, geo, website,
    });
    return {
      id: "meta_lead_create_from_scratch",
      title: `Build + connect Meta Lead Forms — ${name}`,
      when: "Client has NO Facebook Page / Lead Ads — white-glove from scratch, then connect.",
      prerequisites: [
        "Schedule a short call or gather: Facebook login owner, website, privacy policy URL, service area, offer.",
        `Privacy policy for ads: ${website ? `${website}/privacy` : "https://vtechdevelopment.com/privacy"} (or client site).`,
      ],
      steps: [
        `Open Admin for “${name}”: ${origin}${adminHref}`,
        "Create/claim a Facebook Page for the business (or guide them on a call).",
        "Ads Manager → Leads campaign → Instant Form (name, email, phone + privacy policy URL).",
        "Publish a small test Lead Ad ($5–$20/day) so a real leadgen event can fire.",
        "CREATIVE — Headline: " + creativeBrief.headline,
        "CREATIVE — Primary text: " + creativeBrief.primaryText,
        "CREATIVE — Image prompt (Canva/AI): " + creativeBrief.imagePrompt,
        "CREATIVE — Video outline: " + creativeBrief.videoScript.join(" | "),
        "Meta Developers → Graph API Explorer (VIBETech app): User token with pages_show_list, pages_read_engagement, leads_retrieval, pages_manage_metadata.",
        "GET /me/accounts → copy Page id + page access_token.",
        `POST ${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/meta with { pageId, pageAccessToken } (ops only).`,
        `Webhooks: ${webhookUrl} (META_LEAD_VERIFY_TOKEN).`,
        "Send a test lead → People + META_LEAD drafts.",
        `Confirm connected: ${integrationsHref}`,
      ],
      verifyChecklist: [
        "Page + Lead Form live",
        "Test ad can generate a lead",
        "Platform connection Connected",
        "Test lead ingested",
      ],
      creativeBrief,
    };
  },

  twilio_voice_connect({ origin, businessId, businessName, integrationsHref, adminHref, ownerCell, notes }) {
    const name = safe(businessName) || businessId;
    const cell = safe(ownerCell);
    return {
      id: "twilio_voice_connect",
      title: `Set up business phone — ${name}`,
      when: "Owner requested business phone. They should NOT paste Twilio SID/token — you do this.",
      prerequisites: [
        "Access to the company Twilio account (or create one under VIBETech).",
        cell ? `Owner cell for ring-first: ${cell}` : "Ask owner for their cell if missed-call ring-first is wanted.",
        "SMS channel ideally ready so missed-call texts can send (can finish after voice).",
      ],
      steps: [
        `Open Admin for this business: ${origin}${adminHref}`,
        "Buy or pick a voice-capable Twilio number (or reuse the SMS number if it supports voice).",
        "In Twilio Console → Phone number → Voice & Fax: set A CALL COMES IN webhook (HTTP POST) to the business inbound voice URL (from Integrations after you connect, or /api/businesses/{id}/integrations/voice/inbound).",
        `Connect credentials in the platform (Support access → Integrations → Business phone → advanced “I have Twilio”, OR put durable cred_twilio_voice_${businessId}). Use Account SID, Auth Token, From number.`,
        cell
          ? `Turn on “Ring my phone first” and set forward/cell to ${cell}.`
          : "If they want missed-call texts: enable ring-first and enter their cell.",
        notes ? `Owner notes: ${notes}` : null,
        "Call the Twilio number once → confirm AI receptionist or missed-call path works.",
        `Mark ready in Admin (Ops setup) so the owner sees Good to go: ${origin}${adminHref}`,
        `Owner Integrations: ${integrationsHref}`,
      ].filter(Boolean),
      verifyChecklist: [
        "Voice connection shows Connected",
        "Test call reaches receptionist or missed-call SMS",
        "Owner Today checklist can complete “Connect business phone”",
      ],
      creativeBrief: null,
    };
  },

  twilio_sms_provision({ origin, businessId, businessName, integrationsHref, adminHref, fromNumber, a2pStatus, notes }) {
    const name = safe(businessName) || businessId;
    return {
      id: "twilio_sms_provision",
      title: `Set up text messaging — ${name}`,
      when: "Owner requested texting. You buy the number + finish carrier approval. Owner only gave business/legal details if asked.",
      prerequisites: [
        "Company Twilio account available.",
        "Legal business name + EIN (from owner form or ask them) matching IRS records.",
      ],
      steps: [
        `Open Admin: ${origin}${adminHref}`,
        fromNumber
          ? `Number already on file: ${fromNumber}. Confirm Messaging webhook points at VIBETech SMS inbound.`
          : "Buy a Twilio number (US) OR run in-app SMS provision with master Twilio env credentials.",
        "Set Messaging webhook (POST) to the business SMS inbound URL.",
        "Trust Hub / Brand / Campaign (A2P): use exact legal name + EIN. Sample texts must include STOP. Privacy + Terms URLs required.",
        "Save credentials on the business (durable twilio_sms credential) if not already.",
        "Send a test text to the owner’s phone.",
        a2pStatus ? `Current carrier status: ${a2pStatus}. Recheck Twilio Trust Hub if pending/rejected.` : "Watch carrier approval (can take days for US).",
        notes ? `Owner notes: ${notes}` : null,
        `Mark ready in Admin when Connected: ${origin}${adminHref}`,
        `Owner Integrations: ${integrationsHref}`,
      ].filter(Boolean),
      verifyChecklist: [
        "fromNumber on SMS credential",
        "Test SMS received",
        "Owner sees Good to go / Connected",
      ],
      creativeBrief: null,
    };
  },

  hubspot_connect({ origin, businessId, businessName, integrationsHref, adminHref, notes }) {
    const name = safe(businessName) || businessId;
    return {
      id: "hubspot_connect",
      title: `Connect HubSpot — ${name}`,
      when: "Owner requested HubSpot sync. You paste the private app token — they should not.",
      prerequisites: [
        "HubSpot portal access (owner invites you, or they create a Private App).",
        "Scopes: crm.objects.contacts read/write (minimum).",
      ],
      steps: [
        `Open Admin: ${origin}${adminHref}`,
        "In HubSpot: Settings → Integrations → Private Apps → Create app → Contacts read/write → copy access token.",
        `In the business workspace (Support access): Integrations → HubSpot → paste token and connect.`,
        "Run Test it works (sync a test contact) — confirm a HubSpot record id comes back.",
        notes ? `Owner notes: ${notes}` : null,
        `Mark ready: ${origin}${adminHref}`,
        `Owner view: ${integrationsHref}`,
      ].filter(Boolean),
      verifyChecklist: [
        "HubSpot Connected",
        "Test contact sync has provider id",
      ],
      creativeBrief: null,
    };
  },

  highlevel_connect({ origin, businessId, businessName, integrationsHref, adminHref, notes }) {
    const name = safe(businessName) || businessId;
    return {
      id: "highlevel_connect",
      title: `Connect HighLevel — ${name}`,
      when: "Owner requested HighLevel sync. You connect API key + location — they should not dig through console alone.",
      prerequisites: [
        "HighLevel agency/location access.",
        "API key + Location ID for that sub-account.",
      ],
      steps: [
        `Open Admin: ${origin}${adminHref}`,
        "In HighLevel: get API key and Location ID for this client’s location.",
        "Support access → Integrations → HighLevel → paste key + location → connect.",
        "Test contact sync — confirm HighLevel record id.",
        notes ? `Owner notes: ${notes}` : null,
        `Mark ready: ${origin}${adminHref}`,
        `Owner view: ${integrationsHref}`,
      ].filter(Boolean),
      verifyChecklist: [
        "HighLevel Connected",
        "Test sync has provider id",
      ],
      creativeBrief: null,
    };
  },

  salesforce_connect({ origin, businessId, businessName, integrationsHref, adminHref, notes }) {
    const name = safe(businessName) || businessId;
    return {
      id: "salesforce_connect",
      title: `Salesforce Custom Build — ${name}`,
      when: "Owner requested Salesforce. There is no in-app token paste — scope a Custom Build / SOW, then attest ready.",
      prerequisites: [
        "Salesforce org access (or partner login) for this client.",
        "Clear SOW: objects, sync direction, auth (Connected App / JWT), go-live criteria.",
      ],
      steps: [
        `Open Admin: ${origin}${adminHref}`,
        "Confirm owner notes and which Salesforce objects matter (Contacts, Leads, Opportunities, custom).",
        "Open or create a Custom Build / SOW — do not invent an in-app Connected status.",
        "Deliver integration work outside the fake CRM connect modal.",
        notes ? `Owner notes: ${notes}` : null,
        `When SOW is delivered / ready for owner sign-off: Mark ready on Admin (attestation — Connected vault not required).`,
        `Owner view: ${integrationsHref}`,
      ].filter(Boolean),
      verifyChecklist: [
        "SOW accepted or delivery criteria met",
        "Owner sees Good to go / ready copy for Salesforce",
        "No fake Connected badge without real Salesforce work",
      ],
      creativeBrief: null,
    };
  },
};

export function listOpsPlaybookIds() {
  return Object.keys(PLAYBOOK_BUILDERS);
}

/**
 * Build a locked playbook by id with runtime vars.
 * @returns {OpsPlaybook}
 */
export function buildOpsPlaybook(playbookId, vars = {}) {
  const builder = PLAYBOOK_BUILDERS[playbookId];
  if (!builder) {
    throw new Error(`Unknown ops playbook: ${playbookId}`);
  }
  const playbook = builder(vars);
  return {
    ...playbook,
    steps: (playbook.steps ?? []).map((s) => fill(s, vars)),
    prerequisites: (playbook.prerequisites ?? []).map((s) => fill(s, vars)),
    verifyChecklist: (playbook.verifyChecklist ?? []).map((s) => fill(s, vars)),
  };
}

/** Format playbook into plain-text email body. */
export function formatOpsPlaybookEmail(playbook, { summary = "", extraLines = [] } = {}) {
  const lines = [
    playbook.title,
    playbook.when,
    summary ? "" : null,
    summary || null,
    "",
    "Prerequisites:",
    ...(playbook.prerequisites ?? []).map((s, i) => `  ${i + 1}. ${s}`),
    "",
    "Steps:",
    ...(playbook.steps ?? []).map((s, i) => `  ${i + 1}. ${s}`),
    "",
    "Verify:",
    ...(playbook.verifyChecklist ?? []).map((s, i) => `  ${i + 1}. ${s}`),
  ].filter((x) => x != null);

  if (playbook.creativeBrief) {
    const c = playbook.creativeBrief;
    lines.push(
      "",
      "Creative brief (locked):",
      `  Headline: ${c.headline}`,
      `  Primary text: ${c.primaryText}`,
      `  Image prompt: ${c.imagePrompt}`,
      `  Video: ${(c.videoScript ?? []).join(" / ")}`,
      ...(c.canvaTips ?? []).map((t) => `  Tip: ${t}`),
    );
  }

  for (const line of extraLines) lines.push(line);
  return lines.join("\n");
}

export function playbookToOperatorAction(playbook, {
  businessId,
  businessName,
  href,
  urgency = "high",
  payload = {},
} = {}) {
  return {
    id: `${playbook.id}:${businessId}:${Date.now()}`,
    kind: playbook.id,
    urgency,
    title: playbook.title,
    summary: playbook.when,
    businessId,
    businessName,
    href,
    steps: playbook.steps,
    payload: {
      playbookId: playbook.id,
      prerequisites: playbook.prerequisites,
      verifyChecklist: playbook.verifyChecklist,
      creativeBrief: playbook.creativeBrief ?? null,
      ...payload,
    },
    createdAt: new Date().toISOString(),
  };
}
