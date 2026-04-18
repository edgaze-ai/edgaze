"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";
import type { TemplateDefinition } from "@/lib/templates";
import { isTemplateFieldVisible } from "@/lib/templates/validateTemplate";

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: TemplateDefinition["setup"]["fields"][number];
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const baseClassName =
    "w-full rounded-[14px] border border-white/[0.08] bg-[#0c0c0c] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/26 focus:border-white/[0.14]";

  switch (field.type) {
    case "list": {
      const items = Array.isArray(value) ? value.map((item) => String(item)) : [""];
      const normalizedItems = items.length ? items : [""];
      return (
        <div className="space-y-2">
          {normalizedItems.map((item, index) => (
            <div key={`${field.id}-${index}`} className="flex items-center gap-2">
              <input
                type="text"
                value={item}
                placeholder={field.placeholder ?? `Option ${index + 1}`}
                onChange={(event) => {
                  const next = [...normalizedItems];
                  next[index] = event.target.value;
                  onChange(next);
                }}
                className={baseClassName}
              />
              {normalizedItems.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange(normalizedItems.filter((_, itemIndex) => itemIndex !== index))
                  }
                  className="shrink-0 rounded-[12px] border border-white/10 bg-[#101010] px-3 py-3 text-xs text-white/70 transition-colors hover:bg-[#151515]"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange([...normalizedItems, ""])}
            className="rounded-[12px] border border-white/10 bg-[#101010] px-3 py-2 text-xs font-medium text-white/72 transition-colors hover:bg-[#151515]"
          >
            Add option
          </button>
        </div>
      );
    }
    case "textarea":
      return (
        <textarea
          rows={4}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${baseClassName} min-h-28 resize-y`}
        />
      );
    case "number":
      return (
        <input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : Number(event.target.value))
          }
          className={baseClassName}
        />
      );
    case "select":
      return (
        <select
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className={baseClassName}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value} className="bg-[#0c0c0c]">
              {option.label}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className="grid gap-2 sm:grid-cols-3">
          {field.options?.map((option) => {
            const active = String(value ?? "") === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={[
                  "rounded-[14px] border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-white/[0.14] bg-white/[0.08] text-white"
                    : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.06]",
                ].join(" ")}
              >
                <div className="text-sm font-semibold">{option.label}</div>
                {option.hint ? (
                  <div className="mt-1 text-xs text-white/45">{option.hint}</div>
                ) : null}
              </button>
            );
          })}
        </div>
      );
    case "switch":
      return (
        <button
          type="button"
          onClick={() => onChange(!Boolean(value))}
          className={[
            "inline-flex w-full items-center justify-between rounded-[14px] border px-4 py-3 text-sm transition-colors",
            Boolean(value)
              ? "border-white/[0.14] bg-white/[0.08] text-white"
              : "border-white/[0.08] bg-white/[0.03] text-white/70",
          ].join(" ")}
        >
          <span>{Boolean(value) ? "Enabled" : "Disabled"}</span>
          <span className="text-xs uppercase tracking-[0.18em] text-white/45">{field.label}</span>
        </button>
      );
    default:
      return (
        <input
          type="text"
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={baseClassName}
        />
      );
  }
}

export default function TemplateSetupModal({
  open,
  template,
  submitting = false,
  errorText = null,
  onClose,
  onSubmit,
}: {
  open: boolean;
  template: TemplateDefinition | null;
  submitting?: boolean;
  errorText?: string | null;
  onClose: () => void;
  onSubmit: (answers: Record<string, unknown>) => void;
}) {
  if (!open || !template) return null;

  return (
    <TemplateSetupModalInner
      key={`${template.id}-${template.version}`}
      template={template}
      submitting={submitting}
      errorText={errorText}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function TemplateSetupModalInner({
  template,
  submitting = false,
  errorText = null,
  onClose,
  onSubmit,
}: {
  template: TemplateDefinition;
  submitting?: boolean;
  errorText?: string | null;
  onClose: () => void;
  onSubmit: (answers: Record<string, unknown>) => void;
}) {
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        (template?.setup.fields ?? []).map((field) => [field.id, field.defaultValue ?? ""]),
      ),
    [template],
  );
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const visibleFields = template.setup.fields.filter(
    (field) => (showAdvanced || !field.ui?.advanced) && isTemplateFieldVisible(field, values),
  );
  const groupedFields = visibleFields.reduce<Record<string, typeof visibleFields>>((acc, field) => {
    const key = field.ui?.section ?? "Setup";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(field);
    return acc;
  }, {});
  const sections = Object.entries(groupedFields);
  const clampedStep = Math.min(currentStep, Math.max(sections.length - 1, 0));
  const activeEntry = sections[clampedStep] ?? null;
  const isGuidedFlow = template.setup.mode === "guided" && sections.length > 1;
  const isLastStep = clampedStep === sections.length - 1;

  return (
    <div className="fixed inset-y-0 right-0 left-0 z-[120] flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-md md:left-[52px]">
      <div className="relative h-auto max-h-[calc(100vh-24px)] w-[min(720px,calc(100vw-24px))] overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,10,10,0.995),rgba(6,6,6,1))] shadow-[0_36px_120px_rgba(0,0,0,0.72)] sm:max-h-[calc(100vh-40px)] sm:w-[min(760px,calc(100vw-40px))] sm:rounded-[22px]">
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top_left,rgba(65,212,255,0.07),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,84,160,0.05),transparent_22%)]" />
        <div className="relative flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/34">
              Guided setup
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
              {template.meta.name}
            </h2>
            {isGuidedFlow && activeEntry ? (
              <div className="mt-3 flex items-center gap-2">
                {sections.map(([section], index) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className={[
                      "h-2.5 rounded-full transition-all",
                      index === clampedStep
                        ? "w-7 bg-[#d8d8d4]"
                        : "w-2.5 bg-white/16 hover:bg-white/24",
                    ].join(" ")}
                    aria-label={`Go to ${section}`}
                  />
                ))}
                <span className="ml-2 text-xs text-white/42">
                  {clampedStep + 1} / {sections.length}
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-[12px] border border-white/10 bg-[#101010] text-white/70 transition-colors hover:bg-[#151515]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative">
          <div className="max-h-[min(62vh,520px)] overflow-y-auto px-5 py-5 sm:px-7">
            <div className="space-y-6">
              {(isGuidedFlow && activeEntry ? [activeEntry] : sections).map(([section, fields]) => (
                <section
                  key={section}
                  className="rounded-[16px] border border-white/10 bg-[#0d0d0d] p-4 sm:p-5"
                >
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                    {section}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {fields.map((field) => (
                      <div
                        key={field.id}
                        className={field.ui?.width === "full" ? "sm:col-span-2" : undefined}
                      >
                        <label className="mb-2 block text-sm font-medium text-white">
                          {field.label}
                        </label>
                        {field.description ? (
                          <p className="mb-2 text-xs leading-5 text-white/42">
                            {field.description}
                          </p>
                        ) : null}
                        <FieldControl
                          field={field}
                          value={values[field.id]}
                          onChange={(nextValue) =>
                            setValues((current) => ({ ...current, [field.id]: nextValue }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {!isGuidedFlow && template.setup.fields.some((field) => field.ui?.advanced) ? (
              <button
                type="button"
                onClick={() => setShowAdvanced((current) => !current)}
                className="mt-6 rounded-[12px] border border-white/10 bg-[#101010] px-4 py-2.5 text-sm font-medium text-white/68 transition-colors hover:bg-[#151515] hover:text-white/82"
              >
                {showAdvanced ? "Hide advanced options" : "Show advanced options"}
              </button>
            ) : null}

            {errorText ? (
              <div className="mt-5 rounded-[14px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {errorText}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-[12px] border border-white/10 bg-[#101010] px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-[#151515]"
            >
              Cancel
            </button>
            {isGuidedFlow && clampedStep > 0 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
                className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-[#101010] px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-[#151515]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : null}
          </div>
          {isGuidedFlow && !isLastStep ? (
            <button
              type="button"
              onClick={() => setCurrentStep((step) => Math.min(sections.length - 1, step + 1))}
              className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-white/12 bg-[#d8d8d4] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#cfcfca]"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => onSubmit(values)}
              className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-white/12 bg-[#d8d8d4] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#cfcfca] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {template.setup.submitLabel ?? "Create workflow"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
