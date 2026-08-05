"use client";

import { useEffect, useState } from "react";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, radius, typography } from "@/design/tokens";
import ProductErrorBanner from "@/components/product/ProductErrorBanner";
import { presentProductError, type ProductErrorView } from "@/lib/platform/productErrors";

/**
 * Owner/employee access request panel — uses existing AccessRequestService.
 */
export default function AccessRequestsPanel() {
  const scope = useBusinessScope();
  const canApprove = scope.role === "OWNER"
    || scope.role === "ADMIN"
    || scope.permissions.includes("business.manage")
    || scope.permissions.includes("approvals.decide");
  const [requests, setRequests] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [moduleId, setModuleId] = useState("performance");
  const [error, setError] = useState<ProductErrorView | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch(`/api/businesses/${encodeURIComponent(scope.businessId)}/access-requests`);
    const data = await response.json();
    if (data.ok) setRequests(data.requests ?? []);
  }

  useEffect(() => {
    void refresh();
  }, [scope.businessId]);

  async function submit() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(scope.businessId)}/access-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason, requestedModuleId: moduleId, requestKind: "module" }),
      });
      const data = await response.json();
      if (data.ok) {
        setReason("");
        setSuccess("Access request sent. An owner will review it.");
        await refresh();
      } else {
        setError(data.productError ?? presentProductError(data.error));
      }
    } catch (err) {
      setError(presentProductError(err));
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(scope.businessId)}/access-requests/${encodeURIComponent(id)}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.productError ?? presentProductError(data.error));
        return;
      }
      setSuccess(decision === "approve" ? "Access approved and applied." : "Access request rejected.");
      await refresh();
    } catch (err) {
      setError(presentProductError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: spacing.md }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: cockpitColors.textPrimary }}>Access requests</h2>
      </div>
      {error ? <ProductErrorBanner error={error} /> : null}
      {success ? (
        <div role="status" style={{ ...card, borderColor: "rgba(34,211,238,.35)", color: cockpitColors.accent, fontWeight: 650 }}>
          {success}
        </div>
      ) : null}
      <div style={card}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650, fontSize: 13 }}>Module</span>
          <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} style={input}>
            <option value="performance">Performance</option>
            <option value="intelligence">Intelligence</option>
            <option value="integrations">Integrations</option>
            <option value="team">Team</option>
            <option value="settings">Settings</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, marginTop: 10 }}>
          <span style={{ fontWeight: 650, fontSize: 13 }}>Why do you need this?</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} style={input} />
        </label>
        <button type="button" disabled={busy || !reason.trim()} onClick={() => void submit()} style={primary}>
          {busy ? "Sending…" : "Request access"}
        </button>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {requests.length === 0 ? (
          <div style={{ ...card, color: cockpitColors.textSecondary }}>No open access requests.</div>
        ) : (
          requests.map((entry) => (
            <div key={entry.accessRequestId} style={card}>
              <div style={{ fontWeight: 700 }}>
                {entry.requestedModuleId ?? entry.requestedPermission ?? entry.requestKind}
              </div>
              <div style={{ color: cockpitColors.textSecondary, marginTop: 4 }}>{entry.reason}</div>
              <div style={{ fontSize: 12, color: cockpitColors.textMuted, marginTop: 6 }}>
                {entry.status === "pending" ? "Waiting for review" : entry.status === "approved" ? "Approved" : entry.status === "rejected" ? "Rejected" : entry.status}
              </div>
              {canApprove && entry.status === "pending" ? (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" disabled={busy} onClick={() => void decide(entry.accessRequestId, "approve")} style={primary}>
                    Approve
                  </button>
                  <button type="button" disabled={busy} onClick={() => void decide(entry.accessRequestId, "reject")} style={ghost}>
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const card = {
  borderRadius: radius.large,
  border: `1px solid ${cockpitColors.panelBorder}`,
  background: cockpitColors.panel,
  padding: spacing.md,
} as const;

const input = {
  width: "100%",
  borderRadius: 8,
  border: `1px solid ${cockpitColors.panelBorder}`,
  padding: "8px 10px",
  fontSize: 14,
} as const;

const primary = {
  marginTop: 12,
  border: "none",
  borderRadius: 8,
  background: cockpitColors.accent,
  color: "#fff",
  fontWeight: 650,
  padding: "8px 12px",
  cursor: "pointer",
} as const;

const ghost = {
  marginTop: 12,
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: 8,
  background: "transparent",
  color: cockpitColors.textPrimary,
  fontWeight: 650,
  padding: "8px 12px",
  cursor: "pointer",
} as const;
