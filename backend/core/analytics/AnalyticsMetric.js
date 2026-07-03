import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { createAnalyticsDimension } from "./AnalyticsDimension.js";

const SUPPORTED_METRIC_CATEGORIES = [
  "requests",
  "work",
  "team",
  "communications",
  "knowledge",
  "capabilities",
  "company",
  "financial",
  "operations",
  "customer_experience",
];

const SUPPORTED_AGGREGATIONS = ["count", "sum", "average", "min", "max", "latest"];

function fail(message) {
  throw new Error(`AnalyticsMetric: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

export function createAnalyticsMetric({
  id,
  name,
  description,
  category,
  unit,
  aggregationType,
  dimensions,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!name || typeof name !== "string") fail("name required.");
  if (!description || typeof description !== "string") fail("description required.");
  if (!category || typeof category !== "string") fail("category required.");
  if (!unit || typeof unit !== "string") fail("unit required.");
  if (!aggregationType || typeof aggregationType !== "string") fail("aggregationType required.");

  const cat = safeString(category);
  if (!SUPPORTED_METRIC_CATEGORIES.includes(cat)) fail(`unsupported category: ${cat}`);

  const agg = safeString(aggregationType);
  if (!SUPPORTED_AGGREGATIONS.includes(agg)) fail(`unsupported aggregationType: ${agg}`);

  const dims = Array.isArray(dimensions) ? dimensions.map((d) => createAnalyticsDimension(d)) : [];
  const md = metadata && isPlainObject(metadata) ? deepFreeze(metadata) : deepFreeze({});

  const metric = {
    id: safeString(id),
    name: safeString(name),
    description: safeString(description),
    category: cat,
    unit: safeString(unit),
    aggregationType: agg,
    dimensions: deepFreeze(dims),
    metadata: md,
  };

  return deepFreeze(metric);
}

export { SUPPORTED_METRIC_CATEGORIES, SUPPORTED_AGGREGATIONS };

