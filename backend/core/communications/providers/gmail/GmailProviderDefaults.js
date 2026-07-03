export const GMAIL_PROVIDER_ID = "gmail_provider";

export const GMAIL_PROVIDER_NAME = "Gmail Communication Provider";

export const GMAIL_SUPPORTED_CHANNELS = ["email"];

export const GMAIL_HEALTH = {
  ok: "healthy",
  not_configured: "not_configured",
};

export const REQUIRED_ENV_VARS = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REDIRECT_URI",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_SENDER_EMAIL",
];

export const PROVIDER_SEND_SOURCE = "gmail_provider_adapter";

