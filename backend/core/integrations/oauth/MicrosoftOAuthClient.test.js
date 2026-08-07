import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMicrosoftAuthorizeUrl,
  exchangeMicrosoftAuthorizationCode,
  refreshMicrosoftAccessToken,
  isMicrosoftOAuthAppConfigured,
  getMicrosoftOAuthAppConfig,
  getMicrosoftTenantId,
  microsoftScopesIncludeMailSend,
  callMicrosoftGraph,
  OUTLOOK_MAIL_OAUTH_SCOPES,
} from "./MicrosoftOAuthClient.js";

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

test("getMicrosoftTenantId defaults to common", async () => {
  await withEnv({ MICROSOFT_TENANT_ID: undefined }, () => {
    assert.equal(getMicrosoftTenantId(), "common");
  });
  await withEnv({ MICROSOFT_TENANT_ID: "contoso-tenant" }, () => {
    assert.equal(getMicrosoftTenantId(), "contoso-tenant");
  });
});

test("isMicrosoftOAuthAppConfigured requires client id, secret, and a redirect uri", async () => {
  await withEnv(
    { MICROSOFT_CLIENT_ID: undefined, MICROSOFT_CLIENT_SECRET: undefined, MICROSOFT_REDIRECT_URI: undefined, APP_URL: undefined, NEXTAUTH_URL: undefined },
    () => {
      assert.equal(isMicrosoftOAuthAppConfigured(), false);
    },
  );
  await withEnv(
    { MICROSOFT_CLIENT_ID: "client_1", MICROSOFT_CLIENT_SECRET: "secret_1", APP_URL: "https://app.example.com" },
    () => {
      assert.equal(isMicrosoftOAuthAppConfigured(), true);
      const config = getMicrosoftOAuthAppConfig();
      assert.equal(config.clientId, "client_1");
      assert.equal(config.redirectUri, "https://app.example.com/api/integrations/oauth/microsoft/callback");
    },
  );
});

test("buildMicrosoftAuthorizeUrl encodes tenant, scopes, and state", async () => {
  await withEnv(
    { MICROSOFT_CLIENT_ID: "client_1", MICROSOFT_CLIENT_SECRET: "secret_1", MICROSOFT_TENANT_ID: "common", APP_URL: "https://app.example.com" },
    () => {
      const url = new URL(buildMicrosoftAuthorizeUrl({ state: "state_abc", scopes: OUTLOOK_MAIL_OAUTH_SCOPES }));
      assert.equal(url.origin, "https://login.microsoftonline.com");
      assert.equal(url.pathname, "/common/oauth2/v2.0/authorize");
      assert.equal(url.searchParams.get("client_id"), "client_1");
      assert.equal(url.searchParams.get("state"), "state_abc");
      assert.equal(url.searchParams.get("redirect_uri"), "https://app.example.com/api/integrations/oauth/microsoft/callback");
      assert.match(url.searchParams.get("scope"), /Mail\.Send/);
    },
  );
});

test("exchangeMicrosoftAuthorizationCode exchanges the code and fetches the account email", async () => {
  await withEnv(
    { MICROSOFT_CLIENT_ID: "client_1", MICROSOFT_CLIENT_SECRET: "secret_1", APP_URL: "https://app.example.com" },
    async () => {
      const calls = [];
      const fetchImpl = async (url, init) => {
        calls.push(String(url));
        if (String(url).includes("/oauth2/v2.0/token")) {
          const body = new URLSearchParams(init.body);
          assert.equal(body.get("grant_type"), "authorization_code");
          assert.equal(body.get("code"), "auth_code_1");
          return {
            ok: true,
            json: async () => ({
              access_token: "at_1",
              refresh_token: "rt_1",
              expires_in: 3600,
              scope: "Mail.Send User.Read",
              token_type: "Bearer",
            }),
          };
        }
        if (String(url).endsWith("/me")) {
          return { ok: true, json: async () => ({ mail: "owner@contoso.com" }) };
        }
        throw new Error(`unexpected fetch: ${url}`);
      };
      const result = await exchangeMicrosoftAuthorizationCode({ code: "auth_code_1", fetchImpl });
      assert.equal(result.accessToken, "at_1");
      assert.equal(result.refreshToken, "rt_1");
      assert.equal(result.senderEmail, "owner@contoso.com");
      assert.equal(calls.length, 2);
    },
  );
});

test("microsoftScopesIncludeMailSend matches case-insensitively across scope strings", () => {
  assert.equal(microsoftScopesIncludeMailSend("offline_access", "https://graph.microsoft.com/mail.send"), true);
  assert.equal(microsoftScopesIncludeMailSend("User.Read"), false);
});

test("refreshMicrosoftAccessToken posts a refresh_token grant and returns the new access token", async () => {
  await withEnv(
    { MICROSOFT_CLIENT_ID: "client_1", MICROSOFT_CLIENT_SECRET: "secret_1", APP_URL: "https://app.example.com" },
    async () => {
      const fetchImpl = async (url, init) => {
        const body = new URLSearchParams(init.body);
        assert.equal(body.get("grant_type"), "refresh_token");
        assert.equal(body.get("refresh_token"), "rt_1");
        return { ok: true, json: async () => ({ access_token: "at_new", refresh_token: "rt_1", expires_in: 3600 }) };
      };
      const result = await refreshMicrosoftAccessToken({ refreshToken: "rt_1", fetchImpl });
      assert.equal(result.accessToken, "at_new");
    },
  );
});

test("callMicrosoftGraph refreshes once on 401 and retries with the new token", async () => {
  await withEnv(
    { MICROSOFT_CLIENT_ID: "client_1", MICROSOFT_CLIENT_SECRET: "secret_1", APP_URL: "https://app.example.com" },
    async () => {
      let attempts = 0;
      const fetchImpl = async (url, init) => {
        if (String(url).includes("/oauth2/v2.0/token")) {
          return { ok: true, json: async () => ({ access_token: "at_new", refresh_token: "rt_1", expires_in: 3600 }) };
        }
        attempts += 1;
        if (init.headers.Authorization === "Bearer at_stale") {
          return { ok: false, status: 401, json: async () => ({ error: { message: "expired" } }) };
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      };
      const { res, accessToken } = await callMicrosoftGraph({
        path: "/me",
        accessToken: "at_stale",
        refreshToken: "rt_1",
        fetchImpl,
      });
      assert.equal(res.ok, true);
      assert.equal(accessToken, "at_new");
      assert.equal(attempts, 2);
    },
  );
});
