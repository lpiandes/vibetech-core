# Knowledge Document Processing Engine (Sprint 4)

## Purpose
The **Document Processing Engine** reads supported document formats and produces a canonical, deterministic **`ProcessedDocument`** representation.

This sprint intentionally does **not**:
- normalize business knowledge
- create Knowledge Items
- update the Knowledge Repository
- interact with Company Brain
- build search / embeddings / vector DB
- implement OCR

## Canonical Output: `ProcessedDocument`
Every processor returns a `ProcessedDocument` object containing:
- `id`
- `sourceType`
- `title`
- `plainText`
- `sections`
- `headings`
- `tables`
- `metadata`
- `warnings`
- `processingStatus`
- `confidence`
- `processingTimeMs`

## Deterministic behavior
- Processors use deterministic heuristics for title/headings/sections/tables.
- `processingTimeMs` is a deterministic constant per format for test stability.
- Failures return `processingStatus: "FAILED"` with deterministic warnings.

## Pipeline stages (conceptual)
DocumentProcessingEngine is a single “read + extract” stage for Sprint 4.

Future sprints can insert parsing/normalization layers after this stage without changing the output contract.

## Supported formats
- TXT
- Markdown
- HTML
- DOCX
- PDF

