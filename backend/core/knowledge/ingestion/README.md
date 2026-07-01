# Knowledge Ingestion Engine (Sprint 3)

## Purpose
The **Knowledge Ingestion Engine** converts external company knowledge sources into canonical **Knowledge Items** stored in the **Knowledge Repository**.

Sprint 3 focuses only on the ingestion pipeline framework and file-based ingestion:
- TXT
- Markdown
- HTML

DOCX and PDF are detected but intentionally not processed yet (parser deferred).

## Responsibilities
The engine executes deterministic pipeline stages:
1. Receive Source
2. Validate Source
3. Detect Source Type
4. Read Content
5. Normalize Content
6. Extract Metadata
7. Create Knowledge Item(s)
8. Publish Company Events
9. Store in Repository (runtime updates only through `runtime.applyEvent`)
10. Return Result

Each stage lives in its own module so it remains independently testable.

## Event Integration
Ingestion emits Company Events:
- `KNOWLEDGE_SOURCE_RECEIVED`
- `KNOWLEDGE_INGESTION_STARTED`
- `KNOWLEDGE_CREATED` (reused to store canonical repository items)
- `KNOWLEDGE_INGESTION_COMPLETED`
- `KNOWLEDGE_INGESTION_FAILED`

The runtime SSOT remains untouched directly by employees or ingestion code; all mutations are performed through `runtime.applyEvent()`.

## Future ingestion sources
The engine is designed to accept multiple adapters (file upload today; website crawl, Drive, SharePoint, Dropbox, email, API, manual entry later).
Only the file adapter is implemented in this sprint.

## Future parsing layer
This sprint uses basic extraction only:
- deterministic text normalization
- markdown heading heuristics
- HTML tag stripping

OCR, advanced parsing, vector embeddings, summarization, search, and knowledge UI are explicitly out of scope.

