# PRD-004 — Digital Workforce

## Purpose
Help users feel like they are managing a team of highly capable Digital Employees by providing a single emotional center for workforce health: how the workforce is doing, what needs attention, and what you can do next.

This page exists to answer one question immediately: **“How is my Digital Workforce doing?”**

## User Question
**How is my Digital Workforce doing?**

The page should let users understand, at a glance and in calm depth, what is in progress, what is waiting for review, and which employees need guidance today.

## Desired User Feeling
- Confidence (I know what matters now)
- Trust (the work is explained clearly)
- Calm (information is governed and readable)
- Control (I can see what needs my decision)
- Visibility (I understand throughput and review demand)
- Pride (the workforce is producing real outcomes)

## Success Criteria
- Users can find their “next moment of attention” within 30 seconds.
- Each employee card communicates: who they are, what they accomplished today, and whether you need to review anything.
- The page clearly separates:
  - workforce status (what is happening),
  - governance needs (what requires you),
  - outcomes (what value was created).
- Empty states are understandable and reassuring (not broken or confusing).

## Information Hierarchy (Top to Bottom)
1. Page header
   - “Digital Workforce”
   - Subheading: “How is my Digital Workforce doing?”
2. Workforce summary strip (one short block)
   - Workforce state label (e.g., “Employees Working”, “Needs Review”, or “No work today”)
   - One-line progress statement (e.g., “Today’s completed tasks: 23”)
   - Primary timing estimate for review demand (e.g., “Estimated review time: 6 minutes”)
3. Employee list (stacked cards; one card per Digital Employee)
   - Card content is organized for quick scanning and one-card comprehension
4. Secondary actions (small, supportive links/buttons)
   - “View Work Queue”
   - “Employee Profile” (for coverage context)
5. Empty states
   - Shown in the employee list area when applicable

## Primary CTA
**Review Work**

The primary CTA is placed where it reduces cognitive effort: it should feel like the next managerial action, not a navigation shortcut.

## Secondary Actions
- View Work Queue (see specific items waiting for your review)
- Employee Profile (go deeper on an individual Digital Employee’s capabilities, training focus, and past performance)

## Employee Card Anatomy
Each employee card is a “handoff card” that answers:
1) Who are they?
2) What are they doing?
3) How well are they doing?
4) Do they need me?

### Required Sections (in order)
1. Employee identity
   - Employee name
   - Role / specialty (short)
2. Current status
   - A calm status label (e.g., Working, Needs Review, Paused)
   - Optional short status qualifier (e.g., “Preparing updates”)
3. Today’s accomplishments
   - “Today completed:” number
   - A short accomplishment line (1 sentence)
4. Approval rate (work quality signal)
   - “Approval rate:” percent
   - Footnote text clarifying the measure (e.g., “Based on your reviewed items from the past week”)
5. Current workload (what they are busy with)
   - “In progress:” number
   - “Waiting on you:” number (supports the “Do they need me?” question)
6. Primary action area (manager decision point)
   - If waiting items exist: **Review Work**
   - If nothing is waiting: **View Work Queue** (or “See updates” depending on the empty-state context)
7. Supporting governance note (supporting information, never the headline)
   - A small line that explains why review is needed (e.g., “These items require your governance before moving forward.”)

## Workforce Summary (Above the Employee List)
This block must always render, even during empty states.

### Summary options (examples)
- **Employees Working**
  - “Today’s completed tasks: 23”
  - “Waiting on your review: 3”
  - “Estimated review time: 6 minutes”
- **Needs Review**
  - “3 items require your review”
  - “Estimated review time: 4 minutes”
  - A short reminder: “Review when everything is aligned.”
- **Offline / Paused**
  - “Your Digital Employees are paused today.”
  - “You can review previously completed work or check back later.”
- **No work today**
  - “Nothing is waiting for your review right now.”
  - “Work will appear here as soon as it is ready.”

## Empty States
The employee list area should never feel empty in a scary way. Use clear, reassuring messaging.

1. Brand new customer
   - Headline: “Welcome to your Digital Workforce”
   - Explanation: “Your employees will populate this list as work becomes ready for governance.”
   - Primary CTA: “Review Work” (may point to an empty queue state)
2. No employees
   - Headline: “No Digital Employees are currently assigned”
   - Explanation: “Your workforce needs coverage. Add employees to start managed work.”
   - Primary CTA: “Employee Profile” (to orient next step)
3. Employees paused
   - Headline: “Your Digital Employees are paused today”
   - Explanation: “Work will resume when paused items are cleared.”
   - Secondary CTA: “View Work Queue”
4. No work today
   - Headline: “Nothing is waiting for your review”
   - Explanation: “Check back later for completed employee work.”
   - Secondary CTA: “Employee Profile”

## Mobile Behavior (High-Level Only)
- Show only high-level summary first (workforce state + review demand).
- Employee cards collapse into a compact layout:
  - Name + status + “Waiting on you” number
  - Today completed count
  - A single action CTA
- Secondary actions appear after the first fold.
- Empty states remain in the same card area, with short copy optimized for scanning.

## Out of Scope
Explicitly not included on this page:
- Settings
- Authentication
- Permissions
- Billing
- Developer tools
- Analytics dashboards
- Prompt editing or prompt authoring
- Model selection

