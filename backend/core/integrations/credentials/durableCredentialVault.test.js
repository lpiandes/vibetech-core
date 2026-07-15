import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

process.env.DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ?? "postgresql://vibetech:vibetech@localhost:5432/vibetech_test";
process.env.VIBETECH_TEST_DB = "1";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-auth-secret-for-credentials";

import { runMigrations } from "../../platform/db/migrate.js";
import { closePool } from "../../platform/db/pool.js";
import { platformStore } from "../../platform/persistence/platformStore.js";
import { resetSharedCredentialVaultForTests, getSharedCredentialVault } from "./CredentialVault.js";
import {
  putDurableCredential,
  hydrateWorkspaceCredentials,
} from "./durableCredentialVault.js";
import { encryptIntegrationSecrets, decryptIntegrationSecrets } from "./IntegrationCredentialCrypto.js";

describe("durable integration credentials", () => {
  before(async () => {
    await runMigrations();
  });

  after(async () => {
    await closePool();
  });

  it("encrypts and decrypts secrets", () => {
    const cipher = encryptIntegrationSecrets({ refreshToken: "rt_1", accountSid: "ACxx" });
    const plain = decryptIntegrationSecrets(cipher);
    assert.equal(plain.refreshToken, "rt_1");
    assert.equal(plain.accountSid, "ACxx");
  });

  it("persists credentials and hydrates into a fresh vault", async () => {
    const business = await platformStore.createBusiness({
      name: `Cred Persist ${Date.now()}`,
      kind: "NORMAL",
    });
    const vault = resetSharedCredentialVaultForTests();
    const credentialId = `cred_gmail_${business.id}`;

    await putDurableCredential({
      platformStore,
      vault,
      workspaceId: business.id,
      credentialId,
      providerType: "gmail",
      secrets: { refreshToken: "persist-me", senderEmail: "ops@example.com" },
      metadata: { senderEmail: "ops@example.com" },
    });

    assert.equal(vault.has(credentialId), true);

    const coldVault = resetSharedCredentialVaultForTests();
    assert.equal(coldVault.has(credentialId), false);

    const result = await hydrateWorkspaceCredentials({
      platformStore,
      vault: coldVault,
      workspaceId: business.id,
    });
    assert.ok(result.loaded >= 1);
    assert.equal(coldVault.has(credentialId), true);
    assert.equal(coldVault.get(credentialId)?.secrets?.refreshToken, "persist-me");
  });
});
