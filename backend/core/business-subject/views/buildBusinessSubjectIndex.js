import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function buildBusinessSubjectIndex({ businessSubjectRuntime, subjectTypes } = {}) {
  const allowedTypes = subjectTypes ? new Set(subjectTypes.map(String)) : null;
  const subjects = safeArray(businessSubjectRuntime?.getSubjects?.())
    .filter((s) => !allowedTypes || allowedTypes.has(String(s.subjectType)))
    .map((s) =>
      deepFreeze({
        id: String(s.id),
        subjectType: String(s.subjectType),
        displayName: String(s.displayName),
        status: String(s.status),
        address: s.keyAttributes?.address ? String(s.keyAttributes.address) : null,
        keyAttributes: deepFreeze({ ...(s.keyAttributes ?? {}) }),
        createdAt: s.createdAt ? String(s.createdAt) : null,
        updatedAt: s.updatedAt ? String(s.updatedAt) : null,
      }),
    );

  return deepFreeze({
    subjects,
    totalCount: subjects.length,
    activeCount: subjects.filter((s) => s.status === "active").length,
  });
}
