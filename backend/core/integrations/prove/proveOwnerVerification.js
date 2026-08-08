/**
 * Owner-facing prove verification — evidence + steps that only reference surfaces they can open.
 * Plan 28 shell hides People; never send owners to a missing nav item.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { proveGuidanceForAction } from "./proveOwnerGuidance.js";

/**
 * @typedef {{ id: string, label: string, hrefSuffix: string, visible: boolean }} OwnerVerifySurface
 * @typedef {{ text: string, href?: string | null }} OwnerVerifyStep
 */

/**
 * Resolve which verify surfaces exist in the owner shell for this business.
 * `peopleVisible` defaults false (canonical BusinessShell has no People item).
 */
export function resolveOwnerVerifySurfaces({
  businessId,
  peopleVisible = false,
  workVisible = true,
  decisionsVisible = true,
} = {}) {
  const id = String(businessId ?? "").trim();
  const base = id ? `/b/${encodeURIComponent(id)}` : "";
  return deepFreeze({
    decisions: {
      id: "decisions",
      label: "Decisions",
      hrefSuffix: "/intelligence",
      href: base ? `${base}/intelligence` : null,
      visible: decisionsVisible !== false,
    },
    people: {
      id: "people",
      label: "People",
      hrefSuffix: "/people",
      href: base ? `${base}/people` : null,
      visible: peopleVisible === true,
    },
    work: {
      id: "work",
      label: "Work",
      hrefSuffix: "/work",
      href: base ? `${base}/work` : null,
      visible: workVisible !== false,
    },
  });
}

function draftFromResult(result = {}) {
  return result?.followUpDraft
    ?? result?.detail?.followUpDraft
    ?? null;
}

/**
 * Pull human evidence from a live prove result (shown in the modal — no hunting).
 */
export function extractProveEvidence(action, result = {}) {
  const act = String(action ?? "");
  const draft = draftFromResult(result);
  const evidence = [];

  if (act === "submit_test_form" || act === "ingest_test_lead" || act === "submit_test_chat") {
    const contactLabel = act === "ingest_test_lead"
      ? "Test Facebook lead"
      : act === "submit_test_chat"
        ? "Prove chat contact"
        : "Prove Form Lead";
    evidence.push({
      label: "Saved contact",
      value: String(result?.contactId ? contactLabel : (result?.detail?.note ? contactLabel : contactLabel)),
    });
    if (result?.contactId) {
      evidence.push({ label: "Contact id", value: String(result.contactId) });
    }
  }

  if (draft?.subject) {
    evidence.push({
      label: "Follow-up draft",
      value: String(draft.subject),
    });
  } else if (result?.detail?.pendingApproval === true) {
    evidence.push({
      label: "Follow-up draft",
      value: "Pending in Decisions",
    });
  }

  if (result?.detail?.externalReference || result?.detail?.formSubmissionId) {
    evidence.push({
      label: "Proof id",
      value: String(result.detail.externalReference ?? result.detail.formSubmissionId),
    });
  }

  if (result?.detail?.providerId || result?.providerId) {
    evidence.push({
      label: "CRM record",
      value: String(result.detail?.providerId ?? result.providerId),
    });
  }

  if (result?.message && evidence.length === 0) {
    evidence.push({ label: "Result", value: String(result.message) });
  }

  return deepFreeze(evidence);
}

/**
 * Build honest next steps + optional primary CTA.
 * Prefer in-modal evidence; only link to surfaces that are visible.
 */
export function buildProveOwnerVerification({
  action,
  businessId,
  result = {},
  ok = false,
  peopleVisible = false,
} = {}) {
  const guidance = proveGuidanceForAction(action);
  const surfaces = resolveOwnerVerifySurfaces({ businessId, peopleVisible });
  const evidence = ok ? extractProveEvidence(action, result) : [];
  const draft = draftFromResult(result);
  /** @type {OwnerVerifyStep[]} */
  const steps = [];
  let primaryCta = null;

  if (!ok) {
    const message = String(result?.message ?? "Prove failed.");
    return deepFreeze({
      title: "Test didn’t finish",
      evidence: [{ label: "Error", value: message }],
      steps: [
        { text: message },
        { text: "Fix the issue, then tap Test it works again." },
      ],
      primaryCta: null,
      banner: message,
    });
  }

  // Draft → Decisions is the honest beachhead verify path (People is not in shell nav).
  if (draft || result?.detail?.pendingApproval === true) {
    if (surfaces.decisions.visible && surfaces.decisions.href) {
      const subject = draft?.subject ? `“${draft.subject}”` : "the follow-up draft";
      steps.push({
        text: `Open Decisions — approve or dismiss ${subject}.`,
        href: surfaces.decisions.href,
      });
      primaryCta = {
        label: "Open Decisions",
        href: surfaces.decisions.href,
      };
    } else {
      steps.push({ text: "A follow-up draft is waiting for your approval." });
    }
  }

  if (surfaces.people.visible && surfaces.people.href && (result?.contactId || action === "submit_test_form")) {
    steps.push({
      text: "Open People — look for the prove contact.",
      href: surfaces.people.href,
    });
  } else if (result?.contactId || action === "submit_test_form" || action === "ingest_test_lead") {
    steps.push({
      text: "The prove contact is listed under Proof above — your shell doesn’t show a People page.",
    });
  }

  // Fall back to static guidance steps that aren’t surface-specific lies
  if (!steps.length) {
    for (const raw of guidance.successSteps ?? []) {
      const text = String(raw);
      if (/open people/i.test(text) && !surfaces.people.visible) continue;
      if (/open decisions/i.test(text) && surfaces.decisions.href) {
        steps.push({ text, href: surfaces.decisions.href });
        if (!primaryCta) {
          primaryCta = { label: "Open Decisions", href: surfaces.decisions.href };
        }
        continue;
      }
      steps.push({ text });
    }
  }

  if (!steps.length) {
    steps.push({ text: "This channel is tested. Refresh Connections if the status looks stale." });
  }

  const bannerParts = [
    guidance.successTitle,
    ...evidence.map((e) => `${e.label}: ${e.value}`),
    ...steps.map((s) => s.text),
  ];

  return deepFreeze({
    title: guidance.successTitle,
    evidence,
    steps,
    primaryCta,
    banner: bannerParts.filter(Boolean).join(" — "),
  });
}
