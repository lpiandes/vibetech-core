import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { DETAIL_PAGE_SECTIONS } from "./FieldTypeRegistry.js";

/**
 * Map data model → existing Business OS / blueprint recipe fields.
 * Does not invent a parallel OS schema.
 */
export function mapDataFormsToBusinessOS(dataModel = {}) {
  const objects = dataModel.objects ?? [];
  const relationships = dataModel.relationships ?? [];

  const subjectDefinitions = objects.map((object) => ({
    subjectType: object.objectId,
    label: object.label,
    keyAttributes: (object.fields ?? [])
      .filter((field) => field.identity || field.required)
      .map((field) => field.key)
      .slice(0, 6),
    archetypeId: object.archetypeId,
  }));

  const relationshipDefinitions = relationships.map((rel) => ({
    relationshipType: rel.relationshipId,
    label: rel.label,
    category: rel.kind ?? "reference",
    fromSubjectType: rel.from,
    toSubjectType: rel.to,
    cardinality: normalizeCardinality(rel.cardinality),
  }));

  const qualificationFieldSchemas = objects.map((object) => ({
    subjectType: object.objectId,
    requestType: null,
    fields: (object.fields ?? []).map((field) => ({
      key: field.key,
      label: field.label,
      valueType: mapValueType(field.fieldType),
      allowedValues: field.allowedValues ?? undefined,
      required: Boolean(field.required),
      segmentable: Boolean(field.searchable),
      sensitive: /email|phone|signature/i.test(field.fieldType),
      fieldType: field.fieldType,
      validation: field.validation ?? {},
      roleEdit: field.roleEdit ?? [],
      roleView: field.roleView ?? [],
    })),
  }));

  const formDefinitions = (dataModel.forms ?? []).map((form) => ({
    formId: form.formId,
    objectId: form.objectId,
    kind: form.kind,
    label: form.label,
    sections: form.sections ?? [],
    features: form.features ?? {},
  }));

  const viewDefinitions = (dataModel.views ?? []).map((view) => ({
    viewId: view.viewId,
    objectId: view.objectId,
    viewType: view.viewType,
    label: view.label,
    columns: view.columns ?? [],
    sort: view.sort ?? null,
    groupBy: view.groupBy ?? null,
  }));

  const searchDefinitions = (dataModel.searches ?? []).map((search) => ({
    searchId: search.searchId,
    objectId: search.objectId,
    label: search.label,
    kind: search.kind,
    filters: search.filters ?? [],
    pinned: Boolean(search.pinned),
  }));

  const reportDefinitions = (dataModel.reports ?? []).map((report) => ({
    reportId: report.reportId,
    objectId: report.objectId,
    label: report.label,
    kind: report.kind,
    groupBy: report.groupBy ?? null,
    metrics: report.metrics ?? [],
  }));

  const detailPageDefinitions = objects.map((object) => ({
    objectId: object.objectId,
    sections: [...DETAIL_PAGE_SECTIONS],
  }));

  const moduleHints = objects.slice(0, 5).map((object, index) => ({
    moduleId: `records_${object.objectId}`,
    label: object.label,
    moduleType: "records",
    viewType: "records_list",
    subjectTypes: [object.objectId],
    searchScopes: [object.objectId],
    navigationPriority: 20 + index,
    primaryNavigationEligible: index < 3,
  }));

  return deepFreeze({
    subjectDefinitions,
    relationshipDefinitions,
    qualificationFieldSchemas,
    formDefinitions,
    viewDefinitions,
    searchDefinitions,
    reportDefinitions,
    detailPageDefinitions,
    moduleHints,
    tenantIsolation: {
      scopedByBusinessId: true,
      noCrossTenantReads: true,
      subjectScopedToBusiness: true,
    },
  });
}

function normalizeCardinality(value) {
  const raw = String(value ?? "one_to_many");
  if (raw === "many_to_one") return "one_to_many";
  return raw;
}

function mapValueType(fieldType) {
  switch (String(fieldType)) {
    case "number":
    case "currency":
    case "percent":
      return "number";
    case "boolean":
      return "boolean";
    case "single_select":
      return "enum";
    case "relationship":
    case "person":
    case "organization":
      return "subjectRef";
    case "json":
    case "location":
    case "custom_metadata":
      return "json";
    default:
      return "string";
  }
}
