/**
 * Pure helpers for pipeline card automation events (PIPELINE_CARD_CREATED /
 * PIPELINE_STAGE_ENTERED). Mirrors `frontend/lib/pipelines/pipelineCardEvents.ts`
 * so backend-only call sites (Meta ingest, forms/submit, book) that cannot
 * import frontend TypeScript can build the same eventPayload shape used by
 * the pipelines route.
 */

/** Find a card by id (across all pipelines) and the stage it currently belongs to. */
export function findCardAndStage(crm, cardId, stageId = null) {
  const card = (crm?.pipelines ?? [])
    .flatMap((p) => p.cards ?? [])
    .find((c) => String(c.id) === String(cardId)) ?? null;
  const targetStageId = stageId ?? card?.stageId ?? null;
  const stage = (crm?.pipelines ?? [])
    .flatMap((p) => (p.stages ?? []).map((s) => ({ ...s, pipelineId: p.id, pipelineName: p.name })))
    .find((s) => String(s.id) === String(targetStageId)) ?? null;
  return { card, stage };
}

/** Build the eventPayload shape used for both PIPELINE_CARD_CREATED and PIPELINE_STAGE_ENTERED. */
export function buildPipelineCardEventPayload({ pipelineId, card, stage }) {
  const stageId = card?.stageId ?? stage?.id ?? null;
  const stageLabel = stage?.label ?? null;
  return {
    pipelineId,
    pipelineName: stage?.pipelineName ?? null,
    cardId: card ? String(card.id) : null,
    title: card?.title ?? null,
    stageId,
    stageLabel,
    contactId: card?.contactId ?? null,
    pipeline: {
      id: pipelineId,
      name: stage?.pipelineName ?? null,
      stageId,
      stageLabel,
    },
  };
}
