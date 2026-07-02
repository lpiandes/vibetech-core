# Mission Control View Adapter

## Purpose
Translate the canonical `MissionControl` business object into a presentation-ready, immutable `MissionControlViewModel` for the frontend.

This adapter:
- does NOT recompute intelligence
- does NOT regenerate intelligence
- does NOT access runtime state

## Responsibilities
1. Build deterministic hero view model
2. Translate Mission Control sections into section view models
3. Translate Mission Control cards into card view models
4. Translate Mission Control actions into action view models (deterministic styling)
5. Validate the final view model structure and invariants

## Relationship to MissionControl
- Input: `MissionControl`
- Output: `MissionControlViewModel`

Mission Control generator composes intelligence.
This adapter only maps/composes presentation models.

## Relationship to React Renderer
React is expected to render using this view model.
This sprint does not include any React implementation.

## Future Integration
Future Mission Control pages/components can consume the adapter output directly (no business logic in React).

