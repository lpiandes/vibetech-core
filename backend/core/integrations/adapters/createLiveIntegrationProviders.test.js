import test from "node:test";
import assert from "node:assert/strict";

import { createLiveIntegrationProviders, liveIntegrationAvailability } from "./createLiveIntegrationProviders.js";

function withEnv(vars, fn) {
  const previous = {};
  for (const key of Object.keys(vars)) {
    previous[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(previous)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("createLiveIntegrationProviders registers Outlook mail + calendar when Microsoft OAuth is configured", () => {
  withEnv(
    {
      MICROSOFT_CLIENT_ID: "client_1",
      MICROSOFT_CLIENT_SECRET: "secret_1",
      APP_URL: "https://app.example.com",
      GMAIL_CLIENT_ID: undefined,
      GOOGLE_CLIENT_ID: undefined,
    },
    () => {
      const providers = createLiveIntegrationProviders({ force: false });
      const ids = providers.map((p) => p.id);
      assert.ok(ids.includes("outlook"), `expected outlook provider, got: ${ids.join(", ")}`);
      assert.ok(ids.includes("outlook_calendar"), `expected outlook_calendar provider, got: ${ids.join(", ")}`);
    },
  );
});

test("createLiveIntegrationProviders omits Outlook adapters when Microsoft OAuth is not configured", () => {
  withEnv(
    {
      MICROSOFT_CLIENT_ID: undefined,
      MICROSOFT_CLIENT_SECRET: undefined,
      MICROSOFT_REDIRECT_URI: undefined,
      OUTLOOK_REDIRECT_URI: undefined,
      APP_URL: undefined,
      NEXTAUTH_URL: undefined,
    },
    () => {
      const providers = createLiveIntegrationProviders({ force: false });
      const ids = providers.map((p) => p.id);
      assert.equal(ids.includes("outlook"), false);
      assert.equal(ids.includes("outlook_calendar"), false);
    },
  );
});

test("liveIntegrationAvailability reflects Microsoft OAuth configuration for outlook flags and shared email/calendar keys", () => {
  withEnv(
    {
      MICROSOFT_CLIENT_ID: "client_1",
      MICROSOFT_CLIENT_SECRET: "secret_1",
      APP_URL: "https://app.example.com",
      GMAIL_CLIENT_ID: undefined,
      GOOGLE_CLIENT_ID: undefined,
    },
    () => {
      const flags = liveIntegrationAvailability();
      assert.equal(flags._microsoftOAuth, true);
      assert.equal(flags.outlook_mail, true);
      assert.equal(flags.outlook_calendar, true);
      // Shared connection types stay available when either Google or Microsoft is configured.
      assert.equal(flags.business_email_oauth, true);
      assert.equal(flags.calendar, true);
    },
  );

  withEnv(
    {
      MICROSOFT_CLIENT_ID: undefined,
      MICROSOFT_CLIENT_SECRET: undefined,
      MICROSOFT_REDIRECT_URI: undefined,
      OUTLOOK_REDIRECT_URI: undefined,
      APP_URL: undefined,
      NEXTAUTH_URL: undefined,
      GMAIL_CLIENT_ID: undefined,
      GOOGLE_CLIENT_ID: undefined,
    },
    () => {
      const flags = liveIntegrationAvailability();
      assert.equal(flags._microsoftOAuth, false);
      assert.equal(flags.outlook_mail, false);
      assert.equal(flags.outlook_calendar, false);
      assert.equal(flags.business_email_oauth, false);
      assert.equal(flags.calendar, false);
    },
  );
});
