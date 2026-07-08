import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function computeApprovalMetrics({ requests } = {}) {
  const rs = Array.isArray(requests) ? requests : [];
  const totalRequests = rs.length;
  const pendingRequests = rs.filter((r) => String(r.status) === "PENDING").length;
  const grantedRequests = rs.filter((r) => String(r.status) === "GRANTED").length;
  const rejectedRequests = rs.filter((r) => String(r.status) === "REJECTED").length;
  const cancelledRequests = rs.filter((r) => String(r.status) === "CANCELLED").length;

  return deepFreeze({
    totalRequests,
    pendingRequests,
    grantedRequests,
    rejectedRequests,
    cancelledRequests,
  });
}
