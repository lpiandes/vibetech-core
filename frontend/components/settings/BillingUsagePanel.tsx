"use client";

import { useEffect, useState } from "react";
import { cockpitColors } from "@/design/tokens";
import { resolvePackageSoftCaps } from "../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { presentManagedTierEntitlements } from "../../../backend/core/platform/billing/StripeBillingScaffold.js";

/**
 * Phase 5 billing/usage + managed soft caps + priority support surface.
 */
export default function BillingUsagePanel({
  businessId,
  purchasedPackages = [],
}: {
  businessId: string;
  purchasedPackages?: string[];
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billing, setBilling] = useState<any>(null);
  const [meters, setMeters] = useState<any[]>([]);
  const [channelChecklist, setChannelChecklist] = useState<any>(null);

  const packages = Array.isArray(purchasedPackages) ? purchasedPackages.map(String) : [];
  const caps = resolvePackageSoftCaps(packages);
  const priority = packages.some((id) => {
    const tier = presentManagedTierEntitlements(id);
    return tier?.prioritySupport === true;
  }) || packages.includes("addon_priority_support");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/billing`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          throw new Error(data.error ?? "Could not load billing.");
        }
        if (!cancelled) {
          setBilling(data.billing ?? null);
          setMeters(Array.isArray(data.meters) ? data.meters : []);
          setChannelChecklist(data.channelChecklist ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.textMuted }}>Billing & usage</div>

      {priority ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(15,23,42,.04)",
            border: `1px solid ${cockpitColors.panelBorder}`,
            display: "grid",
            gap: 4,
          }}
        >
          <div style={{ fontWeight: 750, fontSize: 14, color: cockpitColors.textPrimary }}>
            Priority support
          </div>
          <p style={{ margin: 0, fontSize: 13, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
            This business is flagged for priority human support. Email{" "}
            <strong>support@vibetech.ai</strong> with subject line{" "}
            <code style={{ fontSize: 12 }}>PRIORITY · {businessId}</code>
            {" "}and support will respond first. This is a managed SLA — not an in-app ticket queue.
          </p>
        </div>
      ) : null}

      {(caps.maxWorkers != null || caps.maxWorkflows != null) ? (
        <div style={{ fontSize: 13, color: cockpitColors.textSecondary }}>
          Soft caps on this plan:{" "}
          {caps.maxWorkers != null ? `${caps.maxWorkers} AI workers` : null}
          {caps.maxWorkers != null && caps.maxWorkflows != null ? " · " : null}
          {caps.maxWorkflows != null ? `${caps.maxWorkflows} workflows` : null}
        </div>
      ) : null}

      {loading ? (
        <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: 14 }}>Loading…</p>
      ) : error ? (
        <p style={{ margin: 0, color: cockpitColors.critical, fontSize: 14 }}>{error}</p>
      ) : (
        <>
          <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: 14, lineHeight: 1.45 }}>
            {billing?.note ?? "Packages assigned at onboarding. Usage meters below. Invoices are sent separately (Stripe Checkout not required)."}
          </p>
          {Array.isArray(billing?.purchasedPackages) && billing.purchasedPackages.length ? (
            <p style={{ margin: 0, fontSize: 13, color: cockpitColors.textPrimary }}>
              Packages: {billing.purchasedPackages.join(", ")}
            </p>
          ) : packages.length ? (
            <p style={{ margin: 0, fontSize: 13, color: cockpitColors.textPrimary }}>
              Packages: {packages.join(", ")}
            </p>
          ) : null}
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13, color: cockpitColors.textSecondary }}>
            {meters.slice(0, 6).map((meter) => (
              <li key={String(meter.id)}>
                {meter.label}: {meter.usage?.used ?? 0}/{meter.usage?.included ?? meter.includedDefault ?? 0}{" "}
                {meter.unit}
                {meter.usage?.overageUnits > 0 ? ` · overage ${meter.usage.overageUnits}` : ""}
              </li>
            ))}
          </ul>

          {channelChecklist?.items?.length ? (
            <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.textMuted }}>
                Channel go-live ({channelChecklist.readyCount}/{channelChecklist.total})
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13, color: cockpitColors.textSecondary }}>
                {channelChecklist.items.map((item: any) => (
                  <li key={String(item.id)}>
                    {item.ready ? "Ready" : "Needs setup"} — {item.label}
                    {!item.ready && (item.ownerNote || item.operatorNote) ? (
                      <span style={{ display: "block", color: cockpitColors.textMuted }}>
                        {item.ownerNote || item.operatorNote}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
