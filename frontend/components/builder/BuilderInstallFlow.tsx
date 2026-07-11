"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

export function BuilderDryRunClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "dry_run" }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? data.reason ?? "Dry run failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dry run failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void run();
  }, [sessionId]);

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: spacing.xl, display: "grid", gap: spacing.lg }}>
      <h1 style={{ margin: 0 }}>Dry run</h1>
      <p style={{ color: cockpitColors.textMuted }}>
        We simulate the install without changing your live business. Nothing is installed yet.
      </p>
      {busy ? <div>Preparing dry run…</div> : null}
      {error ? <div style={{ color: cockpitColors.warning }}>{error}</div> : null}
      {result ? (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>What would change</h3>
          <ul>
            {(result.progressSteps ?? []).map((step: string) => <li key={step}>{step}</li>)}
          </ul>
          <p style={{ color: cockpitColors.textMuted }}>
            {result.dryRunResult?.simulatedOperations?.length ?? 0} planned operations · plan ready for approval
          </p>
          <button
            type="button"
            style={button}
            onClick={() => router.push(`/builder/${sessionId}/install`)}
          >
            Review and approve install
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function BuilderInstallClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("awaiting_approval");
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openHref, setOpenHref] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function install() {
    setBusy(true);
    setError(null);
    setStatus("installing");
    setSteps([
      "Creating your workspaces",
      "Configuring roles",
      "Installing digital employees",
      "Preparing dashboards",
      "Checking integrations",
    ]);
    try {
      const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "install", approved: true }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? data.reason ?? "Install failed.");
      setStatus("installed");
      setOpenHref(data.openHref);
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Install failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: spacing.xl, display: "grid", gap: spacing.lg }}>
      <h1 style={{ margin: 0 }}>Approve installation</h1>
      <p style={{ color: cockpitColors.textMuted }}>
        Approval is bound to this proposal version. If anything changes, you will need a new dry run.
      </p>
      <div style={card}>
        <p>Status: <strong>{status.replace(/_/g, " ")}</strong></p>
        <ul>{steps.map((step) => <li key={step}>{step}</li>)}</ul>
        {error ? <div style={{ color: cockpitColors.warning }}>{error}</div> : null}
        {status !== "installed" ? (
          <button type="button" style={button} disabled={busy} onClick={() => void install()}>
            {busy ? "Installing…" : "Approve and install"}
          </button>
        ) : (
          <button type="button" style={button} onClick={() => openHref && router.push(openHref)}>
            Open installed business
          </button>
        )}
      </div>
    </div>
  );
}

const card: CSSProperties = {
  background: "#fff",
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: radius.large,
  padding: spacing.lg,
};

const button: CSSProperties = {
  background: "#0F766E",
  color: "#fff",
  border: "none",
  borderRadius: radius.medium,
  padding: `${spacing.sm} ${spacing.md}`,
  fontWeight: 650,
  cursor: "pointer",
};
