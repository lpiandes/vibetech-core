# Product Workspace

The `product/` directory is the **product documentation layer** for VIBETech.

It is designed to drive all future UI and feature development by providing a single, shared source of truth for:

- Product vision and philosophy
- User-facing terminology and UX principles
- Major milestones and what is (and is not) committed
- PRD placeholders that align Engineering scope with customer outcomes

## How Product, Design, and Engineering work together

### Product
Owns the definition of customer value:

- Who the users are
- What problems we solve
- What success means
- What is in-scope vs out-of-scope

### Design
Translates value into experience:

- UX flows
- Navigation model
- Screen-level clarity
- UI language that stays understandable to business users

### Engineering
Implements deterministically:

- Engineering decisions reference the documentation contracts inside `product/`.
- Engineering logic stays behind stable boundaries (backend/runtime) while the UI remains focused on one question per screen.

This directory is **intentionally not code**.

