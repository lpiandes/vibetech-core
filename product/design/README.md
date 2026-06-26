# Workspace Design System Guide

This directory defines the **permanent visual blueprint** for the VIBETech Workspace.

## What belongs here

- **Layout rules** (sidebar/topbar/page width, grid philosophy)
- **Component blueprints** (cards, badges, previews, search/filter, buttons)
- **Spacing rhythm** (whitespace and padding system)
- **Visual hierarchy** (how users scan and where emphasis belongs)
- **Interaction feel guidelines** (hover/focus/empty/loading/motion)
- **Screen blueprints** (major sections + approximate reading order)

## How engineering should follow this guide

1. Start with the **Workspace layout** and **spacing system**.
2. Apply **visual hierarchy** to typography, badge meaning, and CTA placement.
3. Implement screens by composing the canonical component layouts.
4. Match interaction feel using the **interaction guidelines**.
5. Use **screen blueprints** as the “no-missing-sections checklist”.

## How design docs connect to other product documentation

- **`product/prds/` (PRDs):** describes “what” and “why” for user outcomes.
  - This guide describes the “how it should look” to support those outcomes.
- **`product/vision/` design principles:** defines the permanent UX philosophy.
  - This guide operationalizes those principles into typography/spacing/motion standards.
- **`product/branding/`:** defines the color/typography philosophy.
  - This guide defines how to apply them consistently across screens.
- **`product/ux/TERMINOLOGY.md`:** defines customer-facing vocabulary.
  - This guide ensures screens and component labels align with customer language.

## Change discipline

Because this guide defines the permanent visual language:
- prefer small, additive updates when new screens require guidance
- avoid breaking changes that could destabilize future UI work

# VIBETech Workspace Design System Guide

This folder contains the **Workspace Design System Guide**: the permanent visual blueprint for the VIBETech product.

## How these docs work together

- **`WORKSPACE_LAYOUT.md`** defines the global spatial rules (sidebar/topbar/page width, grid philosophy, and responsiveness).
- **`SPACING_SYSTEM.md`** defines the spacing rhythm so every screen feels calm and consistent.
- **`VISUAL_HIERARCHY.md`** defines how users scan information (typography, color meaning, and CTA ordering).
- **`COMPONENT_LAYOUTS.md`** specifies the canonical layout for reusable components (cards, badges, previews, inputs).
- **`INTERACTION_GUIDELINES.md`** defines hover, focus, empty/loading states, and motion principles.
- **`SCREEN_BLUEPRINTS.md`** lists the major sections for each screen and the recommended reading order.

## How engineering and future frontend implementation should follow this guide

1. Start with **Workspace layout** rules (`WORKSPACE_LAYOUT.md`).
2. Apply **spacing rhythm** everywhere (`SPACING_SYSTEM.md`).
3. Implement typography + scanning order using **visual hierarchy** (`VISUAL_HIERARCHY.md`).
4. Build screens by composing **component blueprints** (`COMPONENT_LAYOUTS.md`).
5. Ensure every interaction matches the **interaction guidelines** (`INTERACTION_GUIDELINES.md`).
6. Verify the page structure and reading order using the relevant **screen blueprint** (`SCREEN_BLUEPRINTS.md`).

## Source of truth alignment

This guide is designed to align with:
- `product/vision/DESIGN_PRINCIPLES.md` (premiumness, simplicity, calm governance UX)
- `product/prds/PRD-002-Review-Work.md` (review is governance-safe, not “AI output”)
- `product/ux/TERMINOLOGY.md` (customer-facing language; avoid internal terms)

