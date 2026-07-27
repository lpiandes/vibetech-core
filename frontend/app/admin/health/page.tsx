"use client";

import { useEffect, useState } from "react";

import AdminVtPage from "@/components/admin/AdminVtPage";
import StatusBadge from "@/components/product/StatusBadge";
import {
  VtCard,
  VtDockButton,
  VtDockLink,
  VtMetricStrip,
  VtPanel,
} from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

/**
 * Admin health panel — worker / jobs / queue visibility.
 */
export default function AdminHealthPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/admin/health");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not load health");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, []);

  const healthy = data?.status === "healthy";

  return (
    <AdminVtPage
      title="Platform health"
      statusLabel={data ? String(data.status).toUpperCase() : "Loading"}
      statusTone={data ? (healthy ? "live" : "warn") : "neutral"}
      dock={(
        <>
          <VtDockButton onClick={() => void load()}>Refresh</VtDockButton>
          <VtDockLink href="/admin">Dashboard</VtDockLink>
        </>
      )}
    >
      {error ? (
        <VtPanel title="Error">
          <p style={{ margin: 0, color: cockpitColors.critical, fontWeight: 700 }}>{error}</p>
        </VtPanel>
      ) : null}

      {data ? (
        <>
          <VtCard padding={16} accent>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge
                label={healthy ? "Healthy" : "Needs attention"}
                tone={healthy ? "success" : "warning"}
              />
              <strong style={{ fontSize: 18 }}>{String(data.status).toUpperCase()}</strong>
              <span style={{ color: cockpitColors.textMuted, fontSize: 13 }}>
                checked {data.checkedAt} · {data.latencyMs}ms
              </span>
            </div>
          </VtCard>

          <VtMetricStrip
            items={[
              { label: "Database", value: String(data.database) },
              { label: "Jobs schema", value: String(data.jobsSchema) },
              { label: "Worker", value: String(data.worker) },
            ]}
          />

          {data.queue ? (
            <VtPanel title="Queue depth">
              <VtMetricStrip
                items={[
                  { label: "Pending", value: String(data.queue.pending) },
                  { label: "Running", value: String(data.queue.running) },
                  { label: "Failed", value: String(data.queue.failed) },
                  { label: "Dead", value: String(data.queue.dead) },
                ]}
              />
            </VtPanel>
          ) : null}

          {data.heartbeat ? (
            <VtPanel title="Heartbeat">
              <pre
                style={{
                  margin: 0,
                  padding: 14,
                  borderRadius: 12,
                  background: cockpitColors.inset,
                  border: `1px solid ${cockpitColors.panelBorder}`,
                  fontSize: 12,
                  overflow: "auto",
                }}
              >
                {JSON.stringify(data.heartbeat, null, 2)}
              </pre>
            </VtPanel>
          ) : null}

          <VtPanel title="Guidance">
            <p style={{ margin: "0 0 8px", color: cockpitColors.textSecondary, lineHeight: 1.5, fontSize: 14 }}>
              <strong>At scale:</strong> {data.guidance?.preferWorker}
            </p>
            <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.5, fontSize: 14 }}>
              <strong>HA backup:</strong> {data.guidance?.tickBackup}
            </p>
          </VtPanel>
        </>
      ) : (
        <VtPanel title="Status">
          <p style={{ margin: 0, color: cockpitColors.textMuted }}>Loading…</p>
        </VtPanel>
      )}
    </AdminVtPage>
  );
}
