"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  buildDiscoverySteps,
  type DiscoveryAnswerRow,
  type DiscoveryQuestionRow,
} from "./discoverySteps";
import { isUsableBusinessName } from "@/lib/operating/businessLanguage";
import { architect } from "./architectTheme";
import { ArchitectButton, ThinkingDots } from "./ArchitectPrimitives";
import { detectUploadHint } from "./architectSemantics";

type Props = {
  answers?: DiscoveryAnswerRow[];
  nextQuestion?: DiscoveryQuestionRow | null;
  busy?: boolean;
  thinking?: boolean;
  /** Overrides the default "Saving your answer" dots label. */
  thinkingLabel?: string;
  websiteUrl: string;
  setWebsiteUrl: (value: string) => void;
  onResearch: () => void;
  researchBusy?: boolean;
  uploads?: Array<{ filename?: string; classification?: string }>;
  onUploadFiles?: (files: FileList | null) => void;
  dragOver?: boolean;
  setDragOver?: (value: boolean) => void;
  onAnswer: (input: { questionId: string; answer: string }) => Promise<void> | void;
  /** Called when the last question is finished or discovery is complete. */
  onFinish?: () => void;
  /** Admin package-add Ask — primary action is Save, finish returns Home. */
  packageAsk?: boolean;
};

const INDUSTRY_LABELS: Record<string, string> = {
  property_management: "Property management",
  dental: "Dental",
  sports: "Sports / clubs",
  professional_services: "Professional services",
  political_campaigns: "Political campaigns",
  home_services: "Home services",
  retail: "Retail",
  restaurant_hospitality: "Restaurant / hospitality",
  healthcare: "Healthcare",
  education: "Education",
  nonprofit: "Nonprofit",
  construction: "Construction",
  manufacturing: "Manufacturing",
  ecommerce: "E‑commerce",
  real_estate_brokerage: "Real estate brokerage",
  marketing_agency: "Marketing agency",
  other: "Other",
};

const INTEGRATION_LABELS: Record<string, string> = {
  gmail: "Gmail",
  google_calendar: "Google Calendar",
  twilio_sms: "Text messaging (Twilio)",
  twilio_voice: "Voice calling (Twilio)",
  google_ads: "Google Ads",
  google_search_console: "Google Search Console / SEO",
  meta_platform: "Meta (Facebook & Instagram ads + lead forms)",
  none_yet: "None yet",
};

/** Split main prompt from Examples / bullet list for readable discovery layout. */
function splitDiscoveryPrompt(prompt: string): { main: string; examples: string[] } {
  const raw = String(prompt ?? "").trim();
  if (!raw) return { main: "", examples: [] };

  const examplesMatch = raw.match(/\n*\s*Examples?\s*:\s*/i);
  if (examplesMatch && examplesMatch.index != null) {
    const main = raw.slice(0, examplesMatch.index).trim();
    const rest = raw.slice(examplesMatch.index + examplesMatch[0].length).trim();
    const examples = rest
      .split(/\n+|(?=\s*[•\-\*]\s)/)
      .map((line) => line.replace(/^\s*[•\-\*]\s*/, "").trim())
      .filter(Boolean);
    if (examples.length) return { main, examples };
  }

  // Flattened LLM rewrite: "... want. Examples: • A • B"
  const flat = raw.match(/^(.*?)\s+Examples?\s*:\s*(.+)$/is);
  if (flat) {
    const examples = flat[2]
      .split(/\s*[•\-\*]\s+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (examples.length >= 2) {
      return { main: flat[1].trim(), examples };
    }
  }

  return { main: raw, examples: [] };
}

function DiscoveryQuestionPrompt({ prompt }: { prompt: string }) {
  const { main, examples } = splitDiscoveryPrompt(prompt);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{
        margin: 0,
        fontFamily: architect.display,
        fontSize: "clamp(1.35rem, 2.6vw, 1.75rem)",
        lineHeight: 1.3,
        letterSpacing: "-0.02em",
        whiteSpace: "pre-wrap",
      }}
      >
        {main}
      </h2>
      {examples.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{
            fontFamily: architect.font,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: architect.inkMuted,
          }}
          >
            Examples
          </div>
          <ul style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 6,
          }}
          >
            {examples.map((example) => (
              <li
                key={example}
                style={{
                  fontFamily: architect.font,
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: architect.inkMuted,
                  paddingLeft: 14,
                  position: "relative",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    color: architect.accent,
                  }}
                >
                  •
                </span>
                {example}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One question + one answer at a time. Next requires text. Back edits a previous answer.
 */
export default function DiscoveryStepWizard({
  answers = [],
  nextQuestion = null,
  busy,
  thinking,
  thinkingLabel = "Saving your answer",
  websiteUrl,
  setWebsiteUrl,
  onResearch,
  researchBusy,
  uploads = [],
  onUploadFiles,
  dragOver,
  setDragOver,
  onAnswer,
  onFinish,
  packageAsk = false,
  persistKey = null,
}: Props & { persistKey?: string | null }) {
  const steps = buildDiscoverySteps(answers, nextQuestion);
  const [stepIndex, setStepIndex] = useState(() => Math.max(0, steps.length - 1));
  const [draft, setDraft] = useState("");
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const safeIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const discoveryComplete = !nextQuestion;
  // Never re-render the last answered step as a "new Question 1" — answered
  // rows are rebuilt from the generic bank and lose package-Ask specialization.
  const step = discoveryComplete ? null : (steps[safeIndex] ?? null);
  const draftStorageKey = persistKey && step?.questionId
    ? `vt.builder.draft.${persistKey}.${step.questionId}`
    : null;
  const askingWebsite = step?.questionId === "q_website";
  const askingDocuments = step?.questionId === "q_documents";
  const isChoice = step?.answerType === "choice";
  const isMultiChoice = step?.answerType === "multi_choice";
  const isChoiceOrText = step?.answerType === "choice_or_text";
  const choiceOptions = step?.options ?? [];
  const draftValue = askingWebsite
    ? (websiteUrl || draft)
    : isChoice || isMultiChoice
      ? formatChoiceAnswer(selectedChoices)
      : isChoiceOrText
        ? (draft.trim() || formatChoiceAnswer(selectedChoices))
        : draft;
  const canNext = Boolean(String(draftValue ?? "").trim())
    || (askingDocuments && uploads.length > 0);
  // The interview grows or shrinks as package scope, industry, and answers
  // become known. Avoid promising a fixed total that can change mid-session.
  const questionNumber = Math.max(safeIndex + 1, 1);
  const primaryLabel = discoveryComplete
    ? (packageAsk ? "Save" : "See recommendation")
    : (packageAsk ? "Save" : "Next");

  useEffect(() => {
    setStepIndex(Math.max(0, steps.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the unanswered question changes
  }, [nextQuestion?.questionId]);

  // Restore unsaved draft when returning to the same question (tab close / refresh).
  useEffect(() => {
    if (!draftStorageKey || typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(draftStorageKey);
      if (saved && !step?.answer) setDraft(saved);
    } catch {
      /* ignore */
    }
  }, [draftStorageKey, step?.answer]);

  useEffect(() => {
    if (!draftStorageKey || typeof window === "undefined") return;
    const persist = () => {
      try {
        if (draft.trim()) window.localStorage.setItem(draftStorageKey, draft);
        else window.localStorage.removeItem(draftStorageKey);
      } catch {
        /* ignore */
      }
    };
    persist();
    const onHide = () => persist();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [draft, draftStorageKey]);

  // Package-Ask: once there is nothing left to ask, finish without forcing another Save click
  // on a stale generic bank question.
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const finishOnceRef = useRef(false);
  useEffect(() => {
    if (!packageAsk || !discoveryComplete || busy || thinking) return;
    if (finishOnceRef.current) return;
    finishOnceRef.current = true;
    onFinishRef.current?.();
  }, [packageAsk, discoveryComplete, busy, thinking]);

  useEffect(() => {
    if (!step) {
      setDraft("");
      setSelectedChoices([]);
      return;
    }
    if (step.questionId === "q_website") {
      setWebsiteUrl(step.answer || "");
      setDraft(step.answer || "");
      setSelectedChoices([]);
      return;
    }
    if (step.answerType === "choice" || step.answerType === "multi_choice") {
      setSelectedChoices(parseChoiceAnswer(step.answer));
      setDraft("");
      return;
    }
    if (step.answerType === "choice_or_text") {
      const parsed = parseChoiceAnswer(step.answer);
      const matched = (step.options ?? []).find((option) => parsed.includes(option) || step.answer === option);
      setSelectedChoices(matched ? [matched] : []);
      setDraft(matched ? "" : (step.answer || ""));
      return;
    }
    setDraft(step.answer || "");
    setSelectedChoices([]);
  }, [step?.questionId, step?.answer, step?.answerType, setWebsiteUrl]);

  async function goNext(event?: FormEvent) {
    event?.preventDefault();
    if (!step || busy) return;

    // All questions already answered — move to recommendation.
    if (discoveryComplete) {
      onFinish?.();
      return;
    }

    if (!canNext) return;

    let answer = String(draftValue).trim();
    if (askingDocuments && !answer && uploads.length) {
      answer = `Uploaded ${uploads.length} document${uploads.length === 1 ? "" : "s"}`;
    }
    if (!answer) return;

    if (step.questionId === "q_company_name" && !isUsableBusinessName(answer)) {
      setNameError("Enter the real company name — short replies like “ok” won’t work.");
      return;
    }
    setNameError(null);
    setUrlError(null);

    if (askingWebsite) {
      const trimmed = answer.trim();
      const looksLikeUrl = /\./.test(trimmed) || /^https?:\/\//i.test(trimmed);
      const noSite = /^(i\s*don'?t\s*have|no\s*website|none|n\/a|na)\b/i.test(trimmed);
      if (looksLikeUrl && !noSite) {
        const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        setWebsiteUrl(normalized);
        answer = normalized;
      }
    }

    const editingPast = !step.isCurrent;
    if (editingPast && answer === step.answer) {
      if (safeIndex >= steps.length - 1) {
        onFinish?.();
        return;
      }
      setStepIndex((index) => Math.min(index + 1, steps.length - 1));
      return;
    }

    const shouldResearchWebsite = askingWebsite
      && /\./.test(answer)
      && !/^(i\s*don'?t\s*have|no\s*website|none|n\/a|na)\b/i.test(answer);

    await onAnswer({ questionId: step.questionId, answer });
    if (shouldResearchWebsite) {
      onResearch();
    }
    // Do not clear the draft here. If the server re-asks the same question
    // (e.g. answer marked unknown), wiping the box looks like a blank refresh.
    // The step effect resets draft when nextQuestion advances.
    if (editingPast) {
      if (safeIndex >= steps.length - 1) {
        onFinish?.();
        return;
      }
      setStepIndex((index) => Math.min(index + 1, steps.length - 1));
    }
  }

  function goBack() {
    if (safeIndex <= 0 || busy) return;
    setStepIndex(safeIndex - 1);
  }

  function toggleChoice(option: string) {
    if (isChoiceOrText) {
      setSelectedChoices([option]);
      setDraft("");
      return;
    }
    if (isMultiChoice) {
      setSelectedChoices((current) => {
        if (option === "none_yet") return ["none_yet"];
        const withoutNone = current.filter((entry) => entry !== "none_yet");
        return withoutNone.includes(option)
          ? withoutNone.filter((entry) => entry !== option)
          : [...withoutNone, option];
      });
      return;
    }
    setSelectedChoices([option]);
  }

  if (!step) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ color: architect.inkMuted, lineHeight: 1.55 }}>
          {thinking
            ? <ThinkingDots label="Preparing the next question" />
            : packageAsk
              ? "That’s everything for the new packages."
              : "You’re ready for a recommendation."}
        </div>
        {!thinking && onFinish ? (
          <ArchitectButton type="button" disabled={busy} onClick={() => onFinish()}>
            {packageAsk ? "Save" : "See recommendation"}
          </ArchitectButton>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void goNext(event)} style={{ display: "grid", gap: 20 }}>
      <div style={{ color: architect.inkMuted, fontSize: 13 }}>
        {packageAsk ? `Question ${questionNumber}` : `Question ${questionNumber} · Tailored as we learn`}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <DiscoveryQuestionPrompt prompt={step.prompt} />
        {step.why ? (
          <p style={{ margin: 0, color: architect.inkMuted, fontSize: 14, lineHeight: 1.5 }}>
            {step.why}
          </p>
        ) : null}
      </div>

      {thinking ? <ThinkingDots label={thinkingLabel} /> : null}

      {askingWebsite ? (
        <input
          value={websiteUrl}
          onChange={(event) => {
            setWebsiteUrl(event.target.value);
            setDraft(event.target.value);
            setUrlError(null);
          }}
          placeholder="www.yourcompany.com or https://…"
          style={{ ...inputStyle, minHeight: 48, resize: "none" as const }}
          autoFocus
          disabled={busy || researchBusy}
        />
      ) : askingDocuments ? (
        <div style={{ display: "grid", gap: 10 }}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Describe the documents you use, or upload them below…"
            rows={4}
            style={inputStyle}
            autoFocus
            disabled={busy}
          />
          <div
            onDragOver={(event: DragEvent) => {
              event.preventDefault();
              setDragOver?.(true);
            }}
            onDragLeave={() => setDragOver?.(false)}
            onDrop={(event: DragEvent) => {
              event.preventDefault();
              setDragOver?.(false);
              onUploadFiles?.(event.dataTransfer.files);
            }}
            style={{
              ...softCard,
              borderStyle: "dashed",
              borderColor: dragOver ? architect.accent : architect.border,
              textAlign: "center",
              color: architect.inkMuted,
            }}
          >
            <div style={{ marginBottom: 8 }}>Drop documents here, or choose files</div>
            <input
              type="file"
              multiple
              onChange={(event) => onUploadFiles?.(event.target.files)}
              style={{ color: architect.inkMuted }}
            />
          </div>
          {uploads.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              {uploads.map((upload, index) => {
                const hint = detectUploadHint(String(upload.filename ?? ""), upload.classification);
                return (
                  <div key={`${upload.filename}-${index}`} style={softCard}>
                    <div style={{ fontWeight: 650 }}>{upload.filename}</div>
                    <div style={{ color: architect.inkMuted, fontSize: 12 }}>{hint.label}</div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : isChoiceOrText ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            {choiceOptions.map((option) => {
              const selected = selectedChoices.includes(option) && !draft.trim();
              return (
                <button
                  key={option}
                  type="button"
                  disabled={busy}
                  onClick={() => toggleChoice(option)}
                  style={{
                    ...choiceButtonStyle,
                    borderColor: selected ? architect.accent : architect.border,
                    background: selected ? "rgba(56,189,248,.12)" : "rgba(15,23,42,.45)",
                    color: architect.ink,
                  }}
                >
                  {formatChoiceLabel(step.questionId, option)}
                </button>
              );
            })}
          </div>
          <div style={{ color: architect.inkMuted, fontSize: 13 }}>Or type your industry</div>
          <input
            value={draft}
            onChange={(event) => {
              setSelectedChoices([]);
              setDraft(event.target.value);
            }}
            placeholder="e.g. veterinary clinic, landscaping, church…"
            style={{ ...inputStyle, minHeight: 48, resize: "none" as const }}
            disabled={busy}
          />
        </div>
      ) : isChoice || isMultiChoice ? (
        <div style={{ display: "grid", gap: 10 }}>
          {choiceOptions.map((option) => {
            const selected = selectedChoices.includes(option);
            return (
              <button
                key={option}
                type="button"
                disabled={busy}
                onClick={() => toggleChoice(option)}
                style={{
                  ...choiceButtonStyle,
                  borderColor: selected ? architect.accent : architect.border,
                  background: selected ? "rgba(56,189,248,.12)" : "rgba(15,23,42,.45)",
                  color: architect.ink,
                }}
              >
                {formatChoiceLabel(step.questionId, option, step.optionLabels)}
              </button>
            );
          })}
          {isMultiChoice && !packageAsk ? (
            <p style={{ margin: 0, color: architect.inkMuted, fontSize: 13 }}>
              Select all that apply. You will sign into each account in Integrations after you approve the plan.
            </p>
          ) : null}
        </div>
      ) : (
        <textarea
          value={draft}
          onChange={(event) => {
            setNameError(null);
            setDraft(event.target.value);
          }}
          placeholder={
            step.questionId === "q_desired_workflows"
              ? "e.g. FB lead comes in → email → SMS → update pipeline"
              : step.questionId === "q_industry"
                ? "e.g. youth hockey club, dental practice, landscaping…"
                : "Type your answer…"
          }
          rows={4}
          style={inputStyle}
          autoFocus
          disabled={busy}
        />
      )}

      {nameError ? (
        <p role="alert" style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>
          {nameError}
        </p>
      ) : null}
      {urlError ? (
        <p role="alert" style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>
          {urlError}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ArchitectButton
          type="button"
          variant="secondary"
          disabled={busy || safeIndex <= 0}
          onClick={goBack}
        >
          Back
        </ArchitectButton>
        <ArchitectButton
          type="submit"
          disabled={busy || (!discoveryComplete && !canNext)}
        >
          {primaryLabel}
        </ArchitectButton>
      </div>
    </form>
  );
}

function formatChoiceLabel(
  questionId: string,
  option: string,
  optionLabels?: Record<string, string>,
) {
  if (optionLabels?.[option]) return optionLabels[option];
  if (questionId === "q_industry") {
    return INDUSTRY_LABELS[option] ?? option.replace(/_/g, " ");
  }
  if (questionId === "q_integrations") {
    return INTEGRATION_LABELS[option] ?? option.replace(/_/g, " ");
  }
  return option.replace(/_/g, " ");
}

function formatChoiceAnswer(selected: string[]) {
  return selected.join(", ");
}

function parseChoiceAnswer(answer: string) {
  if (!answer) return [];
  return answer.split(",").map((entry) => entry.trim()).filter(Boolean);
}

const inputStyle = {
  width: "100%",
  borderRadius: architect.radiusSm,
  border: `1px solid ${architect.border}`,
  background: "rgba(2,6,23,.45)",
  color: architect.ink,
  padding: 14,
  fontSize: 15,
  lineHeight: 1.5,
  fontFamily: architect.font,
  resize: "vertical" as const,
};

const softCard = {
  borderRadius: architect.radiusSm,
  border: `1px solid ${architect.border}`,
  background: "rgba(15,23,42,.45)",
  padding: 12,
};

const choiceButtonStyle = {
  width: "100%",
  textAlign: "left" as const,
  borderRadius: architect.radiusSm,
  border: `1px solid ${architect.border}`,
  padding: "14px 16px",
  fontSize: 15,
  lineHeight: 1.45,
  fontFamily: architect.font,
  cursor: "pointer",
};
