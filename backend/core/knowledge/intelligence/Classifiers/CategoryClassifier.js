function normalizeTag(tag) {
  return String(tag ?? "").trim().toLowerCase();
}

// Map detectedDocumentType -> categoryId (Sprint 2 category IDs)
const TYPE_TO_CATEGORY_ID = {
  FAQ: "FAQ",
  SOP: "SOP",
  PRICING: "PRICING",
  POLICIES: "POLICIES",
  BRAND_VOICE: "BRAND_VOICE",
  MARKETING: "MARKETING",
  DOCUMENTS: "DOCUMENTS",
  EMPLOYEE_HANDBOOK: "EMPLOYEE_HANDBOOK",
  VENDOR_INFORMATION: "VENDOR_INFORMATION",
  COMPLIANCE: "COMPLIANCE",
  "General Document": "CUSTOM",
};

export class CategoryClassifier {
  classify({ documentTypeResult } = {}) {
    const detectedDocumentType = documentTypeResult?.detectedDocumentType ?? "General Document";
    const categoryId = TYPE_TO_CATEGORY_ID[detectedDocumentType] ?? "CUSTOM";

    // Suggested tags are deterministic based on detected type + business area signals.
    const typeTags = [detectedDocumentType]
      .filter(Boolean)
      .map(normalizeTag);
    const suggestedTags = typeTags.slice(0, 4);

    return {
      suggestedCategoryId: categoryId,
      suggestedTags,
    };
  }
}

