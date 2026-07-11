import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { getFieldType } from "./FieldTypeRegistry.js";

/**
 * Universal field validation — required, unique, length, regex, ranges,
 * conditional visibility/required, role-based editing, defaults, read-only.
 */
export function applyDefaults(fields = [], values = {}) {
  const next = { ...values };
  for (const field of fields) {
    if (next[field.key] === undefined && field.defaultValue != null) {
      next[field.key] = field.defaultValue;
    }
  }
  return next;
}

export function isFieldVisible(field, values = {}) {
  const rule = field.conditionalVisibility;
  if (!rule) return true;
  const actual = values[rule.field];
  if (Object.prototype.hasOwnProperty.call(rule, "equals")) {
    return actual === rule.equals;
  }
  if (Array.isArray(rule.in)) {
    return rule.in.includes(actual);
  }
  return true;
}

export function isFieldRequired(field, values = {}) {
  if (field.required) return true;
  const rule = field.conditionalRequired;
  if (!rule) return false;
  const actual = values[rule.field];
  if (Object.prototype.hasOwnProperty.call(rule, "equals")) {
    return actual === rule.equals;
  }
  return false;
}

export function canEditField(field, role = "EMPLOYEE") {
  if (field.readOnly) return false;
  const roles = field.roleEdit ?? [];
  return roles.includes(String(role));
}

export function validateFieldValue(field, value, { values = {}, role = "EMPLOYEE", existingKeys = null } = {}) {
  const errors = [];
  if (!isFieldVisible(field, values)) {
    return deepFreeze({ ok: true, errors: [], skipped: true });
  }

  const empty = value === undefined || value === null || value === "";

  if (!canEditField(field, role) && !empty) {
    errors.push({ code: "role_edit", message: `${field.label} is not editable for role ${role}.` });
  }

  const required = isFieldRequired(field, values);
  if (required && empty) {
    errors.push({ code: "required", message: `${field.label} is required.` });
  }

  if (empty) {
    return deepFreeze({ ok: errors.length === 0, errors });
  }

  const typeMeta = getFieldType(field.fieldType);
  const validation = field.validation ?? {};

  if (typeMeta?.valueType === "number" || field.fieldType === "currency" || field.fieldType === "percent") {
    const num = Number(value);
    if (Number.isNaN(num)) {
      errors.push({ code: "type", message: `${field.label} must be a number.` });
    } else {
      if (validation.min != null && num < validation.min) {
        errors.push({ code: "range", message: `${field.label} must be ≥ ${validation.min}.` });
      }
      if (validation.max != null && num > validation.max) {
        errors.push({ code: "range", message: `${field.label} must be ≤ ${validation.max}.` });
      }
    }
  }

  if (typeof value === "string") {
    if (validation.minLength != null && value.length < validation.minLength) {
      errors.push({ code: "length", message: `${field.label} is too short.` });
    }
    if (validation.maxLength != null && value.length > validation.maxLength) {
      errors.push({ code: "length", message: `${field.label} is too long.` });
    }
    if (validation.regex) {
      try {
        const re = new RegExp(validation.regex);
        if (!re.test(value)) {
          errors.push({ code: "regex", message: `${field.label} format is invalid.` });
        }
      } catch {
        // ignore invalid regex in schema
      }
    }
    if (field.fieldType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push({ code: "email", message: `${field.label} must be a valid email.` });
    }
  }

  if (field.allowedValues && !Array.isArray(value) && !field.allowedValues.includes(value)) {
    errors.push({ code: "enum", message: `${field.label} must be one of the allowed values.` });
  }

  if (field.unique && existingKeys instanceof Set && existingKeys.has(String(value))) {
    errors.push({ code: "unique", message: `${field.label} must be unique.` });
  }

  return deepFreeze({ ok: errors.length === 0, errors });
}

export function validateRecord({ objectDefinition, values = {}, role = "EMPLOYEE", existingKeysByField = {} } = {}) {
  if (!objectDefinition) {
    return deepFreeze({ ok: false, errors: [{ code: "object", message: "objectDefinition required." }] });
  }
  const withDefaults = applyDefaults(objectDefinition.fields ?? [], values);
  const errors = [];
  for (const field of objectDefinition.fields ?? []) {
    const result = validateFieldValue(field, withDefaults[field.key], {
      values: withDefaults,
      role,
      existingKeys: existingKeysByField[field.key] ?? null,
    });
    for (const error of result.errors) {
      errors.push({ field: field.key, ...error });
    }
  }
  return deepFreeze({
    ok: errors.length === 0,
    values: withDefaults,
    errors,
    tenantScoped: true,
  });
}
