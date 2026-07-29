import test from "node:test";
import assert from "node:assert/strict";

import {
  businessHasAiProspecting,
  normalizePurchasedPackages,
  resolvePackageSoftCaps,
} from "../platform/packages/SalesPackageCatalog.js";
import { buildDiscoveryQuery, normalizeProspectingCriteria } from "./ProspectingCriteria.js";
import {
  createProspectingRun,
  countRunsOnDay,
  emptyProspectingState,
  upsertProspectingRun,
} from "./ProspectingJobStore.js";
import { discoverCompaniesViaSerper } from "./serperCompanyDiscovery.js";
import { findDuplicateContact } from "./dedupeCandidates.js";
import { emptyCrmState } from "../crm/CrmStore.js";
import { ensureCrmContactAndOptionalCard } from "../crm/ensureCrmContactAndOptionalCard.js";
import {
  extractPublicContactFields,
  qualifiesProspectLead,
} from "./publicContactExtract.js";
import {
  assertAiProspectingPurchased,
  resolveProspectingCaps,
} from "./prospectingGate.js";
import { acceptProspectingCandidates, rejectProspectingCandidates } from "./acceptProspectingCandidates.js";
import { runProspectingJob } from "./runProspectingJob.js";
import { OpenAIProvider } from "../providers/OpenAIProvider.js";

test("ai_prospecting unlocks on Full OS or explicit package", () => {
  assert.equal(businessHasAiProspecting([]), true);
  assert.equal(businessHasAiProspecting(["ai_business_os"]), true);
  assert.equal(businessHasAiProspecting(["ai_prospecting"]), true);
  assert.equal(businessHasAiProspecting(["ai_receptionist"]), false);
  assert.equal(businessHasAiProspecting(["ai_business_os", "ai_prospecting"]), true);
  const caps = resolvePackageSoftCaps(["ai_prospecting"]);
  assert.equal(caps.maxProspectingRunsPerDay, 5);
  assert.equal(caps.maxProspectingLeadsPerRun, 25);
});

test("normalizePurchasedPackages accepts ai_prospecting", () => {
  assert.deepEqual(normalizePurchasedPackages(["ai_prospecting", "nope"]), ["ai_prospecting"]);
});

test("criteria → discovery query", () => {
  const c = normalizeProspectingCriteria({
    industry: "dental",
    geo: "Austin TX",
    keywords: "implants",
    titles: "Owner",
    maxLeads: 5,
  });
  assert.equal(c.industry, "dental");
  assert.ok(buildDiscoveryQuery(c).includes("dental"));
  assert.ok(buildDiscoveryQuery(c).includes("Austin"));
});

test("Serper discovery maps organic hits and skips directories", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      organic: [
        { title: "Bright Smile Dental | Home", link: "https://brightsmile.example", snippet: "Family dentistry" },
        { title: "Some dentist", link: "https://www.linkedin.com/company/x", snippet: "skip" },
        { title: "Austin Dental Group", link: "https://austindental.example/about", snippet: "implants" },
      ],
    }),
  });
  const rows = await discoverCompaniesViaSerper({
    criteria: { industry: "dental", geo: "Austin", maxLeads: 10 },
    apiKey: "test-key",
    fetchImpl,
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].companyName.includes("Bright Smile") || rows[0].website.includes("brightsmile"), true);
});

test("dedupe against existing CRM by email", () => {
  let crm = emptyCrmState();
  crm = ensureCrmContactAndOptionalCard(crm, {
    contact: { name: "Pat Owner", email: "pat@brightsmile.example" },
  }).crm;
  const dup = findDuplicateContact(crm, {
    decisionMakerName: "Someone Else",
    email: { value: "pat@brightsmile.example" },
    website: "https://other.example",
  });
  assert.equal(dup.isDuplicate, true);
  assert.ok(dup.contactId);
});

test("public extract finds phone and free email; ranks multiples best-first", () => {
  const found = extractPublicContactFields([
    {
      text: "Call us at (800) 555-0100 or visit",
      url: "https://directory.example/listing",
    },
    {
      text: "Call Mile High HVAC at (303) 555-0199 or email hello@milehighhvac.example",
      url: "https://milehighhvac.example/contact",
    },
    {
      text: "Also (303) 555-0111 for billing",
      url: "https://milehighhvac.example/billing",
    },
  ], { companyHost: "milehighhvac.example" });

  assert.ok(found.phones.length >= 2);
  assert.equal(found.phones[0].rank, 1);
  assert.equal(found.phones[0].value, "(303) 555-0199");
  assert.ok(!String(found.phones[0].reason ?? "").match(/low|medium|high/i));
  assert.equal(found.email?.value, "hello@milehighhvac.example");
  assert.equal(found.emails[0].value, "hello@milehighhvac.example");

  const empty = extractPublicContactFields(["Great company in Denver"]);
  assert.equal(empty.phone, null);
  assert.equal(empty.email, null);
  assert.equal(empty.phones.length, 0);
});

test("qualifiesProspectLead requires phone + name + brief", () => {
  assert.equal(qualifiesProspectLead({
    phone: { value: "(303) 555-0199" },
    name: "Mile High HVAC",
    overview: "Local heating and cooling.",
  }), true);
  assert.equal(qualifiesProspectLead({
    phone: null,
    name: "Mile High HVAC",
    overview: "Local heating and cooling.",
  }), false);
});

test("package gate allows Full OS; blocks thin SKUs without prospecting", () => {
  assert.doesNotThrow(() =>
    assertAiProspectingPurchased({ configuration: { purchasedPackages: [] } }),
  );
  assert.doesNotThrow(() =>
    assertAiProspectingPurchased({ configuration: { purchasedPackages: ["ai_business_os"] } }),
  );
  assert.throws(
    () => assertAiProspectingPurchased({ configuration: { purchasedPackages: ["ai_receptionist"] } }),
    /not purchased/i,
  );
  assert.doesNotThrow(() =>
    assertAiProspectingPurchased({ configuration: { purchasedPackages: ["ai_prospecting"] } }),
  );
  const caps = resolveProspectingCaps({ configuration: { purchasedPackages: ["ai_prospecting"] } });
  assert.equal(caps.maxRunsPerDay, 5);
});

test("runProspectingJob keeps only leads with public phone", async () => {
  const writes = [];
  const platformStore = {
    async upsertBusinessOSInstallation(row) {
      writes.push(row);
      return row;
    },
    async getBusinessOSInstallation() {
      return writes[writes.length - 1] ?? null;
    },
  };
  let installation = {
    id: "install_test",
    businessId: "biz_test",
    specificationId: "spec",
    configuration: { purchasedPackages: ["ai_prospecting"], prospecting: emptyProspectingState() },
  };
  let state = emptyProspectingState();
  const run = createProspectingRun({
    criteria: { industry: "HVAC", geo: "Denver", maxLeads: 2 },
    actorId: "owner",
  });
  state = upsertProspectingRun(state, run);
  installation.configuration.prospecting = state;

  let calls = 0;
  const fetchImpl = async (_url, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body ?? "{}"));
    const q = String(body.q ?? "");
    // First call = company discovery; later = contact hunts
    if (!/phone|contact|call|tel/i.test(q)) {
      return {
        ok: true,
        json: async () => ({
          organic: [
            {
              title: "Mile High HVAC",
              link: "https://milehighhvac.example",
              snippet: "Heating and cooling in Denver",
            },
            {
              title: "No Phone Plumbing",
              link: "https://nophone.example",
              snippet: "We fix pipes",
            },
          ],
        }),
      };
    }
    if (/Mile High/i.test(q) || /milehighhvac/i.test(q)) {
      return {
        ok: true,
        json: async () => ({
          organic: [
            {
              title: "Contact Mile High HVAC",
              link: "https://milehighhvac.example/contact",
              snippet: "Call us at (303) 555-0199 · hello@milehighhvac.example",
            },
          ],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        organic: [
          { title: "No Phone Plumbing", link: "https://nophone.example", snippet: "Schedule online" },
        ],
      }),
    };
  };

  const result = await runProspectingJob({
    platformStore,
    installation,
    runId: run.id,
    actorId: "owner",
    fetchImpl,
    llmProvider: new OpenAIProvider({ mode: "demo" }),
    env: { SERPER_API_KEY: "serper-test" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.run.status, "completed");
  assert.equal(result.run.candidates.length, 1);
  assert.match(result.run.candidates[0].companyName, /Mile High/i);
  assert.equal(result.run.candidates[0].phone?.value, "(303) 555-0199");
  assert.equal(result.run.candidates[0].email?.value, "hello@milehighhvac.example");
  assert.ok(result.run.candidates[0].overview);
  assert.ok(result.run.candidates[0].decisionMakerName);
  assert.ok((result.run.costMeta?.skippedNoPhone ?? 0) >= 1);
  assert.ok(calls >= 2);
});

test("accept creates CRM contact + pipeline card; reject dismisses", async () => {
  const store = {
    installation: {
      id: "install_x",
      businessId: "biz_x",
      specificationId: "spec",
      configuration: {
        purchasedPackages: ["ai_prospecting"],
        crm: emptyCrmState(),
        prospecting: emptyProspectingState(),
      },
    },
    async upsertBusinessOSInstallation(row) {
      this.installation = {
        ...this.installation,
        ...row,
        configuration: row.configuration,
      };
      return this.installation;
    },
    async getBusinessOSInstallation() {
      return this.installation;
    },
  };

  let state = emptyProspectingState();
  const run = createProspectingRun({
    criteria: { industry: "dental", pipelineId: null, stageId: null, maxLeads: 2 },
  });
  run.status = "completed";
  run.candidates = [
    {
      id: "cand_1",
      status: "pending",
      companyName: "Bright Dental",
      website: "https://bright.example",
      overview: "Local practice",
      decisionMakerName: "Dr. Ada",
      decisionMakerTitle: "Owner",
      email: { value: "ada@bright.example", confidence: "medium", source: "serper_snippet", verified: false },
      phone: { value: "(512) 555-0100", confidence: "medium", source: "serper_snippet", verified: false },
      sources: ["https://bright.example"],
      sizeEstimate: "1-10",
      sizeEstimated: true,
    },
    {
      id: "cand_2",
      status: "pending",
      companyName: "Other Co",
      decisionMakerName: "Bob",
      overview: "Other",
      email: { value: null, confidence: "none", source: null, verified: false },
      phone: { value: "(512) 555-0199", confidence: "medium", source: "serper_snippet", verified: false },
      sources: [],
    },
  ];
  state = upsertProspectingRun(state, run);
  store.installation.configuration.prospecting = state;

  const events = [];
  const accepted = await acceptProspectingCandidates({
    platformStore: store,
    installation: store.installation,
    runId: run.id,
    candidateIds: ["cand_1"],
    addToPipeline: true,
    actorId: "owner",
    emitContactCreated: async (payload) => {
      events.push(payload);
    },
  });

  assert.equal(accepted.accepted.length, 1);
  assert.ok(accepted.accepted[0].contactId);
  assert.ok(accepted.accepted[0].cardId);
  assert.equal(events.length, 1);
  assert.equal(events[0].contact.kind, "lead");
  assert.ok((events[0].contact.tags ?? []).includes("ai_prospect"));
  assert.equal(events[0].contact.phone, "(512) 555-0100");

  const rejected = await rejectProspectingCandidates({
    platformStore: store,
    installation: store.installation,
    runId: run.id,
    candidateIds: ["cand_2"],
    actorId: "owner",
  });
  const cand2 = rejected.run.candidates.find((c) => c.id === "cand_2");
  assert.equal(cand2.status, "rejected");
});

test("countRunsOnDay supports soft-cap quota", () => {
  let state = emptyProspectingState();
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 3; i += 1) {
    const run = createProspectingRun({ criteria: { industry: "x" } });
    run.createdAt = `${today}T12:0${i}:00.000Z`;
    state = upsertProspectingRun(state, run);
  }
  assert.equal(countRunsOnDay(state, today), 3);
});
