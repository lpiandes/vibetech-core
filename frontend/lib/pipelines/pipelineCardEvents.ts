/**
 * Pure helpers for pipeline card automation events (PIPELINE_CARD_CREATED /
 * PIPELINE_STAGE_ENTERED). Kept alias-free and side-effect-free so the
 * shape of the emitted eventPayload can be unit tested without mocking
 * Next.js / auth / workspace runtime.
 */

export type PipelineCardEventCard = {
  id: string;
  title?: string | null;
  stageId?: string | null;
  contactId?: string | null;
} | null | undefined;

export type PipelineCardEventStage = {
  id: string;
  label?: string | null;
  pipelineId?: string | null;
  pipelineName?: string | null;
} | null | undefined;

/** Find a card by id (across all pipelines) and the stage it currently belongs to. */
export function findCardAndStage(crm: any, cardId: string, stageId?: string | null) {
  const card = (crm?.pipelines ?? [])
    .flatMap((p: any) => p.cards ?? [])
    .find((c: any) => String(c.id) === String(cardId)) ?? null;
  const targetStageId = stageId ?? card?.stageId ?? null;
  const stage = (crm?.pipelines ?? [])
    .flatMap((p: any) => (p.stages ?? []).map((s: any) => ({ ...s, pipelineId: p.id, pipelineName: p.name })))
    .find((s: any) => String(s.id) === String(targetStageId)) ?? null;
  return { card, stage };
}

/** Build the eventPayload shape used for both PIPELINE_CARD_CREATED and PIPELINE_STAGE_ENTERED. */
export function buildPipelineCardEventPayload({
  pipelineId,
  card,
  stage,
}: {
  pipelineId: string;
  card: PipelineCardEventCard;
  stage: PipelineCardEventStage;
}) {
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
