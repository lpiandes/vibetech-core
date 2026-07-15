# Platform Constitution (Permanent Rules)

Authoritative full document:
`docs/architecture/VIBETECH_PLATFORM_CONSTITUTION.md`

Companion (what we sell / how it must feel):
`PRODUCT_CONSTITUTION.md` → `docs/product/VIBETECH_PRODUCT_CONSTITUTION.md`

Short permanent rules:

1. Business state exists exactly once.
2. Every object has exactly one owner.
3. Every engine answers exactly one business question.
4. React never owns business logic.
5. Prefer reusable Blueprints and components over custom code.
6. Model business concepts, not vendors.
7. Every core model must pass the multi-industry test.
8. Backend decides structure; frontend renders registered components only.
9. Deterministic by default.
10. AI may propose; humans approve governed installs.
11. Gaps stay visible — never pretend unsupported capabilities work.
12. The Rule of Compounding: every feature should make other features more valuable.

Code contracts live under:
- `backend/core/platform/constitution/`
- `backend/core/platform/contracts/`
- `backend/core/architect/` (Intelligence Engine)
