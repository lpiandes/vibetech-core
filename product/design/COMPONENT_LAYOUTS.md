# Component Layouts

Document the canonical layout for reusable components.

Each section defines:
- **Purpose**
- **Hierarchy**
- **Placement**
- **When to use**

## Metric Card

Purpose:
- Display a KPI value with a clear label for quick scanning.

Hierarchy:
- Label: small, uppercase, tracking-widest.
- Value: large, bold, prominent.
- Optional suffix (e.g., `%`, `hrs`) near the value.
- Optional footnote below value for meaning/assumptions.

Placement:
- Use in dashboard or performance-related sections.
- Prefer a tight grid of KPI cards (2–4 across depending on screen size).

When to use:
- When the user must answer “how much?” quickly.

## Employee Card

Purpose:
- Display a trusted employee identity in a compact, premium format.

Hierarchy:
- Avatar (initials/icon) at left.
- Name as primary text.
- Optional secondary line (role/team).

Placement:
- Use inside queue items and profiles.

When to use:
- When a reviewer must quickly understand “who prepared this work”.

## Queue Card

Purpose:
- Present a single item of work in a review queue.
- The card should feel like reviewing work from a known Digital Employee.

Hierarchy (inside the card):
- Client name (largest text).
- Matter type (secondary label).
- Assigned Digital Employee (avatar + name).
- Governance cluster: PriorityBadge + StatusBadge.
- Created time (small, secondary).
- Primary CTA: `Review Work` (dominant button inside the card).

Placement:
- Queue list sections.
- Cards stacked vertically with premium spacing.

When to use:
- Any time the user reviews items that require governance.

## Approval Card

Purpose:
- Communicate a governance requirement and its current approval status.

Hierarchy:
- Title: “Approval Status” (small section heading).
- Two rows:
  - Requires Attorney Approval (label)
  - Pending/Approved/Completed (value)

Placement:
- Typically near the bottom of a review screen, close to primary actions.

When to use:
- When governance constraints are part of the review decision.

## Info Card

Purpose:
- Generic rounded container for short blocks of information.

Hierarchy:
- Optional title (small, semibold).
- Body text underneath.

Placement:
- Supporting context blocks on any screen.

When to use:
- Whenever a block of information should visually belong to a card surface.

## Document Preview

Purpose:
- Present a finished communication in a document-like viewer.
- Must not look like an editable textarea.

Hierarchy:
- A subtle document header (optional).
- Main content rendered with professional spacing.
- Use a typography scale appropriate for reading long text comfortably.

Placement:
- Review Work screen “Draft Preview” area.

When to use:
- Whenever the user reviews the output of a Digital Employee draft for correctness.

## Search

Purpose:
- Let users visually locate items without implying that search is complex or advanced.

Hierarchy:
- Placeholder text is calm and secondary.
- Keep the input height consistent across the app.

Placement:
- SearchInput in the search/filter bar of list screens.

When to use:
- When users must answer “find quickly” in a list view.

## Filter Bar

Purpose:
- Provide a small set of visual filters that help users scan and focus.

Hierarchy:
- Optional search first (left).
- Filter chips follow (right or next row).

Placement:
- Under the screen title and before the queue list.

When to use:
- When there are a small number of governance buckets (e.g., Needs Review, Approved, Completed).

## Buttons

Purpose:
- Primary actions must feel dominant and confident.

Primary buttons:
- Used for the single most important action on the screen.
- Must have strong contrast and premium padding.

Secondary buttons:
- Neutral actions and filter chips that should not compete with primary CTA.

Placement:
- Primary CTA near or inside the main content decision area.

## Badges

Purpose:
- Encode meaning through compact labeled pills.

Hierarchy:
- Small, semibold text.
- Optional dot/indicator.
- Badge sizing must remain consistent across the app.

Badges include:
- StatusBadge (e.g., Needs Review, Approved, Completed, Pending, Working, Offline)
- PriorityBadge (High/Medium/Low)

Placement:
- Inside Queue Cards, Review Work cards, and supporting info blocks.

When to use:
- Whenever an item’s governance context must be visible at a glance.

