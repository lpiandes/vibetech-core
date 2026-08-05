# Design-partner sequence — Managed Revenue Follow-Through

**Status:** Canonical pilot operating procedure.  
**Rule:** Run partners **sequentially**. Partner one exposes foundational problems that would otherwise hit partners two and three.  
**Related:** [DEVELOPMENT_FREEZE.md](./DEVELOPMENT_FREEZE.md) · [DESIGN_PARTNER_RUNBOOK.md](./DESIGN_PARTNER_RUNBOOK.md) · [VIBETECH_PRODUCT_CONSTITUTION.md](./VIBETECH_PRODUCT_CONSTITUTION.md)

---

## Before connecting anything

Document one RFT responsibility (Company Rules / launch confirm). If unclear, VIBETech cannot be accountable:

1. Eligible lead sources  
2. Operating hours  
3. Response SLA  
4. Qualification boundaries  
5. Assignment rules  
6. Approved actions  
7. Approval-required actions  
8. Escalation owner  
9. Success definition  
10. Lost / disqualified definition  
11. Proposal follow-up schedule  
12. Won-work handoff requirements  

Go-live is blocked until these are confirmed.

---

## Observe

Connect real email, calendar, form, and CRM systems. Import enough history to establish (each number linked to evidence):

- Eligible opportunity count  
- Current response time  
- Unanswered leads  
- Meetings without next steps  
- Proposals without follow-up  
- Incomplete handoffs  
- Current human touches per opportunity  

---

## Replay

Run the proposed RFT contract historically. For every disagreement, classify:

| Code | Meaning |
|---|---|
| `missing_business_rule` | Rule not in Company Rules |
| `incorrect_identity_match` | Wrong contact/company match |
| `incorrect_classification` | Wrong service/intent class |
| `missing_evidence` | Required proof absent |
| `unsupported_action` | Integration cannot perform the step |
| `customer_specific_exception` | Valid partner exception |
| `ai_quality_failure` | Model/reasoning failure |
| `bad_source_data` | Dirty CRM/email/form data |

Do **not** patch individual outputs without recording the category.

---

## Shadow

≈ one business week without unsupervised external execution.

Review daily: detected · missed · proposed · human would have done · material edits · false escalations · unsafe proposals · missing rules.

Goal: know **why** disagreement occurs — not perfect agreement.

---

## Prove

Controlled real opportunity through:

Detection → context → classification → assignment → response → scheduling/follow-up → CRM update → **verified outcome**

Trace must contain provider proof for every consequential action.

---

## Go live

Narrow delegation envelope first:

- Automatic internal work creation  
- Automatic CRM updates when evidence is unambiguous  
- Automatic reminders  
- Approval-required external communication  
- Human handling of pricing, commitments, ambiguous qualification  

Expand autonomy **per action class** only after production evidence + customer approval. Never global autonomy.

---

## Operate the service manually where needed

Operator must:

1. Detect the blocked run  
2. Take over before SLA breach  
3. Complete or coordinate the work  
4. Record the intervention (human-time ledger)  
5. Classify why automation failed  
6. Link intervention to the workflow trace  
7. Decide: rule · integration · product fix · permanent human judgment  

This is how VIBETech discovers the actual service.

---

## Human-time ledger (start immediately)

Every intervention records:

- Partner (businessId)  
- Workflow run / case ID  
- Operator  
- Start and end time  
- Minutes spent  
- Intervention category (root cause)  
- Action performed  
- Necessary?  
- Automatable?  
- Estimated labor-cost class  
- Resolution outcome  

Without this ledger you cannot measure human time avoided, delivery cost, automation rate, margin, or leverage.

---

## Weekly pilot scorecard

Track separately (never merge AI completed with operator rescued):

Eligible events · Detected · Completed · Verified outcomes · SLA attainment · Median response time · Automatic completions · Approval-required completions · Operator interventions · Material customer corrections · Exceptions by category · Failed external actions · Unresolved · Human minutes per outcome · Model/provider cost · Customer time required  

---

## Advancement gates

A workflow earns greater autonomy only when:

- Detection coverage consistently high  
- Required evidence present  
- External actions traceable  
- Material edit rates low  
- No unresolved safety incidents  
- Integration delivery reliable  
- Exceptions correctly routed  
- Customer explicitly approves the new delegation level  

---

## Success after three partners

You should be able to say, with evidence:

> VIBETech runs Revenue Follow-Through for three B2B service companies. It processed X real opportunities, met the agreed SLA Y% of the time, completed Z% without operator intervention, and reduced median response time from A to B.

Strongest customer statement:

> “We were going to hire another coordinator. VIBETech now performs that work.”
