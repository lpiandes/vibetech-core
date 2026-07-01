# Knowledge Intelligence Layer (Sprint 5)

## Purpose
The **Knowledge Intelligence Engine** analyzes a deterministic `ProcessedDocument` (Sprint 4 output) and produces a canonical **Knowledge Intelligence Report**.

This sprint is **analysis only**:
- no runtime mutations
- no repository writes
- no Company Brain changes
- no knowledge normalization
- no embeddings, vectors, semantic search, or AI

## Responsibilities
- Classify the processed document into:
  - detectedDocumentType
  - suggestedCategoryId
  - business areas
  - suggested employees
- Produce deterministic confidence scores.
- Provide a deterministic duplicate detection framework (exact fingerprints only).
- Determine whether human review is required before normalization (future Sprint).

## Classification Pipeline (deterministic)
1. DocumentTypeClassifier
2. BusinessAreaClassifier
3. CategoryClassifier
4. EmployeeApplicabilityClassifier
5. ConfidenceScorer
6. DuplicateDetector (framework: fingerprint matching)
7. Review requirement decision

## Future compatibility
- Future AI/ML classifiers can replace individual classifiers behind the engine interface.
- Future semantic duplicate detection can be added to `DuplicateDetector` via an additional strategy.

