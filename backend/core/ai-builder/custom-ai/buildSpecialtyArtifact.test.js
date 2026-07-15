import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeSpecialtyArtifact,
  hydrateSpecialtyArtifact,
  resolveSpecialtyArtifactTemplate,
} from "../specialty/SpecialtyArtifactComposer.js";

describe("SpecialtyArtifactComposer", () => {
  it("selects session_flow for practice briefs and returns a timeline diagram", () => {
    const template = resolveSpecialtyArtifactTemplate({
      label: "Practice & Workout Plan Builder",
      purpose: "create daily workout and practice plans",
      instruction: "Build Friday practice plan for U14",
    });
    assert.equal(template.id, "session_flow");

    const artifact = composeSpecialtyArtifact({
      label: "Practice & Workout Plan Builder",
      purpose: "create daily workout and practice plans",
      instruction: "Build Friday practice plan for U14",
      nowISO: "2026-07-01T12:00:00.000Z",
      consultResult: {
        sources: [],
        gaps: [{ code: "missing_curriculum_sources", message: "No sources" }],
        packMatches: [],
        preferred: null,
        consultedAt: "2026-07-01T12:00:00.000Z",
      },
    });

    assert.equal(artifact.kind, "specialty_deliverable");
    assert.equal(artifact.templateId, "session_flow");
    assert.equal(artifact.diagram.layout, "timeline");
    assert.ok(artifact.diagram.nodes.length >= 4);
    assert.match(artifact.title, /Friday/i);
    assert.match(String(artifact.diagram.nodes[0].label), /Warm-up|Open/i);
    assert.equal(artifact.diagram.vocabularyId, "athletic_session");
    assert.ok(artifact.gaps?.length);
    assert.equal(
      artifact.diagram.nodes.flatMap((node) => node.activities ?? []).length,
      0,
    );
  });

  it("uses checklist template for inspection briefs without sports keywords", () => {
    const artifact = composeSpecialtyArtifact({
      label: "Compliance Specialist",
      purpose: "Run property walkthroughs",
      instruction: "Build an inspection checklist for unit 4B",
      nowISO: "2026-07-01T12:00:00.000Z",
    });
    assert.equal(artifact.templateId, "checklist_run");
    assert.equal(artifact.diagram.layout, "sequence");
  });

  it("hydrates outline-only artifacts into a curriculum gap without inventing stations", () => {
    const outline = {
      kind: "specialty_deliverable",
      templateId: "session_flow",
      title: "Friday plan — U14",
      diagram: {
        layout: "timeline",
        header: { title: "Friday plan — U14", subtitle: "Build Friday practice plan for U14" },
        nodes: [
          { id: "open", label: "Warm-up", details: ["Confirm attendance / readiness"], activities: [] },
        ],
      },
    };
    const hydrated = hydrateSpecialtyArtifact({
      artifact: outline,
      label: "Practice & Workout Plan Builder",
      purpose: "create daily workout and practice plans",
      instruction: "Build Friday practice plan for U14",
      nowISO: "2026-07-01T12:00:00.000Z",
    });
    assert.ok(hydrated.gaps?.length);
    assert.equal(
      hydrated.diagram.nodes.flatMap((node) => node.activities ?? []).length,
      0,
    );
  });
});
