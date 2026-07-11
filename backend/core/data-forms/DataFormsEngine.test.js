import assert from "node:assert/strict";
import { test } from "node:test";

import { DataFormsEngine } from "./DataFormsEngine.js";
import { mapDataFormsToBusinessOS } from "./mapDataFormsToBusinessOS.js";
import {
  listFieldTypeIds,
  UNIVERSAL_FIELD_TYPES,
} from "./FieldTypeRegistry.js";
import {
  listObjectArchetypeIds,
  resolveDataModelTemplate,
} from "./ObjectArchetypeCatalog.js";
import { validateRecord } from "./ValidationEngine.js";
import { ObjectRecommendationEngine } from "../ai-builder/ObjectRecommendationEngine.js";
import { ObjectGenerationStage } from "../architect/ArchitectMatchingStages.js";
import { createBlueprintDefinition } from "../blueprints/BlueprintDefinition.js";

test("object generation uses reusable archetypes across industries", () => {
  const engine = new DataFormsEngine();
  for (const industry of ["property_management", "dental", "sports", "default"]) {
    const result = engine.recommendDataModel({ businessSummary: { industry } });
    assert.equal(result.ok, true);
    assert.ok(result.dataModel.objects.length >= 4, industry);
    for (const object of result.dataModel.objects) {
      assert.ok(listObjectArchetypeIds().includes(object.archetypeId), object.archetypeId);
      assert.ok(object.fields.length >= 2);
    }
  }
});

test("field generation uses universal field types only", () => {
  const result = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "dental" },
  });
  const known = new Set(listFieldTypeIds());
  for (const object of result.dataModel.objects) {
    for (const field of object.fields) {
      assert.ok(known.has(field.fieldType), field.fieldType);
      assert.ok(UNIVERSAL_FIELD_TYPES[field.fieldType]);
    }
  }
});

test("relationship generation is universal and never property-hardcoded in engine", () => {
  const dental = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "dental" },
  });
  assert.ok(dental.dataModel.relationships.length >= 1);
  assert.ok(dental.dataModel.relationships.every((rel) => rel.from && rel.to && rel.cardinality));
  assert.equal(
    dental.dataModel.relationships.some((rel) => /property/i.test(rel.from) || /property/i.test(rel.to)),
    false,
  );

  const sports = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "sports" },
  });
  assert.ok(sports.dataModel.relationships.some((rel) => rel.from === "player" || rel.to === "player"));
});

test("validation supports required unique role-edit and defaults", () => {
  const result = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "default" },
  });
  const customer = result.dataModel.objects.find((entry) => entry.objectId === "customer");
  assert.ok(customer);

  const missing = validateRecord({
    objectDefinition: customer,
    values: {},
    role: "EMPLOYEE",
  });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((error) => error.code === "required"));

  const ok = validateRecord({
    objectDefinition: customer,
    values: { displayName: "Acme" },
    role: "EMPLOYEE",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.values.status, "active");

  const viewerBlocked = validateRecord({
    objectDefinition: {
      ...customer,
      fields: customer.fields.map((field) => (
        field.key === "displayName"
          ? { ...field, roleEdit: ["OWNER"] }
          : field
      )),
    },
    values: { displayName: "Changed" },
    role: "VIEWER",
  });
  assert.equal(viewerBlocked.ok, false);
  assert.ok(viewerBlocked.errors.some((error) => error.code === "role_edit"));

  const uniqueFail = validateRecord({
    objectDefinition: {
      ...customer,
      fields: customer.fields.map((field) => (
        field.key === "displayName" ? { ...field, unique: true } : field
      )),
    },
    values: { displayName: "Acme" },
    role: "OWNER",
    existingKeysByField: { displayName: new Set(["Acme"]) },
  });
  assert.equal(uniqueFail.ok, false);
  assert.ok(uniqueFail.errors.some((error) => error.code === "unique"));
});

test("form generation covers create edit view and features", () => {
  const result = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "sports" },
  });
  assert.ok(result.dataModel.forms.length >= 5);
  const kinds = new Set(result.dataModel.forms.map((form) => form.kind));
  assert.ok(kinds.has("create"));
  assert.ok(kinds.has("edit"));
  assert.ok(kinds.has("view"));
  for (const form of result.dataModel.forms) {
    assert.ok(form.sections.length >= 1);
    assert.equal(typeof form.features.validation, "boolean");
    assert.equal(typeof form.features.roleVisibility, "boolean");
  }
});

test("view generation includes multiple list presentations", () => {
  const result = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "property_management" },
  });
  const viewTypes = new Set(result.dataModel.views.map((view) => view.viewType));
  assert.ok(viewTypes.has("table"));
  assert.ok(viewTypes.size >= 3);
});

test("search generation includes global saved and advanced", () => {
  const result = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "default" },
  });
  const kinds = new Set(result.dataModel.searches.map((search) => search.kind));
  assert.ok(kinds.has("global"));
  assert.ok(kinds.has("saved"));
  assert.ok(kinds.has("advanced"));
  assert.ok(result.dataModel.searches.some((search) => search.pinned));
});

test("reporting generation includes counts totals or grouped with exports", () => {
  const result = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "dental" },
  });
  assert.ok(result.dataModel.reports.length >= 2);
  assert.ok(result.dataModel.reports.every((report) => report.exportable !== false || report.metrics));
  assert.ok(result.dataModel.reports.some((report) => report.kind === "counts" || report.kind === "totals" || report.kind === "grouped"));
});

test("role permissions are generated per membership role", () => {
  const result = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "default" },
  });
  assert.equal(result.dataModel.permissions.OWNER.canDelete, true);
  assert.equal(result.dataModel.permissions.VIEWER.canEdit, false);
  assert.ok(result.dataModel.permissions.MANAGER.objects.length >= 1);
});

test("every recommendation includes reason confidence evidence alternatives", () => {
  const result = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "property_management" },
  });
  assert.ok(result.recommendations.length >= 10);
  for (const recommendation of result.recommendations) {
    assert.ok(recommendation.reason || recommendation.why);
    assert.equal(typeof recommendation.confidence, "number");
    assert.ok(Array.isArray(recommendation.evidence));
    assert.ok(Array.isArray(recommendation.alternatives));
  }
});

test("mapDataFormsToBusinessOS fills existing Business OS fields", () => {
  const result = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "sports" },
    businessId: "biz_sports_1",
  });
  const mapped = mapDataFormsToBusinessOS(result.dataModel);
  assert.ok(mapped.subjectDefinitions.length >= 4);
  assert.ok(mapped.subjectDefinitions.every((entry) => entry.subjectType && entry.keyAttributes.length));
  assert.ok(mapped.relationshipDefinitions.length >= 1);
  assert.ok(mapped.formDefinitions.length >= 1);
  assert.ok(mapped.viewDefinitions.length >= 1);
  assert.ok(mapped.searchDefinitions.length >= 1);
  assert.ok(mapped.reportDefinitions.length >= 1);
  assert.ok(mapped.qualificationFieldSchemas.length >= 1);
  assert.equal(mapped.tenantIsolation.scopedByBusinessId, true);
});

test("blueprint reuse — subjectDefinitions fit blueprint recipe shape", () => {
  const result = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "default" },
  });
  const mapped = result.businessOsMapping;
  const blueprint = createBlueprintDefinition({
    blueprintId: "bp_data_forms_reuse_test",
    name: "Data forms reuse",
    industry: "generic",
    maturity: "experimental",
    subjectDefinitions: mapped.subjectDefinitions,
    relationshipDefinitions: mapped.relationshipDefinitions,
  });
  assert.ok(blueprint.subjectDefinitions.length >= 1);
  assert.equal(blueprint.subjectDefinitions[0].subjectType, mapped.subjectDefinitions[0].subjectType);
});

test("multi-industry generation differs by object labels without separate engines", () => {
  const pm = resolveDataModelTemplate("property_management");
  const dental = resolveDataModelTemplate("dental");
  const sports = resolveDataModelTemplate("sports");
  assert.ok(pm.objects.some((entry) => entry.objectId === "property"));
  assert.ok(dental.objects.some((entry) => entry.objectId === "patient"));
  assert.ok(sports.objects.some((entry) => entry.objectId === "player"));
  assert.notEqual(pm.objects[0].label, dental.objects[0].label);
});

test("tenant isolation is explicit on data model and mapping", () => {
  const a = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "default" },
    businessId: "biz_a",
  });
  const b = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "default" },
    businessId: "biz_b",
  });
  assert.equal(a.dataModel.tenantIsolation.businessId, "biz_a");
  assert.equal(b.dataModel.tenantIsolation.businessId, "biz_b");
  assert.equal(a.businessOsMapping.tenantIsolation.noCrossTenantReads, true);
  assert.notEqual(a.dataModel.tenantIsolation.businessId, b.dataModel.tenantIsolation.businessId);
});

test("ObjectRecommendationEngine facade preserves object recommendations", () => {
  const facade = new ObjectRecommendationEngine();
  const result = facade.recommend({ businessSummary: { industry: "dental" } });
  assert.equal(result.ok, true);
  assert.ok(result.recommendations.length >= 2);
  assert.ok(result.dataModel.forms.length >= 1);
  assert.ok(result.recommendations.every((entry) => entry.kind === "business_object"));
});

test("Architect object_generation stage outputs data model", () => {
  const stage = new ObjectGenerationStage();
  const result = stage.generate({
    dna: {
      company: { industry: "sports", whatTheyDo: "Travel hockey club" },
    },
    businessId: "biz_hockey",
  });
  assert.equal(result.stageId, "object_generation");
  assert.ok(result.outputs.objects.length >= 2);
  assert.ok(result.outputs.dataModel.objects.length >= 2);
  assert.ok(result.outputs.businessOsMapping.subjectDefinitions.length >= 2);
});

test("missing archetype recommends reusable archetype not one-off object", () => {
  const known = new Set(listObjectArchetypeIds());
  assert.equal(known.has("one_off_custom_widget"), false);
  assert.ok(known.has("customer"));
  assert.ok(known.has("work_order"));
});
