import test from "node:test";
import assert from "node:assert/strict";

import {
  buildChatReply,
  matchKnowledgeForMessage,
  extractLeadSignals,
  resolveChatContactSignals,
  appendChatTurns,
  readWebsiteChatThreads,
  persistWebsiteChatThreads,
  MAX_TURNS_PER_THREAD,
} from "./WebsiteChatService.js";

const HOURS_DOC = {
  id: "doc_hours",
  businessId: "biz_1",
  status: "ready",
  title: "Business Hours",
  contentText: "We are open Monday through Friday from 9am to 5pm, and closed on weekends and holidays.",
};

const PRICING_DOC = {
  id: "doc_pricing",
  businessId: "biz_1",
  status: "ready",
  title: "Pricing Guide",
  contentText: "Our starter package costs $500 per month and includes onboarding support.",
};

test("buildChatReply cites the matching Knowledge document when it answers the question", () => {
  const reply = buildChatReply({
    message: "What are your business hours?",
    documents: [HOURS_DOC, PRICING_DOC],
    businessId: "biz_1",
  });
  assert.equal(reply.groundedInKnowledge, true);
  assert.deepEqual(reply.citedDocumentIds, ["doc_hours"]);
  assert.match(reply.text, /9am to 5pm/);
  assert.match(reply.text, /Business Hours/);
});

test("buildChatReply gives an honest fallback when Knowledge is empty", () => {
  const reply = buildChatReply({
    message: "What are your business hours?",
    documents: [],
    businessId: "biz_1",
  });
  assert.equal(reply.groundedInKnowledge, false);
  assert.deepEqual(reply.citedDocumentIds, []);
  assert.match(reply.text, /don't have any Knowledge documents/i);
});

test("buildChatReply gives an honest fallback when Knowledge exists but nothing matches", () => {
  const reply = buildChatReply({
    message: "Do you offer emergency weekend service in another city?",
    documents: [PRICING_DOC],
    businessId: "biz_1",
  });
  assert.equal(reply.groundedInKnowledge, false);
  assert.deepEqual(reply.citedDocumentIds, []);
  assert.match(reply.text, /don't have a confirmed answer/i);
});

test("buildChatReply never cites documents from a different business", () => {
  const reply = buildChatReply({
    message: "What are your business hours?",
    documents: [{ ...HOURS_DOC, businessId: "biz_other" }],
    businessId: "biz_1",
  });
  assert.equal(reply.groundedInKnowledge, false);
});

test("matchKnowledgeForMessage ranks the best-matching document first", () => {
  const matches = matchKnowledgeForMessage({
    documents: [HOURS_DOC, PRICING_DOC],
    message: "How much does the starter package cost per month?",
    businessId: "biz_1",
  });
  assert.equal(matches[0]?.id, "doc_pricing");
});

test("extractLeadSignals pulls email, phone, and name from free text", () => {
  const signals = extractLeadSignals("Hi, my name is Jordan Lee. You can reach me at jordan@example.com or (555) 123-4567.");
  assert.equal(signals.name, "Jordan Lee");
  assert.equal(signals.email, "jordan@example.com");
  assert.equal(signals.phone, "5551234567");
});

test("extractLeadSignals returns empty strings when nothing is present", () => {
  const signals = extractLeadSignals("Just curious about your hours.");
  assert.equal(signals.name, "");
  assert.equal(signals.email, "");
  assert.equal(signals.phone, "");
});

test("resolveChatContactSignals prefers explicit visitor fields over parsed text", () => {
  const signals = resolveChatContactSignals({
    message: "my name is Jordan Lee, email jordan@example.com",
    visitorName: "Casey Explicit",
    visitorEmail: "",
    visitorPhone: "5559990000",
  });
  assert.equal(signals.name, "Casey Explicit");
  assert.equal(signals.email, "jordan@example.com");
  assert.equal(signals.phone, "5559990000");
});

test("appendChatTurns creates a new thread and caps turns per thread", () => {
  const manyTurns = Array.from({ length: MAX_TURNS_PER_THREAD + 5 }, (_, i) => ({
    role: i % 2 === 0 ? "visitor" : "assistant",
    text: `turn ${i}`,
  }));
  const threads = appendChatTurns({
    threads: [],
    threadId: "thread_1",
    turns: manyTurns,
    contactId: "contact_1",
  });
  assert.equal(threads.length, 1);
  assert.equal(threads[0].id, "thread_1");
  assert.equal(threads[0].turns.length, MAX_TURNS_PER_THREAD);
  assert.equal(threads[0].contactId, "contact_1");
});

test("appendChatTurns appends onto an existing thread without duplicating it", () => {
  let threads = appendChatTurns({
    threads: [],
    threadId: "thread_1",
    turns: [{ role: "visitor", text: "hi" }],
  });
  threads = appendChatTurns({
    threads,
    threadId: "thread_1",
    turns: [{ role: "assistant", text: "hello" }],
    contactId: "contact_9",
  });
  assert.equal(threads.length, 1);
  assert.equal(threads[0].turns.length, 2);
  assert.equal(threads[0].contactId, "contact_9");
});

test("readWebsiteChatThreads is defensive against missing/invalid configuration", () => {
  assert.deepEqual(readWebsiteChatThreads(null), []);
  assert.deepEqual(readWebsiteChatThreads({ configuration: {} }), []);
  assert.deepEqual(readWebsiteChatThreads({ configuration: { websiteChatThreads: "nope" } }), []);
});

test("persistWebsiteChatThreads writes threads onto installation.configuration via platformStore", async () => {
  let savedInput = null;
  const platformStore = {
    upsertBusinessOSInstallation: async (input) => {
      savedInput = input;
      return input;
    },
  };
  const installation = {
    id: "install_1",
    businessId: "biz_1",
    configuration: { crm: { version: 1 } },
    history: [],
  };
  const threads = appendChatTurns({
    threads: [],
    threadId: "thread_1",
    turns: [{ role: "visitor", text: "hi" }],
  });
  await persistWebsiteChatThreads({ platformStore, installation, threads });
  assert.ok(savedInput);
  assert.equal(savedInput.businessId, "biz_1");
  assert.deepEqual(savedInput.configuration.crm, { version: 1 });
  assert.equal(savedInput.configuration.websiteChatThreads.length, 1);
  assert.equal(savedInput.configuration.websiteChatThreads[0].id, "thread_1");
});
