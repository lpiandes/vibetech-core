function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`KnowledgeIngestionEngine: expected ${name} to be a non-empty string.`);
  }
}

function validateCategoryExists({ runtime, categoryId }) {
  if (!runtime || typeof runtime.getKnowledgeCategories !== "function") return;
  requiredString(categoryId, "categoryId");
  const categories = runtime.getKnowledgeCategories();
  const items = Array.isArray(categories?.items) ? categories.items : [];
  const found = items.some((c) => c.id === categoryId && c.status !== "ARCHIVED");
  if (!found) {
    throw new Error(`KnowledgeIngestionEngine: invalid categoryId: ${categoryId}`);
  }
}

export function validateIngestionInput({
  sourceId,
  filename,
  content,
  categoryId,
  runtime,
} = {}) {
  requiredString(sourceId, "sourceId");
  requiredString(filename, "filename");
  requiredString(content, "content");
  requiredString(categoryId, "categoryId");
  validateCategoryExists({ runtime, categoryId });
  return true;
}

