# LLM Providers (Foundational Abstraction)

VIBETech uses a provider abstraction to separate:

- **What** an employee should do (business contracts inside employees)
- **How** the platform performs that work (providers/integrations)

This prevents vendor lock-in because provider implementations can be swapped without changing employee artifacts or runtime governance contracts.

---

## Purpose of `LLMProvider`

`LLMProvider` defines the generic provider contract for Large Language Model integrations.

It exposes:

- `generate(prompt)`

This base class is intentionally not implemented and must throw a clear "not implemented" error.

IMPORTANT:
- No API calls are made in `LLMProvider`.
- Concrete providers implement `generate(prompt)` only.

---

## Purpose of `OpenAIProvider`

`OpenAIProvider` is the first concrete LLM provider implementation.

It supports two modes:

1. **Demo mode** (default)
   - Deterministic fake draft output for free local development.
   - Requires no API keys.

2. **Live mode** (scaffold only)
   - Prepared to integrate with OpenAI later.
   - Does NOT perform any live API calls in this sprint.
   - If `OPENAI_API_KEY` is missing, it returns a deterministic message instead of calling any API.
   - No paid/live dependency behavior is required for local development.

IMPORTANT constraint:
- No live API calls are allowed unless `OPENAI_API_KEY` is present **and** the provider mode is explicitly set to `"live"`.
- This sprint does not wire any live call yet.

---

## Why provider abstraction protects the platform from vendor lock-in

Provider abstraction ensures:

- Employee contracts and decision governance remain stable.
- LLM vendors can change without rewriting employees.
- Testing can run deterministically in demo mode.
- Future DraftGenerator components can call providers through the stable `generate(prompt)` contract.

