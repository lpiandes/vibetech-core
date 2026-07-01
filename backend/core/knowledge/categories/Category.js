/**
 * Knowledge Category (Sprint 2)
 *
 * Pure immutable model for categorizing company knowledge.
 */

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Category: expected ${name} to be a non-empty string.`);
  }
}

function optionalString(value) {
  return typeof value === "string" ? value : "";
}

function optionalArray(value) {
  return Array.isArray(value) ? value : [];
}

function optionalNullableString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function createCategory(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Category.createCategory: input is required.");
  }

  const id = String(input.id ?? "");
  requiredString(id, "id");

  const name = String(input.name ?? "");
  requiredString(name, "name");

  const description = String(input.description ?? "");
  requiredString(description, "description");

  const icon = optionalString(input.icon);
  const color = optionalString(input.color);

  const sortOrder = typeof input.sortOrder === "number" ? input.sortOrder : 0;

  const parentCategory = optionalNullableString(input.parentCategory);
  const childCategories = optionalArray(input.childCategories).map((c) => String(c));

  const defaultTags = optionalArray(input.defaultTags).map((t) => String(t).toLowerCase());

  const searchable = Boolean(input.searchable ?? true);
  const editable = Boolean(input.editable ?? true);

  const version = typeof input.version === "number" && input.version >= 1 ? input.version : 1;
  const status = String(input.status ?? "ACTIVE");
  const visibility = String(input.visibility ?? "INTERNAL");

  const createdAt = String(input.createdAt ?? new Date().toISOString());
  const updatedAt = String(input.updatedAt ?? createdAt);

  const createdBy = optionalString(input.createdBy || "seed");
  const updatedBy = optionalString(input.updatedBy || "seed");

  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};

  const category = {
    id,
    name,
    description,
    icon,
    color,
    sortOrder,
    parentCategory,
    childCategories,
    defaultTags,
    searchable,
    editable,
    version,
    status,
    visibility,
    createdAt,
    updatedAt,
    createdBy,
    updatedBy,
    metadata,
  };

  return deepFreeze(category);
}

export { deepFreeze };

