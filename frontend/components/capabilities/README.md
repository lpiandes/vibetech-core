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
- `CapabilitiesExecutiveLayout`: deterministic executive cockpit that answers:
  "Can this business execute its strategy?"
- `CapabilityLoading`: loading placeholders.
- `CapabilityErrorBoundary`: render failure fallback.

