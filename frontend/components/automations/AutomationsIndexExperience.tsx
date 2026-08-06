"use client";

import { useCallback, useEffect, useState } from "react";

import SecondaryButton from "@/components/product/SecondaryButton";
import {
  VtActiveToggle,
  VtCard,
  VtDock,
  VtDockLink,
  VtEmpty,
  VtHero,
  VtPage,
  VtPanel,
  VtStatusChip,
} from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

type TeammateRow = {
  employeeId: string;
  label: string;
  active: boolean;
  href: string;
  stepCount: number;
  triggerLabel: string;
};

export default function AutomationsIndexExperience({
  businessId,
  teammates,
}: {
  businessId: string;
  teammates: TeammateRow[];
}) {
  const [rows, setRows] = useState(teammates);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(teammates);
  }, [teammates]);

  const activeCount = rows.filter((r) => r.active).length;

  const toggle = useCallback(async (employeeId: string, currentlyActive: boolean) => {
    setBusyId(employeeId);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/team/${encodeURIComponent(employeeId)}/automations/status`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: currentlyActive ? "INACTIVE" : "ACTIVE" }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not update");
      const active = Boolean(data.result?.active ?? !currentlyActive);
      setRows((prev) => prev.map((r) => (r.employeeId === employeeId ? { ...r, active } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }, [businessId]);

  return (
    <VtPage>
      <VtHero
        eyebrow="Mission · Automations"
        title="Automations"
        right={<VtStatusChip label={`${activeCount}/${rows.length} LIVE`} tone={activeCount > 0 ? "live" : "off"} />}
      >
        <VtDock>
          <VtDockLink href={`/b/${encodeURIComponent(businessId)}/team`}>Team</VtDockLink>
          <VtDockLink href={`/b/${encodeURIComponent(businessId)}/work`}>Work</VtDockLink>
        </VtDock>
      </VtHero>

      <VtPanel title="Workflows">
        {rows.length === 0 ? <VtEmpty label="No operating paths yet — open Team" /> : null}
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <VtCard
              key={row.employeeId}
              padding={14}
              accent={row.active}
              style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{row.label}</div>
                <div style={{ fontSize: 12, color: cockpitColors.textSecondary, marginTop: 4, fontWeight: 700 }}>
                  {row.stepCount} steps
                  {row.triggerLabel ? ` · ${row.triggerLabel}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <VtActiveToggle
                  active={row.active}
                  busy={busyId === row.employeeId}
                  onClick={() => void toggle(row.employeeId, row.active)}
                />
                <SecondaryButton href={row.href}>Open path</SecondaryButton>
              </div>
            </VtCard>
          ))}
        </div>
      </VtPanel>
      {error ? <p style={{ color: cockpitColors.critical, fontWeight: 800 }}>{error}</p> : null}
    </VtPage>
  );
}
