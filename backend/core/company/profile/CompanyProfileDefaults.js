const DEFAULT_VERSION = 1;

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function safeTrim(v) {
  return String(v ?? "").trim();
}

function buildDefaultBusinessHours() {
  // Deterministic “office hours” defaults.
  return {
    timeZone: "America/New_York",
    daysOfWeek: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    start: "09:00",
    end: "17:00",
  };
}

export function createCompanyProfileDefaults() {
  // Note: We intentionally do NOT “invent” primary contact email / phone / address / website.
  // Those fields are required for completion/validation.
  return Object.freeze({
    version: DEFAULT_VERSION,
    general: {
      companyName: "",
      industry: "",
      website: "",
      primaryContact: {
        name: "",
        email: "",
        phone: "",
      },
      address: {
        line1: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
      },
    },
    brand: {
      logo: "",
      primaryColor: "#0B5FFF",
      secondaryColor: "#00C2FF",
      brandAssets: [],
      defaultLogoVariants: ["primary", "monochrome"],
    },
    communications: {
      senderName: "",
      replyEmail: "",
      emailSignature: "",
      emailFooter: "",
      smsSignature: "",
    },
    operations: {
      timeZone: buildDefaultBusinessHours().timeZone,
      businessHours: buildDefaultBusinessHours(),
      officeLocations: [],
    },
    preferences: {
      defaultLanguage: "en-US",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "hh:mm A",
      currency: "USD",
    },
    metadata: {
      createdAtISO: "",
      updatedAtISO: "",
      version: DEFAULT_VERSION,
      completionStatus: "INCOMPLETE",
      completionPercent: 0,
      validation: { ok: false, issues: [] },
    },
    derived: {
      companyInitials: "",
      brandAbbreviation: "",
      displayTitle: "",
    },
  });
}

