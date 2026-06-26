# DraftGenerator (Sprint 8)

## Purpose

`DraftGenerator` is the first orchestration component that creates a draft from:

1. Runtime MVP output (via `RuntimePipeline`)
2. Employee prompt artifacts (via `PromptLoader`)
3. A single assembled prompt (via `PromptBuilder`)
4. An injected LLM provider abstraction (via `LLMProvider.generate`)

This component is strictly **orchestration only**:
- No business logic
- No decision logic
- No provider-specific logic
- No execution side effects (no sending, no approvals, no emails, no GHL integration)

## Why orchestration is separated from generation

In VIBETech, employee artifacts and runtime governance define *what* should happen, while providers/LLMs define *how* prompts are turned into outputs.

`DraftGenerator` keeps these responsibilities separated by composing dedicated components:
- `RuntimePipeline` determines the runtime context and governance metadata (situation/decision/action/plan)
- `PromptLoader` loads employee content artifacts from the employee folder
- `PromptBuilder` assembles one deterministic prompt string
- `LLMProvider` turns the prompt into a draft (demo-first behavior for free development)

Because `DraftGenerator` only coordinates these steps, each component can evolve independently without breaking the overall orchestration contract.

## Why dependency injection is used

Dependency injection ensures `DraftGenerator` remains reusable, testable, and provider-agnostic:
- You can swap `RuntimePipeline`, `PromptLoader`, `PromptBuilder`, and `LLMProvider` implementations without modifying orchestration code.
- Unit tests can inject fakes/mocks for deterministic coverage.
- Provider lock-in is avoided because the injected provider implements the stable `generate(prompt)` contract.

## How future components will consume its output

Later roadmap steps (not implemented in Sprint 8) will use `{ runtime, prompt, draft }` to:
- run attorney approval workflows
- generate business-ready employee artifacts (drafts, SOP updates, structured outputs)
- write outputs into employee repositories or downstream systems

