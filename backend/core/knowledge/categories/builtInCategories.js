import { createCategory } from "./Category.js";

function nowISO(provided) {
  return typeof provided === "string" ? new Date(provided).toISOString() : new Date().toISOString();
}

function seedCategory({ id, name, description, sortOrder, parentCategory = null, childCategories = [], defaultTags = [] }) {
  const createdAt = "2026-06-20T00:00:00.000Z";
  const updatedAt = createdAt;
  return createCategory({
    id,
    name,
    description,
    icon: "",
    color: "",
    sortOrder,
    parentCategory,
    childCategories,
    defaultTags,
    searchable: true,
    editable: true,
    version: 1,
    status: "ACTIVE",
    visibility: "INTERNAL",
    createdAt,
    updatedAt,
    createdBy: "seed",
    updatedBy: "seed",
    metadata: {},
  });
}

/**
 * Built-in Knowledge Categories
 *
 * Category ids are intentionally stable tokens (no spaces) so they can be referenced from KnowledgeItems.
 */
export function createBuiltInKnowledgeCategories() {
  // Create a minimal hierarchy to satisfy parent/child fields:
  // - MARKETING is the parent of TEMPLATES.
  const marketingId = "MARKETING";
  const templatesId = "TEMPLATES";

  const categories = [
    seedCategory({
      id: "FAQ",
      name: "FAQ",
      description: "Frequently asked questions and approved answers.",
      sortOrder: 10,
      defaultTags: ["faq"],
    }),
    seedCategory({
      id: "SOP",
      name: "SOP",
      description: "Standard operating procedures for consistent execution.",
      sortOrder: 20,
      defaultTags: ["sop"],
    }),
    seedCategory({
      id: "POLICIES",
      name: "Policies",
      description: "Business policies that define governance expectations and response constraints.",
      sortOrder: 30,
      defaultTags: ["policy"],
    }),
    seedCategory({
      id: "PRICING",
      name: "Pricing",
      description: "Approved pricing and pricing-related guidance.",
      sortOrder: 40,
      defaultTags: ["pricing"],
    }),
    seedCategory({
      id: "BRAND_VOICE",
      name: "Brand Voice",
      description: "Company tone and writing conventions for communications.",
      sortOrder: 50,
      defaultTags: ["brand-voice"],
    }),
    seedCategory({
      id: "PROPERTY_INFORMATION",
      name: "Property Information",
      description: "Operational property guidance and reference rules.",
      sortOrder: 60,
      defaultTags: ["property", "information"],
    }),
    seedCategory({
      id: "NEIGHBORHOOD_GUIDES",
      name: "Neighborhood Guides",
      description: "Local area guidance and neighborhood references.",
      sortOrder: 70,
      defaultTags: ["neighborhood"],
    }),
    seedCategory({
      id: "MARKETING",
      name: "Marketing",
      description: "Marketing strategies, messaging guidance, and reusable templates.",
      sortOrder: 80,
      defaultTags: ["marketing"],
      childCategories: [templatesId],
    }),
    seedCategory({
      id: templatesId,
      name: "Templates",
      description: "Reusable message and content templates.",
      sortOrder: 90,
      parentCategory: marketingId,
      defaultTags: ["template"],
    }),
    seedCategory({
      id: "DOCUMENTS",
      name: "Documents",
      description: "Reference documents used for knowledge and context.",
      sortOrder: 100,
      defaultTags: ["document"],
    }),
    seedCategory({
      id: "EMPLOYEE_HANDBOOK",
      name: "Employee Handbook",
      description: "Internal employee guidance and operating norms.",
      sortOrder: 110,
      defaultTags: ["handbook"],
    }),
    seedCategory({
      id: "VENDOR_INFORMATION",
      name: "Vendor Information",
      description: "Approved vendor guidance and contact reference information.",
      sortOrder: 120,
      defaultTags: ["vendor"],
    }),
    seedCategory({
      id: "COMPLIANCE",
      name: "Compliance",
      description: "Compliance-related guidance and governance expectations.",
      sortOrder: 130,
      defaultTags: ["compliance"],
    }),
    seedCategory({
      id: "CUSTOM",
      name: "Custom",
      description: "User-defined categories for company-specific knowledge grouping.",
      sortOrder: 140,
      defaultTags: ["custom"],
    }),
  ];

  // Ensure MARKETING.childCategories is filled consistently (createCategory freezes values).
  return categories.map((c) => {
    if (c.id === marketingId) {
      return {
        ...c,
        childCategories: [templatesId],
      };
    }
    return c;
  });
}

