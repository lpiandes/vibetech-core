import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { ATTENTION_CATEGORIES, COMMUNICATION_VIEW_PRIORITIES } from "./CommunicationViewDefaults.js";

function fail(message) {
  throw new Error(`CommunicationAttentionView: ${message}`);
}

function normalizePriority(p) {
  const pr = String(p ?? "later").toLowerCase();
  if (!COMMUNICATION_VIEW_PRIORITIES.includes(pr)) return "later";
  return pr;
}

export function createCommunicationAttentionItem({ id, category, priority, summary, metadata } = {}) {
  if (!id || typeof id !== "string") fail("id required string.");
  if (!category || typeof category !== "string") fail("category required string.");
  if (!ATTENTION_CATEGORIES.includes(String(category))) fail(`invalid category: ${String(category)}`);
  if (!summary || typeof summary !== "string") fail("summary required string.");
  const view = {
    id,
    category: String(category),
    priority: normalizePriority(priority),
    summary,
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };
  return deepFreeze(view);
}

export function createCommunicationAttentionView({ summary, items, metadata } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  return deepFreeze({
    summary: String(summary ?? ""),
    items: deepFreeze(safeItems),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

