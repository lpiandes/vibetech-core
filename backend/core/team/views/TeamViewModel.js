import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`TeamViewModel: ${message}`);
}

export function createTeamViewModel({
  viewId,
  companyId,
  generatedAt,
  summary,
  members,
  departments,
  workload,
  attention,
  recommendations,
  metadata,
} = {}) {
  if (!viewId || typeof viewId !== "string") fail("viewId required.");
  if (!companyId || typeof companyId !== "string") fail("companyId required.");
  if (!generatedAt || typeof generatedAt !== "string") fail("generatedAt required.");
  if (!summary || typeof summary !== "string") fail("summary required.");
  if (!Array.isArray(members)) fail("members required.");
  if (!Array.isArray(departments)) fail("departments required.");
  if (!workload || typeof workload !== "object") fail("workload required.");
  if (!attention || typeof attention !== "object") fail("attention required.");
  if (!Array.isArray(recommendations)) fail("recommendations required.");

  const vm = {
    viewId,
    companyId,
    generatedAt,
    summary,
    members: deepFreeze(members),
    departments: deepFreeze(departments),
    workload: deepFreeze(workload),
    attention: deepFreeze(attention),
    recommendations: deepFreeze(recommendations),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(vm);
}

