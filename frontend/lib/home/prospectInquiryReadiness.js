export const EMPLOYEE_NOT_READY_MESSAGE =
  "Resident & Prospect Coordinator is not ready. Upload knowledge and connect business email first.";

export function shouldClearProspectReadinessError(error, coordinatorReady) {
  if (!error) return false;
  if (!coordinatorReady) return false;
  return error === EMPLOYEE_NOT_READY_MESSAGE;
}
