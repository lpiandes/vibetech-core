# Capabilities Rendering Framework

## Purpose
Render an immutable `CapabilityViewModel` into the executive-facing Capabilities page.

## Rules
- React is presentation only.
- No runtime access.
- No intelligence recomputation.
- All business context comes from `viewModel` via `CapabilityContext`.

## Components
- `CapabilityRenderer`: page shell that wires the context.
- `CapabilityLayout`: deterministic composition of summary, categories, providers, gaps, risks, and recommendations.
- `CapabilityLoading`: loading placeholders.
- `CapabilityErrorBoundary`: render failure fallback.

