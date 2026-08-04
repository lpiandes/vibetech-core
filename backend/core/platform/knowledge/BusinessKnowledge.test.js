import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { test, before, after, beforeEach } from "node:test";

import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

process.env.DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ?? "postgresql://vibetech:vibetech@localhost:5432/vibetech_test";
process.env.VIBETECH_TEST_DB = "1";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

import { runMigrations } from "../db/migrate.js";
import { closePool } from "../db/pool.js";
import { platformStore } from "../persistence/platformStore.js";
import { hashPassword } from "../services/AuthCredentialService.js";
import { authorizeBusinessAccess, AuthorizationError } from "../authorizeBusinessAccess.default.js";
import {
  BusinessKnowledgeService,
  sanitizeFilename,
  validateKnowledgeUpload,
  getMaxUploadBytes,
} from "../knowledge/BusinessKnowledgeService.js";
import { LocalFilesystemKnowledgeStorage } from "../knowledge/LocalFilesystemKnowledgeStorage.js";
import { PERMISSIONS } from "../permissions/rolePermissions.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { PROPERTY_MANAGEMENT_PACKAGE_ID } from "../../workspace/activation/activateWorkspace.js";

function uid() {
  return randomUUID().slice(0, 8);
}

let testStorageRoot = "";

async function createTestUser({ email, name, password = "password123" }) {
  const passwordHash = await hashPassword(password);
  return platformStore.createUser({ email, name, passwordHash });
}

async function createTestBusiness(name = `Knowledge Co ${uid()}`) {
  return platformStore.createBusiness({
    name,
    kind: "NORMAL",
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    packageConfiguration: buildEmptyPropertyManagementConfiguration({ companyName: name }),
  });
}

function makeService() {
  process.env.KNOWLEDGE_STORAGE_ROOT = testStorageRoot;
  return new BusinessKnowledgeService({
    storage: new LocalFilesystemKnowledgeStorage(),
    store: platformStore,
  });
}

before(async () => {
  testStorageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vibetech-knowledge-test-"));
  process.env.KNOWLEDGE_STORAGE_ROOT = testStorageRoot;
  await runMigrations();
});

beforeEach(() => {
  fs.rmSync(testStorageRoot, { recursive: true, force: true });
  fs.mkdirSync(testStorageRoot, { recursive: true });
});

after(async () => {
  fs.rmSync(testStorageRoot, { recursive: true, force: true });
  await closePool();
});

test("authenticated member can list own business knowledge", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `owner-${uid()}@test.vibetech.local`, name: "Owner" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: "OWNER" });
  const service = makeService();
  await service.uploadDocument({
    businessId: business.id,
    userId: owner.id,
    buffer: Buffer.from("hello knowledge"),
    filename: "guide.txt",
    mimeType: "text/plain",
  });
  await authorizeBusinessAccess({ userId: owner.id, businessId: business.id });
  const docs = await service.listDocuments(business.id);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].title, "guide");
});

test("authorized role can upload supported document", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `uploader-${uid()}@test.vibetech.local`, name: "Uploader" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: "OWNER" });
  await authorizeBusinessAccess({
    userId: owner.id,
    businessId: business.id,
    requiredPermission: PERMISSIONS.KNOWLEDGE_MANAGE,
  });
  const service = makeService();
  const doc = await service.uploadDocument({
    businessId: business.id,
    userId: owner.id,
    buffer: Buffer.from("# Policy"),
    filename: "policy.md",
    mimeType: "text/markdown",
  });
  assert.equal(doc.sourceType, "MARKDOWN");
  assert.equal(doc.textExtractionStatus, "succeeded");
  assert.equal(doc.status, "ready");
});

test("document content is durable in database for View even without blob storage", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `view-knowledge-${uid()}@test.vibetech.local`, name: "Viewer" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: "OWNER" });
  const service = makeService();
  const doc = await service.uploadDocument({
    businessId: business.id,
    userId: owner.id,
    buffer: Buffer.from("Client follow-up SOP: call within 15 minutes."),
    filename: "Client-follow-up-SOP.txt",
    mimeType: "text/plain",
  });
  const withStorage = await service.getDocumentContent(business.id, doc.id);
  assert.equal(withStorage.available, true);
  assert.match(withStorage.contentText, /Client follow-up SOP/);

  const memoryOnly = new BusinessKnowledgeService({
    storage: {
      async putObject() {},
      async getObject() {
        throw new Error("gone");
      },
      async deleteObject() {},
      async objectExists() {
        return false;
      },
    },
    store: platformStore,
  });
  const fromDb = await memoryOnly.getDocumentContent(business.id, doc.id);
  assert.equal(fromDb.available, true);
  assert.equal(fromDb.source, "database");
  assert.match(fromDb.contentText, /call within 15 minutes/);
});

test("operational knowledge retrieval returns bounded ready document content without broadening public list shape", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `ops-knowledge-${uid()}@test.vibetech.local`, name: "Ops Knowledge" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: "OWNER" });
  const service = makeService();
  await service.uploadDocument({
    businessId: business.id,
    userId: owner.id,
    buffer: Buffer.from("Leasing guidance content that should influence an internal operational draft."),
    filename: "leasing-guide.txt",
    mimeType: "text/plain",
  });

  const publicDocs = await service.listDocuments(business.id);
  assert.equal(publicDocs.length, 1);
  assert.equal(Object.hasOwn(publicDocs[0], "contentText"), false);

  const operationalDocs = await service.listOperationalDocuments(business.id);
  assert.equal(operationalDocs.length, 1);
  assert.equal(operationalDocs[0].businessId, business.id);
  assert.match(operationalDocs[0].contentText, /Leasing guidance content/);
});

test("unsupported file type rejected", async () => {
  const validation = validateKnowledgeUpload({
    buffer: Buffer.from("MZ"),
    filename: "virus.exe",
    mimeType: "application/octet-stream",
  });
  assert.equal(validation.ok, false);
});

test("oversized file rejected", async () => {
  const previous = process.env.KNOWLEDGE_MAX_UPLOAD_BYTES;
  process.env.KNOWLEDGE_MAX_UPLOAD_BYTES = "16";
  try {
    const validation = validateKnowledgeUpload({
      buffer: Buffer.alloc(32, "a"),
      filename: "big.txt",
      mimeType: "text/plain",
    });
    assert.equal(validation.ok, false);
    assert.match(validation.error, /limit/i);
  } finally {
    if (previous === undefined) delete process.env.KNOWLEDGE_MAX_UPLOAD_BYTES;
    else process.env.KNOWLEDGE_MAX_UPLOAD_BYTES = previous;
  }
});

test("unauthenticated request rejected", async () => {
  const business = await createTestBusiness();
  await assert.rejects(
    () => authorizeBusinessAccess({ userId: null, businessId: business.id }),
    (err) => err instanceof AuthorizationError && err.code === "UNAUTHENTICATED",
  );
});

test("non-member rejected", async () => {
  const business = await createTestBusiness();
  const outsider = await createTestUser({ email: `outsider-${uid()}@test.vibetech.local`, name: "Outsider" });
  await assert.rejects(
    () => authorizeBusinessAccess({ userId: outsider.id, businessId: business.id }),
    (err) => err instanceof AuthorizationError && err.code === "FORBIDDEN",
  );
});

test("Business A cannot list Business B documents", async () => {
  const businessA = await createTestBusiness("Business A");
  const businessB = await createTestBusiness("Business B");
  const ownerA = await createTestUser({ email: `a-${uid()}@test.vibetech.local`, name: "Owner A" });
  await platformStore.createMembership({ userId: ownerA.id, businessId: businessA.id, role: "OWNER" });
  const service = makeService();
  await service.uploadDocument({
    businessId: businessA.id,
    userId: ownerA.id,
    buffer: Buffer.from("secret"),
    filename: "secret.txt",
    mimeType: "text/plain",
  });
  const docsB = await service.listDocuments(businessB.id);
  assert.equal(docsB.length, 0);
});

test("Business A cannot delete Business B documents", async () => {
  const businessA = await createTestBusiness("Delete A");
  const businessB = await createTestBusiness("Delete B");
  const ownerA = await createTestUser({ email: `da-${uid()}@test.vibetech.local`, name: "Owner A" });
  const ownerB = await createTestUser({ email: `db-${uid()}@test.vibetech.local`, name: "Owner B" });
  await platformStore.createMembership({ userId: ownerA.id, businessId: businessA.id, role: "OWNER" });
  await platformStore.createMembership({ userId: ownerB.id, businessId: businessB.id, role: "OWNER" });
  const service = makeService();
  const doc = await service.uploadDocument({
    businessId: businessA.id,
    userId: ownerA.id,
    buffer: Buffer.from("private"),
    filename: "private.txt",
    mimeType: "text/plain",
  });
  await assert.rejects(
    () => service.deleteDocument({ businessId: businessB.id, documentId: doc.id, userId: ownerB.id }),
    (err) => err && err.code === "NOT_FOUND",
  );
});

test("authorized delete works", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `del-${uid()}@test.vibetech.local`, name: "Owner" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: "OWNER" });
  const service = makeService();
  const doc = await service.uploadDocument({
    businessId: business.id,
    userId: owner.id,
    buffer: Buffer.from("temp"),
    filename: "temp.txt",
    mimeType: "text/plain",
  });
  const storage = new LocalFilesystemKnowledgeStorage();
  assert.equal(await storage.objectExists({ businessId: business.id, storageKey: doc.id }), false);
  const row = await platformStore.getKnowledgeDocumentById(doc.id, business.id);
  assert.ok(row);
  assert.equal(await storage.objectExists({ businessId: business.id, storageKey: row.storageKey }), true);
  await service.deleteDocument({ businessId: business.id, documentId: doc.id, userId: owner.id });
  const remaining = await service.listDocuments(business.id);
  assert.equal(remaining.length, 0);
  assert.equal(await storage.objectExists({ businessId: business.id, storageKey: row.storageKey }), false);
});

test("unsafe filenames cannot escape storage directory", async () => {
  const safe = sanitizeFilename("../../etc/passwd");
  assert.equal(safe.includes("/"), false);
  assert.equal(safe.includes(".."), false);
  const storage = new LocalFilesystemKnowledgeStorage();
  const businessId = randomUUID();
  await storage.putObject({
    businessId,
    storageKey: randomUUID(),
    buffer: Buffer.from("ok"),
    mimeType: "text/plain",
  });
  await assert.rejects(() =>
    storage.putObject({
      businessId,
      storageKey: "../escape",
      buffer: Buffer.from("bad"),
      mimeType: "text/plain",
    }),
  );
});

test("setup checklist incomplete with zero documents", async () => {
  const business = await createTestBusiness();
  const count = await platformStore.countActiveKnowledgeDocuments(business.id);
  assert.equal(count, 0);
});

test("setup checklist complete with at least one active document", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `check-${uid()}@test.vibetech.local`, name: "Owner" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: "OWNER" });
  const service = makeService();
  await service.uploadDocument({
    businessId: business.id,
    userId: owner.id,
    buffer: Buffer.from("checklist"),
    filename: "checklist.txt",
    mimeType: "text/plain",
  });
  const count = await platformStore.countActiveKnowledgeDocuments(business.id);
  assert.equal(count, 1);
});

test("storage failure does not leave incorrect successful database state", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `storfail-${uid()}@test.vibetech.local`, name: "Owner" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: "OWNER" });
  const failingStorage = {
    async putObject() {
      throw new Error("STORAGE_DOWN");
    },
    async deleteObject() {},
    async objectExists() {
      return false;
    },
  };
  const service = new BusinessKnowledgeService({ storage: failingStorage, store: platformStore });
  await assert.rejects(() =>
    service.uploadDocument({
      businessId: business.id,
      userId: owner.id,
      buffer: Buffer.from("x"),
      filename: "x.txt",
      mimeType: "text/plain",
    }),
  );
  const count = await platformStore.countActiveKnowledgeDocuments(business.id);
  assert.equal(count, 0);
});

test("database failure does not leave uncontrolled orphaned storage if avoidable", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `dbfail-${uid()}@test.vibetech.local`, name: "Owner" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: "OWNER" });
  const storage = new LocalFilesystemKnowledgeStorage();
  const originalCreate = platformStore.createKnowledgeDocument.bind(platformStore);
  let storageKeyWritten = null;
  platformStore.createKnowledgeDocument = async (input) => {
    storageKeyWritten = input.storageKey;
    throw new Error("DB_DOWN");
  };
  const service = new BusinessKnowledgeService({ storage, store: platformStore });
  try {
    await assert.rejects(() =>
      service.uploadDocument({
        businessId: business.id,
        userId: owner.id,
        buffer: Buffer.from("orphan-test"),
        filename: "orphan.txt",
        mimeType: "text/plain",
      }),
    );
    assert.ok(storageKeyWritten);
    assert.equal(await storage.objectExists({ businessId: business.id, storageKey: storageKeyWritten }), false);
  } finally {
    platformStore.createKnowledgeDocument = originalCreate;
  }
});

test("default max upload size is 10MB", () => {
  const previous = process.env.KNOWLEDGE_MAX_UPLOAD_BYTES;
  delete process.env.KNOWLEDGE_MAX_UPLOAD_BYTES;
  assert.equal(getMaxUploadBytes(), 10 * 1024 * 1024);
  if (previous !== undefined) process.env.KNOWLEDGE_MAX_UPLOAD_BYTES = previous;
});

test("employee without knowledge.manage cannot upload via authorization", async () => {
  const business = await createTestBusiness();
  const employee = await createTestUser({ email: `emp-${uid()}@test.vibetech.local`, name: "Employee" });
  await platformStore.createMembership({ userId: employee.id, businessId: business.id, role: "EMPLOYEE" });
  await assert.rejects(
    () =>
      authorizeBusinessAccess({
        userId: employee.id,
        businessId: business.id,
        requiredPermission: PERMISSIONS.KNOWLEDGE_MANAGE,
      }),
    (err) => err instanceof AuthorizationError && err.code === "FORBIDDEN",
  );
  await authorizeBusinessAccess({ userId: employee.id, businessId: business.id });
});
