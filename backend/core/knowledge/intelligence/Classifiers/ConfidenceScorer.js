function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

export class ConfidenceScorer {
  score({
    processedDocument,
    documentTypeResult,
    businessAreaResult,
    categoryResult,
    duplicateCandidates,
    suggestedEmployees,
  } = {}) {
    const processingStatus = processedDocument?.processingStatus ?? "OK";
    if (processingStatus !== "OK") return { confidence: 0.1, confidenceBreakdown: { processingFailed: true } };

    const docTypeBest = documentTypeResult?.typeSignals?.[0] ?? null;
    const docTypeMaxScore = Math.max(
      ...(Array.isArray(documentTypeResult?.typeSignals)
        ? documentTypeResult.typeSignals.map((s) => s.score)
        : [0]),
    );

    const docTypeSignalNorm = docTypeMaxScore / 20; // rule-based normalization

    const areaSignals = businessAreaResult?.areaSignals ?? [];
    const areaMax = areaSignals.length ? Math.max(...areaSignals.map((s) => s.score)) : 0;
    const businessAreaNorm = areaMax / 20;

    const hasCategory = Boolean(categoryResult?.suggestedCategoryId);
    const categoryNorm = hasCategory ? 0.7 : 0.2;

    const employeeMaxScore = Math.max(
      ...(Array.isArray(suggestedEmployees) ? suggestedEmployees.map((e) => e.matchScore) : [0]),
    );
    const employeesNorm = employeeMaxScore > 0 ? 0.8 : 0.3;

    const duplicatePenalty = Array.isArray(duplicateCandidates) && duplicateCandidates.length
      ? 0.15
      : 0;

    const warnings = Array.isArray(processedDocument?.warnings)
      ? processedDocument.warnings
      : [];
    const warningPenalty = warnings.length ? Math.min(0.2, warnings.length * 0.05) : 0;

    const raw =
      0.35 * docTypeSignalNorm +
      0.25 * businessAreaNorm +
      0.20 * categoryNorm +
      0.20 * employeesNorm -
      duplicatePenalty -
      warningPenalty;

    const confidence = clamp01(raw);

    return {
      confidence,
      confidenceBreakdown: {
        processingFailed: false,
        docTypeSignalNorm,
        businessAreaNorm,
        categoryNorm,
        employeesNorm,
        duplicatePenalty,
        warningPenalty,
      },
    };
  }
}

