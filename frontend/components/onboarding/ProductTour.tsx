"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  PRODUCT_TOUR_STEPS,
  PRODUCT_TOUR_VERSION,
  type ProductTourStep,
} from "@/lib/onboarding/productTourSteps";
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

type SpotlightRect = { top: number; left: number; width: number; height: number };

function computeCardPosition(
  spotlight: SpotlightRect | null,
  cardSize: { w: number; h: number },
): { left?: number; top?: number } {
  if (typeof window === "undefined" || !spotlight) return {};
  const margin = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cw = Math.min(cardSize.w || 420, vw - margin * 2);
  const ch = Math.min(cardSize.h || 320, vh - margin * 2);

  if (spotlight.left < 340) {
    const left = Math.min(Math.max(292, spotlight.left + spotlight.width + 20), vw - cw - margin);
    const top = spotlight.top > vh * 0.4
      ? Math.max(margin, Math.round((vh - ch) / 2))
      : Math.min(Math.max(margin, spotlight.top), vh - ch - margin);
    return { left, top };
  }

  return {
    left: Math.max(margin, Math.min(spotlight.left + spotlight.width + 16, vw - cw - margin)),
    top: Math.min(Math.max(margin, spotlight.top), vh - ch - margin),
  };
}

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
  const [steps, setSteps] = useState<ProductTourStep[]>(PRODUCT_TOUR_STEPS);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [cardSize, setCardSize] = useState({ w: 420, h: 320 });

  const total = steps.length;
  const step = steps[Math.min(stepIndex, Math.max(0, total - 1))];

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

  const measureSpotlight = useCallback((navTarget?: string) => {
    if (!navTarget || typeof document === "undefined") {
      setSpotlight(null);
      return;
    }
    const el = document.querySelector(`[data-tour-nav="${navTarget}"]`) as HTMLElement | null;
    if (!el) {
      setSpotlight(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setSpotlight({
      top: Math.max(8, r.top - 6),
      left: Math.max(8, r.left - 6),
      width: r.width + 12,
      height: r.height + 12,
    });
  }, []);

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
      let adaptiveSteps: ProductTourStep[] | null = null;
      try {
        const qs = forceOpen ? "?includeCompleted=1" : "";
        const res = await fetch(
          `/api/businesses/${encodeURIComponent(businessId)}/onboarding/tour${qs}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.tour) server = data.tour as TourState;
          if (Array.isArray(data?.adaptive?.steps) && data.adaptive.steps.length) {
            adaptiveSteps = data.adaptive.steps as ProductTourStep[];
          }
        }
      } catch {
        /* ignore */
      }

      if (cancelled) return;
      if (adaptiveSteps?.length) setSteps(adaptiveSteps);

      const pick = (() => {
        if (server && local) {
          return String(server.updatedAt ?? "") >= String(local.updatedAt ?? "") ? server : local;
        }
        return server ?? local;
      })();

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
    if (!open || !step) return;
    if (step.hrefSuffix) {
      router.push(`/b/${encodeURIComponent(businessId)}${step.hrefSuffix}`);
    }
    const t = window.setTimeout(() => measureSpotlight(step.navTarget), 320);
    const onResize = () => measureSpotlight(step.navTarget);
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [open, step, businessId, router, measureSpotlight, stepIndex]);

  useEffect(() => {
    if (!open) return;
    const block = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = document.getElementById("vt-tour-card");
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setCardSize({ w: r.width || 420, h: r.height || 320 });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [open, stepIndex, step?.body, step?.title]);

  if (!ready || !open || !step || total === 0) return null;

  async function go(delta: number) {
    const nextIndex = Math.min(total - 1, Math.max(0, stepIndex + delta));
    setStepIndex(nextIndex);
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

  const { left: cardLeft, top: cardTop } = computeCardPosition(spotlight, cardSize);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vt-tour-title"
      style={{ position: "fixed", inset: 0, zIndex: 2000, pointerEvents: "auto" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {spotlight ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: 12,
            boxShadow: `0 0 0 3px ${cockpitColors.accent}, 0 0 0 9999px rgba(15, 23, 42, 0.72)`,
            pointerEvents: "none",
            zIndex: 2001,
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(15, 23, 42, 0.72)",
            pointerEvents: "none",
          }}
        />
      )}

      <div
        id="vt-tour-card"
        style={{
          position: "absolute",
          zIndex: 2002,
          width: "min(420px, calc(100vw - 32px))",
          maxHeight: "min(70vh, calc(100dvh - 32px))",
          overflowY: "auto",
          left: cardLeft ?? "50%",
          top: cardTop ?? "50%",
          transform: cardLeft == null ? "translate(-50%, -50%)" : undefined,
          background: "#0c1222",
          borderRadius: 20,
          padding: "24px 22px 18px",
          boxShadow: "0 24px 80px rgba(0,0,0,.55)",
          border: "1px solid rgba(34, 211, 238, 0.22)",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: cockpitColors.accent }}>
          Step {stepIndex + 1} of {total}
          {step.navHint ? ` · ${step.navHint}` : ""}
        </div>
        <h2 id="vt-tour-title" style={{ margin: "10px 0 0", fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.02em", color: cockpitColors.textPrimary }}>
          {step.title}
        </h2>
        <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.55, color: cockpitColors.textSecondary }}>
          {step.body}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20, flexWrap: "wrap" }}>
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
