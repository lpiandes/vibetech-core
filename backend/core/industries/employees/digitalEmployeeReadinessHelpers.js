import { DIGITAL_EMPLOYEE_STATUSES } from "./DigitalEmployeeReadinessEngine.js";

export function getDigitalEmployeeReadinessEntry(employeeReadinessReport, employeeId) {
  const id = String(employeeId ?? "");
  return (employeeReadinessReport?.employees ?? []).find((e) => String(e.employeeId) === id) ?? null;
}

export function isDigitalEmployeeOperationalReady(employee) {
  const status = String(employee?.status ?? "");
  return (
    status === DIGITAL_EMPLOYEE_STATUSES.READY || status === DIGITAL_EMPLOYEE_STATUSES.ACTIVE
  );
}
