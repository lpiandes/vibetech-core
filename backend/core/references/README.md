# EntityRef (Universal)

Shared `{ entityType, entityId }` contract aligned with `BusinessRelationship` entity references.

- `EntityRef.js` — create/validate refs
- `EntityRefResolver.js` — normalize legacy `relatedObjects` bags, strings, `{type,id}`, `sourceReference`

Write boundaries should emit `EntityRef` or normalized shapes. Read paths accept legacy via `toEntityRef`.
