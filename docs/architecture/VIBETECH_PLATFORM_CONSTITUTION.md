# VIBETech Platform Constitution

**Status:** Authoritative architecture document  
**Scope:** Permanent platform contracts  
**Rule:** Do not revisit this architecture unless absolutely necessary.  
**Companion:** [Product Constitution](../product/VIBETECH_PRODUCT_CONSTITUTION.md) (what we sell / how it must feel to the owner)

---

## 1. Platform philosophy

VIBETech is **not** a CRM, chatbot, or workflow builder.

VIBETech is a platform that **designs, installs, operates, and continuously improves Business Operating Systems** for any organization.

Principles:

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
12. Compound: each feature should make other features more valuable.

---

## 2. Universal vs Blueprint vs Customer configuration

| Layer | Owns | Changes how |
|-------|------|-------------|
| **Universal Platform** | Work, Knowledge, Team, Approvals, Communications primitives, safe routes, install governance | Platform releases only |
| **Blueprint** | Industry/reusable recipes (modules, employees, workflows, terminology defaults) | Blueprint registry + Gold promotions |
| **Customer configuration** | Business-specific labels, enabled modules, role visibility, appearance, installed spec version | Builder propose → dry run → approve → install |

**Business DNA** is the AI’s human-readable understanding of a company.  
**Business OS Specification** is the installable runtime contract.  
They are related but never the same object.

---

## 3. AI reasoning principles

1. Evidence before conclusions.
2. Confidence is explicit; uncertainty stays unresolved.
3. Prefer existing installed capabilities, then Gold, then industry, then reusable components.
4. Never silently install or change permissions.
5. Never fabricate metrics or pretend integrations are live.
6. Works without a paid AI provider (deterministic adapters required).
7. Findings from websites/files require confirmation before treated as truth.

---

## 4. Platform layering

```
Evidence / Research
        ↓
Business DNA (understanding)
        ↓
Business Intelligence Graph (relationships)
        ↓
Blueprint Resolution (reuse order)
        ↓
Business OS Specification (installable)
        ↓
Compiler → Dry Run → Approval → Installer
        ↓
Universal Renderers (registered components only)
        ↓
Operate → Continuous Improve
```

Existing Business OS, Blueprint Registry, Compiler, Installer, and operating loops remain the implementation substrate. Constitution contracts **extend** them.

---

## 5. Long-term roadmap (locked after this epic)

1. Architect UX  
2. Universal Component Library  
3. Navigation Renderer  
4. Dashboard Renderer  
5. Business Portal Generator  
6. Admin Platform  
7. Continuous Improvement depth  
8. Marketplace  

No more foundational redesigns unless constitution rules are violated.

---

## 6. Extension rules

Every addition must belong to **exactly one**:

| Bucket | Examples |
|--------|----------|
| **Platform** | Work queue primitives, approval engine, safe routes |
| **Blueprint** | Property Management Gold, future Dental Gold |
| **Configuration** | A business’s terminology, enabled modules, roles |
| **Renderer** | Registered dashboard card, navigation item projection |
| **Gap** | Unsupported capability recorded honestly |

Violations: industry-specific core code, arbitrary JSX generation, silent permission changes, McBride-only platform logic.

---

## 7. Governance rules

- Propose → Explain → Preview → Dry Run → Approve → Install  
- Approval binds specification content hash + installation plan hash  
- Spec changes invalidate approval  
- Tenant isolation is mandatory  
- Support access is explicit and audited  
- Employees request access via governed Work unless permitted  

---

## 8. Contract index (code)

| Contract | Module |
|----------|--------|
| Layers & extension rules | `backend/core/platform/constitution/` |
| Business DNA | `backend/core/platform/contracts/BusinessDna.js` |
| Business Intelligence | `backend/core/platform/contracts/BusinessIntelligenceContracts.js` |
| Intelligence Graph | `backend/core/platform/contracts/BusinessIntelligenceGraph.js` |
| Universal Renderers | `backend/core/platform/contracts/UniversalRendererContracts.js` |
| Component Registry | `backend/core/platform/contracts/ComponentRegistryContract.js` |
| Blueprint resolution order | `backend/core/platform/constitution/BlueprintResolutionOrder.js` |
| AI Architect lifecycle | `backend/core/platform/constitution/AiArchitectLifecycle.js` |

Root `PLATFORM_CONSTITUTION.md` remains the short permanent rules list; **this document is the full constitution.**
