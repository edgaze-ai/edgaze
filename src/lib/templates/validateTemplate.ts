import type { TemplateDefinition, TemplateSetupField } from "./types";

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function getTemplateFieldDefaults(fields: TemplateSetupField[]) {
  return Object.fromEntries(fields.map((field) => [field.id, field.defaultValue]));
}

export function isTemplateFieldVisible(
  field: TemplateSetupField,
  answers: Record<string, unknown>,
): boolean {
  const visibleWhen = field.ui?.visibleWhen;
  if (!visibleWhen) return true;
  const currentValue = answers[visibleWhen.fieldId];
  if (visibleWhen.equals !== undefined) {
    return currentValue === visibleWhen.equals;
  }
  if (visibleWhen.gte !== undefined) {
    return Number(currentValue) >= visibleWhen.gte;
  }
  if (visibleWhen.lte !== undefined) {
    return Number(currentValue) <= visibleWhen.lte;
  }
  return true;
}

export function validateTemplateDefinition(template: TemplateDefinition): string[] {
  const errors: string[] = [];
  if (!isNonEmptyString(template.id)) errors.push("Template id is required.");
  if (!isNonEmptyString(template.slug)) errors.push("Template slug is required.");
  if (!isNonEmptyString(template.meta?.name)) errors.push("Template name is required.");
  if (!Array.isArray(template.blueprint?.nodes)) errors.push("Blueprint nodes must be an array.");
  if (!Array.isArray(template.blueprint?.edges)) errors.push("Blueprint edges must be an array.");

  const fieldIds = new Set<string>();
  for (const field of template.setup.fields) {
    if (!isNonEmptyString(field.id))
      errors.push(`Template ${template.id} has a field without an id.`);
    if (fieldIds.has(field.id))
      errors.push(`Template ${template.id} has duplicate field ${field.id}.`);
    fieldIds.add(field.id);
  }

  return errors;
}

export function validateTemplateAnswers(
  template: TemplateDefinition,
  answers: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  for (const field of template.setup.fields) {
    if (!isTemplateFieldVisible(field, answers)) continue;
    const value = answers[field.id];
    if (field.required) {
      if (field.type === "number") {
        if (value == null || value === "") {
          errors.push(field.validation?.message || `${field.label} is required.`);
        }
      } else if (field.type === "list") {
        const items = Array.isArray(value)
          ? value.map((item) => String(item).trim()).filter(Boolean)
          : [];
        if (items.length === 0) {
          errors.push(field.validation?.message || `${field.label} is required.`);
        }
      } else if (typeof value === "string" && value.trim() === "") {
        errors.push(field.validation?.message || `${field.label} is required.`);
      } else if (value == null) {
        errors.push(field.validation?.message || `${field.label} is required.`);
      }
    }

    if (field.type === "number" && value != null && value !== "") {
      const numericValue = Number(value);
      if (Number.isNaN(numericValue)) {
        errors.push(field.validation?.message || `${field.label} must be a number.`);
      }
      if (typeof field.min === "number" && numericValue < field.min) {
        errors.push(field.validation?.message || `${field.label} must be at least ${field.min}.`);
      }
      if (typeof field.max === "number" && numericValue > field.max) {
        errors.push(field.validation?.message || `${field.label} must be at most ${field.max}.`);
      }
    }

    if (
      (field.type === "select" || field.type === "radio") &&
      value != null &&
      field.options?.length
    ) {
      const allowed = new Set(field.options.map((option) => option.value));
      if (!allowed.has(String(value))) {
        errors.push(field.validation?.message || `${field.label} has an invalid selection.`);
      }
    }

    if (field.type === "list" && value != null && !Array.isArray(value)) {
      errors.push(field.validation?.message || `${field.label} must be a list.`);
    }
  }

  for (const validator of template.instantiation.validators) {
    const value = answers[validator.fieldId];
    switch (validator.kind) {
      case "required":
        if (value == null || value === "") errors.push(validator.message);
        break;
      case "min":
        if (Number(value) < Number(validator.value)) errors.push(validator.message);
        break;
      case "max":
        if (Number(value) > Number(validator.value)) errors.push(validator.message);
        break;
      case "enum":
        if (!Array.isArray(validator.value) || !validator.value.includes(String(value))) {
          errors.push(validator.message);
        }
        break;
      default:
        break;
    }
  }

  return errors;
}
