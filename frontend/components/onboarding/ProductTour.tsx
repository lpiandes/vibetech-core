"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PRODUCT_TOUR_STEPS, PRODUCT_TOUR_VERSION } from "@/lib/onboarding/productTourSteps";
import { cockpitColors } from "@/design/tokens";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";

function localKey(businessId: string, userKey: string) {
  return `vt.productTour.${PRODUCT_TOUR_VERSION}.${businessId}.${userKey}`;
}

type TourState = {
  stepIndex: number;
  completedAt: string | null;
  updatedAt: string;
};

export default function ProductTour({
  businessId,
  userKey = "me",
  forceOpen = false,
  onFinished,
}: {
  businessId: string;
  userKey?: string;
  forceOpen?: boolean;
  onFinished?: () => void;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const total = PRODUCT_TOUR_STEPS.length;
  const step = PRODUCT_TOUR_STEPS[Math.min(stepIndex, total - 1)];

  const persist = useCallback(async (next: TourState) => {
    try {
      window.localStorage.setItem(localKey(businessId, userKey), JSON.stringify(next));
    } catch {
      /* ignore */
    }
    try {
      await fetch(`/api/businesses/${encodeURIComponent(businessId)}/onboarding/tour`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch {
      /* ignore */
    }
  }, [businessId, userKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let local: TourState | null = null;
      try {
        const raw = window.localStorage.getItem(localKey(businessId, userKey));
        if (raw) local = JSON.parse(raw) as TourState;
      } catch {
        /* ignore */
      }
      let server: TourState | null = null;
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/onboarding/tour`);
        if (res.ok) {
          const data = await res.json();
          if (data?.tour) server = data.tour as TourState;
        }
      } catch {
        /* ignore */
      }
      const pick = (() => {
        if (server && local) {
          return String(server.updatedAt ?? "") >= String(local.updatedAt ?? "") ? server : local;
        }
        return server ?? local;
      })();

      if (cancelled) return;
      if (forceOpen) {
        setStepIndex(0);
        setOpen(true);
        setReady(true);
        return;
      }
      if (pick?.completedAt) {
        setOpen(false);
        setStepIndex(Number(pick.stepIndex) || 0);
      } else {
        setStepIndex(Math.max(0, Number(pick?.stepIndex) || 0));
        setOpen(true);
      }
      setReady(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId, userKey, forceOpen]);

  useEffect(() => {
    if (!open) return;
    const block = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [open]);

  if (!ready || !open || !step) return null;

  async function go(delta: number) {
    const nextIndex = Math.min(total - 1, Math.max(0, stepIndex + delta));
    setStepIndex(nextIndex);
    const nextStep = PRODUCT_TOUR_STEPS[nextIndex];
    if (nextStep?.hrefSuffix) {
      router.push(`/b/${encodeURIComponent(businessId)}${nextStep.hrefSuffix}`);
    }
    await persist({
      stepIndex: nextIndex,
      completedAt: null,
      updatedAt: new Date().toISOString(),
    });
  }

  async function finish() {
    await persist({
      stepIndex: total - 1,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setOpen(false);
    onFinished?.();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vt-tour-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(15, 23, 42, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          background: "#fff",
          borderRadius: 20,
          padding: "28px 26px 22px",
          boxShadow: "0 24px 80px rgba(0,0,0,.35)",
          border: "1px solid rgba(15,23,42,.08)",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: cockpitColors.accent }}>
          Step {stepIndex + 1} of {total}
          {step.navHint ? ` · ${step.navHint}` : ""}
        </div>
        <h2 id="vt-tour-title" style={{ margin: "10px 0 0", fontSize: "1.45rem", fontWeight: 800, letterSpacing: "-0.02em", color: cockpitColors.textPrimary }}>
          {step.title}
        </h2>
        <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.55, color: cockpitColors.textSecondary }}>
          {step.body}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22, flexWrap: "wrap" }}>
          <SecondaryButton onClick={() => void go(-1)} disabled={stepIndex === 0}>
            Back
          </SecondaryButton>
          {stepIndex >= total - 1 ? (
            <PrimaryButton onClick={() => void finish()}>Done</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => void go(1)}>Next</PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
