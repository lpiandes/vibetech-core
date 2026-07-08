function findSchemaForImport(qualificationFieldSchemas = []) {
  return (
    qualificationFieldSchemas.find((s) => String(s.requestType) === "PROSPECT_INQUIRY") ??
    qualificationFieldSchemas[0] ??
    null
  );
}

function normalizeEnumValue(value, field) {
  const raw = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const allowed = field.allowedValues ?? [];
  const match = allowed.find((v) => String(v).toLowerCase() === raw);
  return match ?? null;
}

export function validateQualificationImportFields(values = {}, qualificationFieldSchemas = []) {
  const schema = findSchemaForImport(qualificationFieldSchemas);
  const warnings = [];
  const validated = {};

  if (!schema?.fields?.length) {
    return { validated: {}, warnings, skipped: Object.keys(values) };
  }

  const fieldByKey = Object.fromEntries(schema.fields.map((f) => [String(f.key), f]));

  for (const [key, rawValue] of Object.entries(values)) {
    const field = fieldByKey[key];
    if (!field) {
      warnings.push({ code: "unknown_qualification_field", message: `Unknown qualification field: ${key}`, field: key });
      continue;
    }

    if (field.deprecatedAliasFor && fieldByKey[field.deprecatedAliasFor]) {
      const target = field.deprecatedAliasFor;
      if (validated[target] === undefined) {
        const aliasResult = validateSingleField(rawValue, fieldByKey[target]);
        if (aliasResult.value !== undefined) validated[target] = aliasResult.value;
        warnings.push(...aliasResult.warnings);
      }
      continue;
    }

    const result = validateSingleField(rawValue, field);
    if (result.value !== undefined) validated[field.key] = result.value;
    warnings.push(...result.warnings);
  }

  return { validated, warnings };
}

function validateSingleField(rawValue, field) {
  const warnings = [];
  const valueType = String(field.valueType ?? "string");

  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === "") {
    return { warnings, value: undefined };
  }

  if (valueType === "enum") {
    const normalized = normalizeEnumValue(rawValue, field);
    if (!normalized) {
      warnings.push({
        code: "unknown_enum_value",
        message: `Value not in allowed set for ${field.key}.`,
        field: field.key,
        value: rawValue,
      });
      return { warnings, value: undefined };
    }
    return { warnings, value: normalized };
  }

  if (valueType === "number") {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) {
      warnings.push({ code: "invalid_number", message: `Invalid number for ${field.key}.`, field: field.key });
      return { warnings, value: undefined };
    }
    return { warnings, value: num };
  }

  if (valueType === "boolean") {
    const v = String(rawValue).trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(v)) return { warnings, value: true };
    if (["false", "no", "n", "0"].includes(v)) return { warnings, value: false };
    warnings.push({ code: "invalid_boolean", message: `Invalid boolean for ${field.key}.`, field: field.key });
    return { warnings, value: undefined };
  }

  return { warnings, value: String(rawValue).trim() };
}
