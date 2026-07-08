import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function createSegmentDefinition({
  id,
  workspaceId,
  name,
  targetEntityType = "Party",
  criteria = [],
  status = "active",
  metadata = {},
} = {}) {
  if (!id || !name || !workspaceId) throw new Error("SegmentDefinition: id, name, workspaceId required.");
  return deepFreeze({
    id: String(id),
    workspaceId: String(workspaceId),
    name: String(name),
    targetEntityType: String(targetEntityType),
    criteria: deepFreeze(Array.isArray(criteria) ? criteria.map((c) => deepFreeze({ ...c })) : []),
    status: String(status),
    metadata: deepFreeze(metadata && typeof metadata === "object" ? metadata : {}),
  });
}

export const SEGMENT_EVENT_TYPES = {
  SEGMENT_REGISTERED: "SEGMENT_REGISTERED",
  SEGMENT_ARCHIVED: "SEGMENT_ARCHIVED",
};
