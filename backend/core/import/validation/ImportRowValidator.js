export function validateImportRow({ normalizedRow } = {}) {
  const warnings = [];
  const errors = [];

  if (!normalizedRow.displayName && !normalizedRow.email && !normalizedRow.phone && !normalizedRow.externalContactId) {
    errors.push({
      code: "empty_row",
      message: "Row has no identifiable contact information.",
    });
  }

  if (normalizedRow.email === null && normalizedRow.email !== undefined && String(normalizedRow.email ?? "") !== "") {
    warnings.push({ code: "invalid_email", message: "Email could not be normalized." });
  }

  if (normalizedRow.phone && String(normalizedRow.phone).length < 10) {
    warnings.push({ code: "short_phone", message: "Phone number has fewer than 10 digits." });
  }

  return { warnings, errors, ok: errors.length === 0 };
}
