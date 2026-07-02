import { deepFreeze } from "./_utils/deepFreeze.js";

export function buildWorkspaceQueue({ runtime, queueId } = {}) {
  if (!queueId || typeof queueId !== "string") throw new Error("buildWorkspaceQueue: queueId required.");
  if (queueId === "work_queue") {
    const items = runtime?.getWorkQueue?.() ?? [];
    return deepFreeze({
      id: "work_queue",
      title: "Work Queue",
      items: Array.isArray(items) ? items : [],
    });
  }

  return deepFreeze({
    id: String(queueId),
    title: String(queueId),
    items: [],
  });
}

