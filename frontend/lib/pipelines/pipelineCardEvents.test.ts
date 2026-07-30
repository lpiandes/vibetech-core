import assert from "node:assert/strict";
import { test } from "node:test";

import { findCardAndStage, buildPipelineCardEventPayload } from "./pipelineCardEvents.ts";

function makeCrm() {
  return {
    pipelines: [
      {
        id: "pipe_1",
        name: "Sales pipeline",
        stages: [
          { id: "stage_new", label: "New" },
          { id: "stage_qualified", label: "Qualified" },
        ],
        cards: [
          { id: "card_1", title: "Acme Corp", stageId: "stage_new", contactId: "contact_1" },
        ],
      },
    ],
  };
}

test("findCardAndStage locates a card and its current stage by id", () => {
  const crm = makeCrm();
  const { card, stage } = findCardAndStage(crm, "card_1");
  assert.equal(card?.title, "Acme Corp");
  assert.equal(stage?.id, "stage_new");
  assert.equal(stage?.label, "New");
  assert.equal(stage?.pipelineId, "pipe_1");
  assert.equal(stage?.pipelineName, "Sales pipeline");
});

test("findCardAndStage prefers an explicit stageId override (e.g. after a move)", () => {
  const crm = makeCrm();
  const { stage } = findCardAndStage(crm, "card_1", "stage_qualified");
  assert.equal(stage?.id, "stage_qualified");
  assert.equal(stage?.label, "Qualified");
});

test("findCardAndStage returns nulls for an unknown card", () => {
  const crm = makeCrm();
  const { card, stage } = findCardAndStage(crm, "card_missing");
  assert.equal(card, null);
  assert.equal(stage, null);
});

test("buildPipelineCardEventPayload includes pipeline/card/stage/contact fields for PIPELINE_CARD_CREATED", () => {
  const crm = makeCrm();
  const { card, stage } = findCardAndStage(crm, "card_1");
  const payload = buildPipelineCardEventPayload({ pipelineId: "pipe_1", card, stage });
  assert.deepEqual(payload, {
    pipelineId: "pipe_1",
    pipelineName: "Sales pipeline",
    cardId: "card_1",
    title: "Acme Corp",
    stageId: "stage_new",
    stageLabel: "New",
    contactId: "contact_1",
    pipeline: {
      id: "pipe_1",
      name: "Sales pipeline",
      stageId: "stage_new",
      stageLabel: "New",
    },
  });
});

test("buildPipelineCardEventPayload degrades gracefully when card/stage are missing", () => {
  const payload = buildPipelineCardEventPayload({ pipelineId: "pipe_1", card: null, stage: null });
  assert.equal(payload.cardId, null);
  assert.equal(payload.title, null);
  assert.equal(payload.stageId, null);
  assert.equal(payload.pipeline.id, "pipe_1");
});
