import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const MODULE_PATH = new URL("./ProviderCatalog.js", import.meta.url);

/**
 * ProviderCatalog evaluates MICROSOFT_OAUTH_CONFIGURED once at module load (mirrors
 * how the rest of the catalog treats env as stable per server process). Re-import
 * with a cache-busting query string so each test observes a fresh evaluation of
 * the current env instead of a module cached from a previous test's env.
 */
async function importFreshCatalog() {
  const url = `${pathToFileURL(MODULE_PATH.pathname)}?t=${Date.now()}_${Math.random()}`;
  return import(url);
}

function withEnv(vars, fn) {
  const previous = {};
  for (const key of Object.keys(vars)) {
    previous[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(previous)) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    });
}

test("outlook / outlook_calendar are 'available' once Microsoft OAuth env is configured", async () => {
  await withEnv(
    { MICROSOFT_CLIENT_ID: "client_1", MICROSOFT_CLIENT_SECRET: "secret_1", APP_URL: "https://app.example.com" },
    async () => {
      const { getProvider } = await importFreshCatalog();
      const outlook = getProvider("outlook");
      const outlookCalendar = getProvider("outlook_calendar");
      assert.equal(outlook.status, "available");
      assert.equal(outlook.honestyNote, null);
      assert.equal(outlookCalendar.status, "available");
      assert.equal(outlookCalendar.honestyNote, null);
    },
  );
});

test("outlook / outlook_calendar stay 'planned' with an honesty note when Microsoft OAuth env is missing", async () => {
  await withEnv(
    {
      MICROSOFT_CLIENT_ID: undefined,
      MICROSOFT_CLIENT_SECRET: undefined,
      MICROSOFT_REDIRECT_URI: undefined,
      OUTLOOK_REDIRECT_URI: undefined,
      APP_URL: undefined,
      NEXTAUTH_URL: undefined,
    },
    async () => {
      const { getProvider } = await importFreshCatalog();
      const outlook = getProvider("outlook");
      const outlookCalendar = getProvider("outlook_calendar");
      assert.equal(outlook.status, "planned");
      assert.match(outlook.honestyNote, /not connectable yet/i);
      assert.equal(outlookCalendar.status, "planned");
      assert.match(outlookCalendar.honestyNote, /not connectable yet/i);
    },
  );
});

test("microsoft_365 / microsoft_calendar stay 'planned' regardless of Microsoft OAuth env (broader capabilities not implemented)", async () => {
  await withEnv(
    { MICROSOFT_CLIENT_ID: "client_1", MICROSOFT_CLIENT_SECRET: "secret_1", APP_URL: "https://app.example.com" },
    async () => {
      const { getProvider } = await importFreshCatalog();
      assert.equal(getProvider("microsoft_365").status, "planned");
      assert.equal(getProvider("microsoft_calendar").status, "planned");
    },
  );
});
