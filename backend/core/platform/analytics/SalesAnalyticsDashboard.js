/**
 * Sales Analytics Dashboard — composes real pipeline + outcomes state.
 * No invented conversion rates or forecasts: every number traces back to
 * CrmStore pipeline cards, Work items, or the Outcomes ledger.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { readCrmState, isTerminalPipelineStage } from "../../crm/CrmStore.js";
import { composeOutcomesLedger } from "../../operating-home/composeOutcomesLedger.js";
import { computeWorkMetrics } from "../../work/WorkMetrics.js";

function findStage(pipelines, stageId) {
  for (const pipe of pipelines) {
    const stage = (pipe.stages ?? []).find((s) => String(s.id) === String(stageId));
    if (stage) return stage;
  }
  return null;
}

function isWonStage(stage) {
  return /\bwon\b/i.test(`${stage?.id ?? ""} ${stage?.label ?? ""}`);
}

function isLostStage(stage) {
  return /\blost\b/i.test(`${stage?.id ?? ""} ${stage?.label ?? ""}`);
}

/**
 * @param {{
 *   installation?: object|null,
 *   businessId?: string|null,
 *   recentOutcomes?: object[],
 *   workItems?: object[]|null,
 *   assignments?: object[],
 *   nowISO?: string,
 * }} input
 */
export function composeSalesAnalyticsDashboard({
  installation = null,
  businessId = null,
  recentOutcomes = [],
  workItems = null,
  assignments = [],
  nowISO = new Date().toISOString(),
} = {}) {
  const crm = readCrmState(installation);
  const pipelines = crm.pipelines ?? [];
  const allCards = pipelines.flatMap((p) => p.cards ?? []);

  const byPipeline = pipelines.map((pipe) => {
    const sortedStages = [...(pipe.stages ?? [])].sort((a, b) => a.order - b.order);
    return {
      pipelineId: pipe.id,
      pipelineName: pipe.name,
      stages: sortedStages.map((stage) => ({
        stageId: stage.id,
        label: stage.label,
        order: stage.order,
        cardCount: (pipe.cards ?? []).filter((c) => String(c.stageId) === String(stage.id)).length,
        isTerminal: isTerminalPipelineStage(stage),
      })),
      totalCards: (pipe.cards ?? []).length,
    };
  });

  let openCards = 0;
  let wonCards = 0;
  let lostCards = 0;
  let cardValueOpen = 0;
  let cardValueWon = 0;
  for (const card of allCards) {
    const stage = findStage(pipelines, card.stageId);
    if (isWonStage(stage)) {
      wonCards += 1;
      cardValueWon += Number(card.value) || 0;
    } else if (isLostStage(stage)) {
      lostCards += 1;
    } else {
      openCards += 1;
      cardValueOpen += Number(card.value) || 0;
    }
  }

  const outcomesLedger = composeOutcomesLedger({ installation, recentOutcomes, businessId });

  let work = deepFreeze({
    status: "not_observable",
    reason: "Work runtime items were not provided to the dashboard.",
    openWork: null,
    totalWork: null,
  });
  if (Array.isArray(workItems)) {
    const metrics = computeWorkMetrics({
      workItems,
      assignments: Array.isArray(assignments) ? assignments : [],
      nowISO,
    });
    work = deepFreeze({ status: "observable", ...metrics });
  }

  return deepFreeze({
    generatedAt: nowISO,
    businessId,
    honesty: {
      message: "Pipeline counts come from live CRM pipeline cards; outcome counts require provider evidence. No conversion rates or forecasts are invented.",
    },
    pipeline: {
      totalContacts: (crm.contacts ?? []).length,
      totalCards: allCards.length,
      openCards,
      wonCards,
      lostCards,
      openValue: Math.round(cardValueOpen * 100) / 100,
      wonValue: Math.round(cardValueWon * 100) / 100,
      byPipeline,
    },
    work,
    outcomes: {
      total: outcomesLedger.summary.total,
      completed: outcomesLedger.summary.completed,
      proofBackedCompleted: outcomesLedger.summary.proofBackedCompleted,
      unproven: outcomesLedger.summary.unproven,
      exceptions: outcomesLedger.summary.exceptions,
      conversionMovement: outcomesLedger.metrics.conversionMovement,
    },
  });
}
