function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

export function createCommunicationSetup(input = {}) {
  if (!input || typeof input !== "object") throw new Error("createCommunicationSetup: input required.");
  const required = ["sender", "emailBranding", "smsIdentity", "communicationDefaults", "readiness", "metadata", "quietHours"];
  for (const k of required) {
    if (!(k in input)) throw new Error(`createCommunicationSetup: missing ${k}`);
  }

  // Ensure booleans exist in readiness
  const r = input.readiness ?? {};
  const readiness = {
    emailReady: Boolean(r.emailReady),
    smsReady: Boolean(r.smsReady),
    brandReady: Boolean(r.brandReady),
    quietHoursReady: Boolean(r.quietHoursReady),
    approvalPolicyReady: Boolean(r.approvalPolicyReady),
  };

  const setup = {
    version: String(input.metadata?.version ?? ""),
    sender: {
      senderName: String(input.sender.senderName ?? ""),
      replyEmail: String(input.sender.replyEmail ?? ""),
      senderEmail: String(input.sender.senderEmail ?? input.sender.replyEmail ?? ""),
      displayName: String(input.sender.displayName ?? input.sender.senderName ?? ""),
    },
    emailBranding: {
      logo: String(input.emailBranding.logo ?? ""),
      primaryColor: String(input.emailBranding.primaryColor ?? ""),
      secondaryColor: String(input.emailBranding.secondaryColor ?? ""),
      emailSignature: String(input.emailBranding.emailSignature ?? ""),
      emailFooter: String(input.emailBranding.emailFooter ?? ""),
      brandedHeaderEnabled: Boolean(input.emailBranding.brandedHeaderEnabled ?? false),
    },
    smsIdentity: {
      smsSignature: String(input.smsIdentity.smsSignature ?? ""),
      businessName: String(input.smsIdentity.businessName ?? ""),
      optOutLanguage: String(input.smsIdentity.optOutLanguage ?? ""),
      quietHours: input.smsIdentity.quietHours ?? input.quietHours,
    },
    communicationDefaults: {
      defaultTone: String(input.communicationDefaults.defaultTone ?? "Professional"),
      defaultLanguage: String(input.communicationDefaults.defaultLanguage ?? ""),
      timeZone: String(input.communicationDefaults.timeZone ?? ""),
      businessHours: input.communicationDefaults.businessHours ?? {},
      approvalRequiredForFirstContact: Boolean(
        input.communicationDefaults.approvalRequiredForFirstContact ?? false,
      ),
      preferredChannels: Array.isArray(input.communicationDefaults.preferredChannels)
        ? input.communicationDefaults.preferredChannels.map(String)
        : [],
    },
    quietHours: input.quietHours ?? {},
    readiness,
    metadata: deepFreeze(input.metadata ?? {}),
  };

  return deepFreeze(setup);
}

