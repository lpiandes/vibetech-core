"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cockpitColors } from "@/design/tokens";
import { VtCard, VtPanel } from "@/components/product/VtChrome";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { markReadyRequiresConnected } from "../../../backend/core/integrations/whiteglove/WhiteGloveConnectionRegistry.js";

type OpsRequest = {
  status?: string;
  connectionId?: string;
  ownerTitle?: string;
  playbookId?: string;
  requestedAt?: string | null;
  readyAt?: string | null;
  steps?: string[];
  ownerInputs?: Record<string, unknown>;
  lastNotify?: { ok?: boolean; error?: string | null; reason?: string | null } | null;
};

type InferredNeed = {
  connectionId: string;
  ownerTitle?: string;
  markReadyRequiresConnected?: boolean;
};

function isLive(status: unknown) {
  const s = String(status ?? "").toUpperCase();
  return s === "CONNECTED" || s === "VERIFIED" || s === "PROVEN";
}

/**
 * Admin: pending white-glove setups + Mark ready (requires Connected unless attestation).
 */
export default function AdminWhiteGloveOpsPanel({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<Record<string, OpsRequest>>({});
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, string>>({});
  const [inferredNeeds, setInferredNeeds] = useState<InferredNeed[]>([]);
  const [handoff, setHandoff] = useState<{ notifiedAt?: string | null; notify?: { ok?: boolean; error?: string | null; reason?: string | null } | null } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${encodeURIComponent(businessId)}/ops-setup`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? "Could not load ops setup."));
        return;
      }
      setPending((data.pendingOpsRequests && typeof data.pendingOpsRequests === "object")
        ? data.pendingOpsRequests
        : {});
      setConnectionStatuses((data.connectionStatuses && typeof data.connectionStatuses === "object")
        ? data.connectionStatuses
        : {});
      setInferredNeeds(Array.isArray(data.inferredNeeds) ? data.inferredNeeds : []);
      setHandoff(data.handoff ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load ops setup.");
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postOps(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/businesses/${encodeURIComponent(businessId)}/ops-setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function markReady(connectionId: string) {
    setBusyId(connectionId);
    setError(null);
    setMessage(null);
    try {
      const { res, data } = await postOps({ action: "mark_ready", connectionId });
      if (!res.ok || data.ok === false) {
        setError(String(data.error ?? "Could not mark ready."));
        return;
      }
      setMessage(`${connectionId.replace(/_/g, " ")} marked ready — owner can Test it works.`);
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark ready.");
    } finally {
      setBusyId(null);
    }
  }

  async function retryNotify(connectionId: string | null) {
    const key = connectionId ?? "handoff";
    setBusyId(`notify:${key}`);
    setError(null);
    setMessage(null);
    try {
      const { res, data } = await postOps({
        action: "retry_notify",
        ...(connectionId ? { connectionId } : {}),
      });
      if (!res.ok || data.ok === false) {
        setError(String(data.error ?? data.reason ?? "Could not resend ops email."));
        return;
      }
      setMessage(connectionId
        ? `Ops email resent for ${connectionId.replace(/_/g, " ")}.`
        : "Install handoff email resent.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend ops email.");
    } finally {
      setBusyId(null);
    }
  }

  const rowIds = new Set([
    ...Object.keys(pending),
    ...inferredNeeds.map((n) => n.connectionId),
  ]);
  const rows = [...rowIds].sort();
  const handoffFailed = handoff?.notify?.ok === false;

  return (
    <VtPanel title="White-glove ops setup">
      <div style={{ display: "grid", gap: 12 }}>
        <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: 13, lineHeight: 1.45 }}>
          1) Support access → Integrations → connect credentials (advanced). 2) When status is Connected, Mark ready.
          Salesforce / Custom Build can be attested without a vault Connected badge. Manual Twilio/Meta console work still required.
        </p>
        {handoff?.notifiedAt ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <p style={{ margin: 0, fontSize: 12, color: handoffFailed ? "#b91c1c" : cockpitColors.textMuted, flex: 1 }}>
              Install handoff emailed {String(handoff.notifiedAt)}
              {handoffFailed
                ? ` — email failed: ${handoff.notify?.error ?? handoff.notify?.reason ?? "unknown"}`
                : " — ops heads-up only (owner not Pending until they Request setup)."}
            </p>
            {handoffFailed ? (
              <SecondaryButton
                onClick={() => void retryNotify(null)}
                disabled={Boolean(busyId)}
              >
                {busyId === "notify:handoff" ? "…" : "Retry notify"}
              </SecondaryButton>
            ) : null}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SecondaryButton onClick={() => void load()} disabled={Boolean(busyId)}>
            Refresh
          </SecondaryButton>
          <SecondaryButton onClick={() => void retryNotify(null)} disabled={Boolean(busyId)}>
            {busyId === "notify:handoff" ? "…" : "Resend install handoff"}
          </SecondaryButton>
        </div>
        {rows.length === 0 ? (
          <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: 13 }}>
            No white-glove needs inferred yet for this business.
          </p>
        ) : (
          rows.map((id) => {
            const req = pending[id] ?? {};
            const status = String(req.status ?? "");
            const pendingOps = status === "pending_ops";
            const ready = status === "ops_ready";
            const connected = isLive(connectionStatuses[id]);
            const inferred = inferredNeeds.find((n) => n.connectionId === id);
            const needsConnected = markReadyRequiresConnected(id);
            const title = req.ownerTitle
              ?? inferred?.ownerTitle
              ?? id.replace(/_/g, " ");
            const steps = Array.isArray(req.steps) ? req.steps.slice(0, 6) : [];
            const canMark = !ready && (connected || !needsConnected);
            const notifyFailed = req.lastNotify?.ok === false;
            return (
              <VtCard key={id} padding={12} accent={pendingOps || (canMark && !ready)}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>{title}</strong>
                      <span style={{ marginLeft: 8, fontSize: 12, color: cockpitColors.textMuted }}>
                        {connected
                          ? "Connected"
                          : needsConnected
                            ? "Not connected"
                            : "Attestation OK (no vault required)"}
                        {pendingOps ? " · Owner Pending" : ready ? " · Marked ready" : status ? ` · ${status}` : " · Not requested"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {notifyFailed || pendingOps ? (
                        <SecondaryButton
                          onClick={() => void retryNotify(id)}
                          disabled={busyId === `notify:${id}`}
                        >
                          {busyId === `notify:${id}` ? "…" : "Retry notify"}
                        </SecondaryButton>
                      ) : null}
                      <PrimaryButton
                        onClick={() => void markReady(id)}
                        disabled={busyId === id || !canMark}
                      >
                        {busyId === id
                          ? "…"
                          : canMark
                            ? (needsConnected ? "Mark ready" : "Attest ready")
                            : connected
                              ? "Already ready"
                              : "Connect creds first"}
                      </PrimaryButton>
                    </div>
                  </div>
                  {notifyFailed ? (
                    <div style={{ fontSize: 12, color: "#b91c1c" }}>
                      Ops email failed: {req.lastNotify?.error ?? req.lastNotify?.reason ?? "unknown"}
                    </div>
                  ) : null}
                  {req.ownerInputs && Object.keys(req.ownerInputs).length ? (
                    <div style={{ fontSize: 12, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
                      Owner inputs: {Object.entries(req.ownerInputs)
                        .filter(([, v]) => v != null && String(v).trim())
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(" · ") || "—"}
                    </div>
                  ) : null}
                  {steps.length ? (
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.5 }}>
                      {steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              </VtCard>
            );
          })
        )}
        {message ? (
          <p style={{ margin: 0, color: cockpitColors.handled, fontSize: 13 }}>{message}</p>
        ) : null}
        {error ? (
          <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{error}</p>
        ) : null}
      </div>
    </VtPanel>
  );
}
