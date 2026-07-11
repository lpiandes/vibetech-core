import assert from "node:assert/strict";
import { test } from "node:test";

import { composeRecordsView } from "./composeRecordsView.js";
import { DataFormsEngine } from "../../../backend/core/data-forms/DataFormsEngine.js";

test("composeRecordsView projects data model for portal workspace", () => {
  const recommended = new DataFormsEngine().recommendDataModel({
    businessSummary: { industry: "dental" },
    businessId: "biz_dental",
  });
  const view = composeRecordsView({
    dataModel: recommended.dataModel,
    businessOsMapping: recommended.businessOsMapping,
  });
  assert.equal(view.hasRecords, true);
  assert.ok(view.objects.length >= 3);
  assert.ok(view.forms.length >= 1);
  assert.ok(view.views.length >= 1);
  assert.ok(view.searches.length >= 1);
  assert.ok(view.reports.length >= 1);
  assert.ok(view.metrics.some((entry) => entry.id === "objects"));
});

test("composeRecordsView falls back to subjectDefinitions", () => {
  const view = composeRecordsView({
    configuration: {
      subjectDefinitions: [
        { subjectType: "patient", label: "Patient", keyAttributes: ["displayName"] },
      ],
    },
  });
  assert.equal(view.hasRecords, true);
  assert.equal(view.objects[0].id, "patient");
});
