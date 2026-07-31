export const PRODUCT_TOUR_VERSION = 1;

export type ProductTourStep = {
  id: string;
  title: string;
  body: string;
  navHint?: string;
  hrefSuffix?: string;
};

/** Forced first-run tour — Ask VIBETech style, step k of N. */
export const PRODUCT_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    title: "Welcome to your operating system",
    body: "This short tour shows the places you’ll use every day to run the business. You can’t skip it — tap Next to continue.",
    navHint: "Home",
    hrefSuffix: "/home",
  },
  {
    id: "home",
    title: "Home — missions & overview",
    body: "Home is your launch pad: setup missions, what’s waiting, and a clear next step. Finish missions so automations and channels are proven live.",
    navHint: "Home",
    hrefSuffix: "/home",
  },
  {
    id: "needs_attention",
    title: "Needs Attention",
    body: "Anything that needs a human decision lands here — approvals, exceptions, and AI teammates asking for help. Check it like an inbox for the business.",
    navHint: "Needs Attention",
    hrefSuffix: "/needs-attention",
  },
  {
    id: "people",
    title: "People",
    body: "Leads and customers live in People. Meta forms, website intake, and SMS conversations attach here so nothing is stuck in a spreadsheet.",
    navHint: "People",
    hrefSuffix: "/crm/contacts",
  },
  {
    id: "automations",
    title: "Automations",
    body: "Automations fire when leads arrive or events happen. Use Test workflow to prove texts, emails, and pipeline moves before going live.",
    navHint: "Automations",
    hrefSuffix: "/automations",
  },
  {
    id: "knowledge",
    title: "Knowledge",
    body: "Upload playbooks and FAQs so AI teammates answer in your voice. Without Knowledge, receptionists and drafts stay generic.",
    navHint: "Knowledge",
    hrefSuffix: "/knowledge",
  },
  {
    id: "integrations",
    title: "Integrations",
    body: "Connect email, calendar, texting, voice, and Meta Lead Forms. VIBETech handles white-glove Meta/Twilio setup when you request it — you don’t paste Graph API tokens.",
    navHint: "Integrations",
    hrefSuffix: "/integrations",
  },
  {
    id: "ask",
    title: "Ask VIBETech",
    body: "Ask is your AI builder and change partner. Use it to adjust packages, propose operating changes, or clarify how something should work — then review before it goes live.",
    navHint: "Ask",
    hrefSuffix: "/architect",
  },
  {
    id: "approvals",
    title: "Approvals gate",
    body: "Customer-facing sends stay gated until you GRANT. That keeps SMS and email from going out without you — even when automations draft them.",
    navHint: "Needs Attention",
    hrefSuffix: "/needs-attention",
  },
  {
    id: "settings",
    title: "Settings & restart",
    body: "Team, billing, and account live in Settings. You can replay this tutorial anytime from Settings → See tutorial again.",
    navHint: "Settings",
    hrefSuffix: "/settings",
  },
];
