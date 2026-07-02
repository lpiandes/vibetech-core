# Mission Control Rendering Framework

## Purpose
Render the canonical `MissionControlViewModel` from the backend into consistent frontend presentation.

This sprint builds:
- a deterministic rendering layer (no business logic)
- a reusable renderer component tree
- minimal styling for an executive-command-center experience

## Responsibilities
- `MissionControlRenderer`
  - top-level orchestration for rendering a `MissionControlViewModel`
- `MissionControlHero`
  - renders the hero header (headline/subtitle/status/primary/secondary actions)
- `MissionControlSectionRenderer`
  - renders each section dynamically from `viewModel.sections`
- `MissionControlCardRenderer`
  - renders each card dynamically from section `cards`
- `MissionControlActionRenderer`
  - renders each business action deterministically from `MissionControlActionView`
- `MissionControlAlertRenderer`
  - renders each alert from `viewModel.alerts`
- `MissionControlLayout`
  - owns only layout decisions (single/compact), driven by view model fields

## Relationship to the backend
- The backend produces `MissionControlViewModel` via `MissionControlViewAdapter`
- React renders only the view model fields
- React does not recompute intelligence

