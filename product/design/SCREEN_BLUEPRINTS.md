# Screen Blueprints

No implementation details—only the visual blueprint: purpose, primary question, primary CTA, major sections, and reading order.

## Dashboard

Purpose:
- Provide high-level status at a glance.

Primary question:
- “What’s happening right now?”

Primary CTA:
- Secondary navigation (e.g., “Review Work”) depending on product flow.

Major sections:
- KPI metrics (MetricCard)
- Activity summary / governance summary cards (InfoCard)

Approximate reading order:
1. Page title
2. KPI metrics grid
3. Summary cards

## Work Queue

Purpose:
- Allow reviewers to scan and select work items from Digital Employees.

Primary question:
- “Which item needs my attention?”

Primary CTA:
- `Review Work` (inside each queue card)

Major sections:
- Page title (PageTitle)
- Search + Filter Bar (SearchInput + Filter chips)
- Queue List (Queue Card pattern)
- Empty State (if no items)

Approximate reading order:
1. Eyebrow + title + description
2. Search and filter bar
3. Queue cards (client → matter type → assigned employee → badges → created time → Review Work button)
4. Empty state (only when needed)

## Review Work

Purpose:
- Present all context required to review a specific item safely and professionally.

Primary question:
- “Is this draft appropriate?”

Primary CTA:
- `Approve` (dominant inside action area)

Major sections:
1. Review Header (title + context)
2. Case Summary (client/matter/priority/status/assigned employee/created time)
3. Attorney Note (exact note text)
4. Employee Recommendation (concise professional reasoning, business-focused)
5. Draft Preview (document-like viewer)
6. Feedback (visual-only placeholder)
7. Approval Status + Actions

Approximate reading order:
1. Header
2. Case summary card
3. Attorney note card
4. Recommendation
5. Draft preview
6. Feedback
7. Approval status and action buttons

## My Team

Purpose:
- Help reviewers understand work coverage by team and employee.

Primary question:
- “Who should I look at?”

Primary CTA:
- Typically `Review Work` after selecting an employee/team.

Major sections:
- Page title
- Employee list cards (Employee Card)
- Optional empty state (if no employees)

Approximate reading order:
1. Page title
2. Employee cards list
3. Empty state when applicable

## Employee Profile

Purpose:
- Provide identity context and historical governance outcomes.

Primary question:
- “What should I expect from this employee’s work?”

Primary CTA:
- `Review Work` (to open review flow for a specific item; implementation later)

Major sections:
- Page title + employee identity (Avatar + details)
- Summary metrics (MetricCard)
- Supporting info cards (InfoCard)

Approximate reading order:
1. Page title + employee identity
2. KPI metrics
3. Supporting cards

## Performance

Purpose:
- Show governance performance indicators for teams/employees.

Primary question:
- “Where is value being created?”

Primary CTA:
- None required (or secondary navigation to review queue)

Major sections:
- Page title
- Performance KPI cards
- Trend / summary cards

Approximate reading order:
1. Page title
2. KPI grid
3. Trend/supporting cards

