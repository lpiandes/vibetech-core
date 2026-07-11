import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  DETAIL_PAGE_SECTIONS,
  FORM_KINDS,
  isKnownFieldType,
  LIST_VIEW_TYPES,
} from "./FieldTypeRegistry.js";
import {
  getObjectArchetype,
  listObjectArchetypeIds,
  resolveDataModelTemplate,
} from "./ObjectArchetypeCatalog.js";
import { createDataFormsRecommendation } from "./DataFormsRecommendation.js";
import { mapDataFormsToBusinessOS } from "./mapDataFormsToBusinessOS.js";
import { validateRecord } from "./ValidationEngine.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function industryOf({ dna = null, businessSummary = {} } = {}) {
  return String(
    businessSummary.industry
    ?? dna?.company?.industry
    ?? "default",
  );
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\W+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48) || "object";
}

/**
 * Universal Data & Forms Engine — one engine every business uses.
 * Generates objects, fields, relationships, validation, forms, views, search, reports.
 */
export class DataFormsEngine {
  recommendDataModel({
    dna = null,
    businessSummary = {},
    evidence = [],
    businessId = null,
  } = {}) {
    const industry = industryOf({ dna, businessSummary });
    const template = resolveDataModelTemplate(industry);
    const knownArchetypes = new Set(listObjectArchetypeIds());
    const baseEvidence = [
      `industry:${industry}`,
      ...asArray(evidence).map(String),
      ...(dna ? ["source:business_dna"] : ["source:business_summary"]),
      ...(businessId ? [`tenant:${businessId}`] : ["tenant:preview"]),
    ];

    const recommendations = [];
    const gaps = [];
    const objects = [];

    const dnaObjects = inferObjectsFromDna(dna);
    const picks = dnaObjects.length
      ? mergeTemplateWithDna(template.objects, dnaObjects)
      : template.objects.map((entry) => ({ ...entry }));

    for (const pick of picks) {
      if (!knownArchetypes.has(pick.archetypeId)) {
        gaps.push({
          kind: "reusable_object_archetype_needed",
          label: `Missing object archetype: ${pick.archetypeId}`,
          requestedOutcome: pick.label,
          recommendation: "Register a reusable object archetype — do not invent a one-off object.",
        });
        recommendations.push(createDataFormsRecommendation({
          recommendationId: `rec_gap_obj_${pick.archetypeId}`,
          kind: "object_archetype_gap",
          label: `Propose archetype: ${pick.label}`,
          reason: `No reusable object archetype matches "${pick.archetypeId}". Recommend registering a reusable archetype instead of a one-off object.`,
          confidence: 0.55,
          evidence: [...baseEvidence, `missing_archetype:${pick.archetypeId}`],
          alternatives: suggestAlternativeArchetypes(pick.archetypeId),
          payload: { requested: pick },
          selected: false,
        }));
        continue;
      }

      const objectDef = buildObjectDefinition(pick);
      objects.push(objectDef);

      recommendations.push(createDataFormsRecommendation({
        recommendationId: `rec_object_${objectDef.objectId}`,
        kind: "business_object",
        label: objectDef.label,
        reason: `Track ${objectDef.label} as a first-class business object using reusable archetype "${objectDef.archetypeId}".`,
        confidence: dnaObjects.length ? 0.9 : 0.8,
        evidence: [...baseEvidence, `archetype:${objectDef.archetypeId}`, `object:${objectDef.objectId}`],
        alternatives: objects
          .filter((entry) => entry.objectId !== objectDef.objectId)
          .slice(0, 2)
          .map((entry) => entry.label),
        payload: { object: objectDef },
        selected: true,
      }));

      for (const field of objectDef.fields) {
        recommendations.push(createDataFormsRecommendation({
          recommendationId: `rec_field_${objectDef.objectId}_${field.key}`,
          kind: "field",
          label: `${objectDef.label}.${field.label}`,
          reason: field.required
            ? `${field.label} is required to identify and operate on ${objectDef.label}.`
            : `${field.label} supports day-to-day ${objectDef.label} work.`,
          confidence: isKnownFieldType(field.fieldType) ? 0.88 : 0.5,
          evidence: [...baseEvidence, `fieldType:${field.fieldType}`, `object:${objectDef.objectId}`],
          alternatives: suggestFieldAlternatives(field.fieldType),
          payload: { objectId: objectDef.objectId, field },
          selected: true,
        }));
      }
    }

    const objectIds = new Set(objects.map((entry) => entry.objectId));
    const relationships = (template.relationships ?? [])
      .filter((rel) => objectIds.has(rel.from) && objectIds.has(rel.to))
      .map((rel, index) => buildRelationship(rel, index));

    for (const rel of relationships) {
      recommendations.push(createDataFormsRecommendation({
        recommendationId: `rec_rel_${rel.relationshipId}`,
        kind: "relationship",
        label: rel.label,
        reason: `Connect ${rel.from} → ${rel.to} so records, search, and detail pages stay linked.`,
        confidence: 0.82,
        evidence: [...baseEvidence, `cardinality:${rel.cardinality}`, `kind:${rel.kind}`],
        alternatives: relationships
          .filter((entry) => entry.relationshipId !== rel.relationshipId)
          .slice(0, 2)
          .map((entry) => entry.label),
        payload: { relationship: rel },
        selected: true,
      }));
    }

    const forms = [];
    const views = [];
    const searches = [];
    const reports = [];
    const automations = [];

    for (const object of objects) {
      for (const kind of object.forms) {
        const form = buildForm(object, kind);
        forms.push(form);
        recommendations.push(createDataFormsRecommendation({
          recommendationId: `rec_form_${form.formId}`,
          kind: "form",
          label: form.label,
          reason: `${form.kind} form lets the team capture and update ${object.label} with validation and role visibility.`,
          confidence: 0.84,
          evidence: [...baseEvidence, `formKind:${kind}`, `object:${object.objectId}`],
          alternatives: object.forms.filter((entry) => entry !== kind).slice(0, 2),
          payload: { form },
          selected: true,
        }));
      }

      for (const viewType of object.views) {
        const view = buildView(object, viewType);
        views.push(view);
        recommendations.push(createDataFormsRecommendation({
          recommendationId: `rec_view_${view.viewId}`,
          kind: "view",
          label: view.label,
          reason: `${view.viewType} view helps people scan and act on ${object.label} records.`,
          confidence: LIST_VIEW_TYPES.includes(viewType) || viewType === "pipeline" ? 0.83 : 0.6,
          evidence: [...baseEvidence, `viewType:${viewType}`, `object:${object.objectId}`],
          alternatives: object.views.filter((entry) => entry !== viewType).slice(0, 2),
          payload: { view },
          selected: true,
        }));
      }

      const searchBundle = buildSearches(object);
      searches.push(...searchBundle);
      for (const search of searchBundle) {
        recommendations.push(createDataFormsRecommendation({
          recommendationId: `rec_search_${search.searchId}`,
          kind: "search",
          label: search.label,
          reason: search.kind === "global"
            ? `Global search includes ${object.label} so people find records fast.`
            : `${search.label} saves repeated filter work for ${object.label}.`,
          confidence: 0.8,
          evidence: [...baseEvidence, `searchKind:${search.kind}`, `object:${object.objectId}`],
          alternatives: ["advanced filters", "quick filters", "pinned searches"],
          payload: { search },
          selected: true,
        }));
      }

      const reportBundle = buildReports(object);
      reports.push(...reportBundle);
      for (const report of reportBundle) {
        recommendations.push(createDataFormsRecommendation({
          recommendationId: `rec_report_${report.reportId}`,
          kind: "report",
          label: report.label,
          reason: `Auto-generated ${report.kind} reporting keeps ${object.label} KPIs visible without custom BI.`,
          confidence: 0.78,
          evidence: [...baseEvidence, `reportKind:${report.kind}`, `object:${object.objectId}`],
          alternatives: ["counts", "totals", "grouped reports", "exports"],
          payload: { report },
          selected: true,
        }));
      }

      automations.push({
        automationId: `auto_validate_${object.objectId}`,
        objectId: object.objectId,
        kind: "validation_on_save",
        label: `Validate ${object.label} on save`,
      });
    }

    // Validation recommendations (object-level)
    for (const object of objects) {
      recommendations.push(createDataFormsRecommendation({
        recommendationId: `rec_validation_${object.objectId}`,
        kind: "validation",
        label: `${object.label} validation`,
        reason: `Required, unique, role-edit, and conditional rules keep ${object.label} data trustworthy.`,
        confidence: 0.86,
        evidence: [...baseEvidence, `fields:${object.fields.length}`],
        alternatives: ["required only", "role-based editing", "conditional required"],
        payload: {
          objectId: object.objectId,
          rules: object.fields.map((field) => ({
            key: field.key,
            required: field.required,
            unique: field.unique,
            readOnly: field.readOnly,
            roleEdit: field.roleEdit,
          })),
        },
        selected: true,
      }));
    }

    const dataModel = {
      industry,
      businessId: businessId ?? null,
      objects,
      relationships,
      forms,
      views,
      searches,
      reports,
      automations,
      detailPages: objects.map((object) => ({
        objectId: object.objectId,
        sections: [...DETAIL_PAGE_SECTIONS],
      })),
      permissions: buildRolePermissions(objects),
      tenantIsolation: {
        scopedByBusinessId: true,
        businessId: businessId ?? null,
        noCrossTenantReads: true,
      },
    };

    const businessOsMapping = mapDataFormsToBusinessOS(dataModel);

    return deepFreeze({
      ok: true,
      dataModel,
      recommendations,
      gaps,
      businessOsMapping,
      objects: recommendations.filter((entry) => entry.kind === "business_object"),
    });
  }

  validate({ objectDefinition, values, role, existingKeysByField } = {}) {
    return validateRecord({ objectDefinition, values, role, existingKeysByField });
  }
}

function buildObjectDefinition(pick) {
  const archetype = getObjectArchetype(pick.archetypeId);
  const fields = archetype.fields.map((field) => ({ ...field }));
  return {
    objectId: pick.objectId,
    label: pick.label,
    archetypeId: pick.archetypeId,
    category: archetype.category,
    fields,
    forms: (archetype.defaultForms ?? ["create", "edit", "view"]).filter((kind) => FORM_KINDS.includes(kind)),
    views: (archetype.defaultViews ?? ["table"]).map((viewType) => (
      viewType === "pipeline" ? "board" : viewType
    )).filter((viewType) => LIST_VIEW_TYPES.includes(viewType) || viewType === "board"),
    detailSections: [...DETAIL_PAGE_SECTIONS],
  };
}

function buildRelationship(rel, index) {
  const cardinality = rel.cardinality === "many_to_one" ? "one_to_many" : rel.cardinality;
  return {
    relationshipId: rel.relationshipId ?? `rel_${rel.from}_${rel.to}_${index}`,
    label: rel.label,
    from: rel.from,
    to: rel.to,
    cardinality,
    kind: rel.kind ?? "reference",
    reverseLookup: {
      from: rel.to,
      to: rel.from,
      kind: "reverse_lookup",
    },
  };
}

function buildForm(object, kind) {
  const identityFields = object.fields.filter((field) => field.identity || field.required).map((field) => field.key);
  const otherFields = object.fields.filter((field) => !identityFields.includes(field.key)).map((field) => field.key);
  return {
    formId: `form_${object.objectId}_${kind}`,
    objectId: object.objectId,
    kind,
    label: `${object.label} · ${kind.replace(/_/g, " ")}`,
    sections: [
      { id: "identity", label: "Identity", fieldKeys: identityFields },
      { id: "details", label: "Details", fieldKeys: otherFields },
    ],
    features: {
      tabs: kind === "edit" || kind === "view",
      conditionalVisibility: true,
      dynamicFields: true,
      helpText: true,
      validation: true,
      attachments: object.fields.some((field) => /attachment|image|signature/.test(field.fieldType)),
      comments: kind !== "quick_create",
      approvals: kind === "approval" || kind === "review",
      autosave: kind === "edit" || kind === "wizard",
      aiSuggestions: object.fields.some((field) => field.aiRecommendable),
      roleVisibility: true,
      mobile: kind === "mobile",
    },
  };
}

function buildView(object, viewType) {
  return {
    viewId: `view_${object.objectId}_${viewType}`,
    objectId: object.objectId,
    viewType,
    label: `${object.label} · ${viewType}`,
    columns: object.fields.filter((field) => field.searchable !== false).slice(0, 6).map((field) => field.key),
    sort: { field: object.fields.find((field) => field.identity)?.key ?? "displayName", direction: "asc" },
    groupBy: object.fields.find((field) => field.key === "status" || field.key === "stage" || field.key === "priority")?.key ?? null,
  };
}

function buildSearches(object) {
  const searchable = object.fields.filter((field) => field.searchable !== false).map((field) => field.key);
  return [
    {
      searchId: `search_global_${object.objectId}`,
      objectId: object.objectId,
      label: `Search ${object.label}`,
      kind: "global",
      filters: searchable.slice(0, 4).map((key) => ({ field: key, op: "contains" })),
      pinned: false,
      recentlyViewed: true,
    },
    {
      searchId: `search_active_${object.objectId}`,
      objectId: object.objectId,
      label: `Active ${object.label}`,
      kind: "saved",
      filters: [{ field: "status", op: "eq", value: "active" }],
      pinned: true,
      recentlyViewed: false,
    },
    {
      searchId: `search_advanced_${object.objectId}`,
      objectId: object.objectId,
      label: `Advanced ${object.label} filters`,
      kind: "advanced",
      filters: searchable.map((key) => ({ field: key, op: "any" })),
      pinned: false,
      grouping: true,
      sorting: true,
      quickFilters: ["status", "tags"].filter((key) => searchable.includes(key)),
    },
  ];
}

function buildReports(object) {
  const amountField = object.fields.find((field) => field.fieldType === "currency");
  return [
    {
      reportId: `report_count_${object.objectId}`,
      objectId: object.objectId,
      label: `${object.label} count`,
      kind: "counts",
      groupBy: "status",
      metrics: ["count"],
      chart: "bar",
      exportable: true,
      kpi: true,
    },
    ...(amountField ? [{
      reportId: `report_total_${object.objectId}`,
      objectId: object.objectId,
      label: `${object.label} totals`,
      kind: "totals",
      groupBy: "status",
      metrics: ["sum:amount", "avg:amount"],
      chart: "line",
      exportable: true,
      kpi: true,
    }] : [{
      reportId: `report_grouped_${object.objectId}`,
      objectId: object.objectId,
      label: `${object.label} by status`,
      kind: "grouped",
      groupBy: "status",
      metrics: ["count"],
      chart: "pie",
      exportable: true,
      kpi: false,
    }]),
  ];
}

function buildRolePermissions(objects) {
  return {
    OWNER: { objects: objects.map((entry) => entry.objectId), canCreate: true, canEdit: true, canDelete: true, canExport: true },
    MANAGER: { objects: objects.map((entry) => entry.objectId), canCreate: true, canEdit: true, canDelete: false, canExport: true },
    EMPLOYEE: { objects: objects.map((entry) => entry.objectId), canCreate: true, canEdit: true, canDelete: false, canExport: false },
    VIEWER: { objects: objects.map((entry) => entry.objectId), canCreate: false, canEdit: false, canDelete: false, canExport: false },
  };
}

function inferObjectsFromDna(dna) {
  if (!dna) return [];
  const out = [];
  for (const customer of asArray(dna.customers)) {
    out.push({
      archetypeId: "customer",
      objectId: slug(customer.label ?? customer.kind ?? "customer"),
      label: customer.label ?? "Customer",
    });
  }
  for (const record of asArray(dna.importantRecords ?? dna.records)) {
    const label = record.label ?? record.name ?? "Record";
    out.push({
      archetypeId: guessArchetypeFromLabel(label),
      objectId: slug(label),
      label,
    });
  }
  return out;
}

function mergeTemplateWithDna(templateObjects, dnaObjects) {
  const byId = new Map();
  for (const entry of templateObjects) {
    byId.set(entry.objectId, { ...entry });
  }
  for (const entry of dnaObjects) {
    if (!byId.has(entry.objectId)) {
      byId.set(entry.objectId, entry);
    } else {
      byId.set(entry.objectId, { ...byId.get(entry.objectId), label: entry.label });
    }
  }
  return [...byId.values()];
}

function guessArchetypeFromLabel(label) {
  const text = String(label).toLowerCase();
  if (/patient|player|resident|client|customer/.test(text)) return "customer";
  if (/invoice|bill/.test(text)) return "invoice";
  if (/work.?order|ticket/.test(text)) return "work_order";
  if (/appoint|practice|visit/.test(text)) return "appointment";
  if (/propert|asset|listing|unit/.test(text)) return "asset";
  if (/inspect/.test(text)) return "inspection";
  if (/contract|lease/.test(text)) return "contract";
  if (/lead|prospect/.test(text)) return "lead";
  if (/opportunit/.test(text)) return "opportunity";
  if (/project|team/.test(text)) return "project";
  if (/equip/.test(text)) return "equipment";
  if (/policy/.test(text)) return "policy";
  if (/knowledge|article|drill|sop/.test(text)) return "knowledge_article";
  if (/document|note|report/.test(text)) return "document";
  if (/case/.test(text)) return "case";
  if (/employee|staff/.test(text)) return "employee_record";
  if (/vendor/.test(text)) return "vendor";
  return "document";
}

function suggestAlternativeArchetypes(missingId) {
  const known = listObjectArchetypeIds();
  const token = String(missingId).split("_")[0];
  const hits = known.filter((id) => id.includes(token)).slice(0, 3);
  return hits.length ? hits : known.slice(0, 3);
}

function suggestFieldAlternatives(fieldType) {
  const map = {
    text: ["long_text", "rich_text"],
    number: ["currency", "percent"],
    date: ["datetime", "time"],
    single_select: ["multi_select", "tags"],
    relationship: ["person", "organization"],
  };
  return map[String(fieldType)] ?? ["text", "json"];
}
