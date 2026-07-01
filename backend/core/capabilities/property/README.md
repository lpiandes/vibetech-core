# Property Research Capability

This capability helps the **Property Interest Coordinator** understand a property before drafting a buyer response.

## Input
- `property`
- `buyerInquiry`
- `companyKnowledge`

## Output (deterministic business object)
- `propertySummary`
- `buyerFit` (`Excellent` | `Good` | `Moderate` | `Weak`)
- `sellingPoints` (3-5 bullet points)
- `buyerConsiderations` (array; empty when none)
- `recommendedTalkingPoints` (3-5 concise talking points for a future buyer email)
- `confidence` (`High` | `Medium` | `Low`)
- `reasoning` (one short business paragraph)

