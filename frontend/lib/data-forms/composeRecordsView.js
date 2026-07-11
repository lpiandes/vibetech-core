/**
 * Pure Records workspace projection — no React.
 * Prefers Business OS mapping / data model; falls back to subject type lists.
 *
 * @param {{
 *   configuration?: Record<string, any> | null,
 *   dataModel?: Record<string, any> | null,
 *   businessOsMapping?: Record<string, any> | null,
 *   subjectTypes?: string[],
 * }} [args]
 */
export function composeRecordsView({
  configuration = null,
  dataModel = null,
  businessOsMapping = null,
  subjectTypes = /** @type {string[]} */ ([]),
} = {}) {
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const mapping = businessOsMapping
    ?? configuration?.dataForms
    ?? null;

  const model = dataModel ?? null;

  const objects = model?.objects?.length
    ? model.objects.map((object) => ({
      id: String(object.objectId),
      label: String(object.label ?? object.objectId),
      archetypeId: object.archetypeId ?? null,
      fieldCount: asArray(object.fields).length,
      formCount: asArray(object.forms).length,
      viewCount: asArray(object.views).length,
      fields: asArray(object.fields).map((field) => ({
        key: field.key,
        label: field.label,
        fieldType: field.fieldType,
        required: Boolean(field.required),
      })),
    }))
    : asArray(mapping?.subjectDefinitions ?? configuration?.subjectDefinitions).map((entry) => ({
      id: String(entry.subjectType ?? entry.id),
      label: String(entry.label ?? entry.subjectType ?? "Record"),
      archetypeId: entry.archetypeId ?? null,
      fieldCount: asArray(entry.keyAttributes).length,
      formCount: 0,
      viewCount: 0,
      fields: asArray(entry.keyAttributes).map((key) => ({
        key: String(key),
        label: String(key),
        fieldType: "text",
        required: true,
      })),
    }));

  const relationships = asArray(model?.relationships ?? mapping?.relationshipDefinitions).map((rel) => ({
    id: String(rel.relationshipId ?? rel.relationshipType ?? `${rel.from}_${rel.to}`),
    label: String(rel.label ?? "Relationship"),
    from: String(rel.from ?? rel.fromSubjectType ?? ""),
    to: String(rel.to ?? rel.toSubjectType ?? ""),
    cardinality: String(rel.cardinality ?? "one_to_many"),
    kind: String(rel.kind ?? rel.category ?? "reference"),
  }));

  const forms = asArray(model?.forms ?? mapping?.formDefinitions).map((form) => ({
    id: String(form.formId),
    label: String(form.label),
    objectId: String(form.objectId),
    kind: String(form.kind),
  }));

  const views = asArray(model?.views ?? mapping?.viewDefinitions).map((view) => ({
    id: String(view.viewId),
    label: String(view.label),
    objectId: String(view.objectId),
    viewType: String(view.viewType),
  }));

  const searches = asArray(model?.searches ?? mapping?.searchDefinitions).map((search) => ({
    id: String(search.searchId),
    label: String(search.label),
    objectId: String(search.objectId),
    kind: String(search.kind),
    pinned: Boolean(search.pinned),
  }));

  const reports = asArray(model?.reports ?? mapping?.reportDefinitions).map((report) => ({
    id: String(report.reportId),
    label: String(report.label),
    objectId: String(report.objectId),
    kind: String(report.kind),
  }));

  const fallbackSubjects = asArray(subjectTypes).map((type) => String(type));
  const hasRecords = objects.length > 0 || fallbackSubjects.length > 0;

  return {
    hasRecords,
    objects: objects.length
      ? objects
      : fallbackSubjects.map((type) => ({
        id: type,
        label: type.replace(/_/g, " "),
        archetypeId: null,
        fieldCount: 0,
        formCount: 0,
        viewCount: 0,
        fields: [],
      })),
    relationships,
    forms,
    views,
    searches,
    reports,
    permissions: model?.permissions ?? null,
    tenantIsolation: model?.tenantIsolation ?? mapping?.tenantIsolation ?? {
      scopedByBusinessId: true,
    },
    metrics: [
      { id: "objects", label: "Objects", value: objects.length || fallbackSubjects.length },
      { id: "fields", label: "Fields", value: objects.reduce((sum, entry) => sum + entry.fieldCount, 0) },
      { id: "forms", label: "Forms", value: forms.length },
      { id: "views", label: "Views", value: views.length },
      { id: "searches", label: "Searches", value: searches.length },
      { id: "reports", label: "Reports", value: reports.length },
    ],
  };
}
