# Review Work Components

This folder contains the **Review Work** screen components for the VIBETech Workspace.

## Why Review Work is the heart of the Workspace

Review Work is where business users validate and govern what their Digital Employee is recommending before anything moves forward.

This screen is designed to:
- feel premium and focused
- communicate context top-to-bottom
- present the attorney note, employee thinking, and draft content clearly
- keep actions visible and governance-oriented

## How future runtime + generation will populate this page

This sprint uses mock data only.

In later steps, the runtime/generation layer will populate:
- Case Summary (client/matter/priority/status/assigned employee/timestamps)
- Attorney Note (exact text as authored or provided)
- Employee Thinking (business reasoning, concise and professional)
- Draft Preview (a generated draft document)
- Approval Status (pending/approved/completed)
- Feedback (optional, human input)

The component structure in this folder already matches those sections, so future integration can replace mock values without refactoring layout.

## Component index

- `ReviewWorkspace.tsx`: page-level composition in the required vertical order
- `ReviewHeader.tsx`: title + quick context header
- `CaseSummaryCard.tsx`: shows case metadata
- `AttorneyNoteCard.tsx`: shows attorney note exactly as written
- `EmployeeReasoningCard.tsx`: shows employee thinking (business reasoning, not chain-of-thought)
- `DraftPreviewCard.tsx`: document-style preview (readable typography)
- `FeedbackCard.tsx`: placeholder-only feedback textarea
- `ActionBar.tsx`: action buttons (visual only)
- `ApprovalStatusCard.tsx`: small governance status card

