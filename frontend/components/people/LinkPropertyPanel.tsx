"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

import { cockpitColors, radius } from "@/design/tokens";

type ListingOption = { id: string; displayName: string };

export default function LinkPropertyPanel({
  businessId,
  partyId,
  linkedSubjects = [],
}: {
  businessId: string;
  partyId: string;
  linkedSubjects?: Array<{ id?: string; displayName?: string }>;
}) {
  const router = useRouter();
  const [listings, setListings] = useState<ListingOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localLinked, setLocalLinked] = useState<Array<{ id?: string; displayName?: string }>>(linkedSubjects);

  useEffect(() => {
    setLocalLinked(linkedSubjects);
  }, [linkedSubjects]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/subjects`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const rows = Array.isArray(data?.subjects) ? data.subjects : [];
        setListings(
          rows
            .map((row: any) => ({
              id: String(row.id ?? ""),
              displayName: String(row.displayName ?? row.name ?? row.id ?? ""),
            }))
            .filter((row: ListingOption) => row.id && row.displayName),
        );
      } catch {
        if (!cancelled) setListings([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  async function linkSubject(subjectId: string, { manageBusy = true, displayName }: { manageBusy?: boolean; displayName?: string } = {}) {
    if (!subjectId || (manageBusy && busy)) return;
    if (manageBusy) setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/people/${encodeURIComponent(partyId)}/subjects`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectId }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error ?? "Could not link property."));
      const label = displayName
        || listings.find((row) => row.id === subjectId)?.displayName
        || subjectId;
      setLocalLinked((prev) => {
        if (prev.some((row) => String(row.id) === subjectId)) return prev;
        return [...prev, { id: subjectId, displayName: label }];
      });
      setNotice("Linked.");
      setSelectedId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link property.");
      if (!manageBusy) throw err;
    } finally {
      if (manageBusy) setBusy(false);
    }
  }

  async function createAndLink() {
    const displayName = newName.trim();
    if (!displayName || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const createRes = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType: "listing", displayName }),
      });
      const created = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(String(created?.error ?? "Could not create property."));
      const subjectId = String(created?.subject?.id ?? created?.id ?? "");
      if (!subjectId) throw new Error("Property created but missing id.");
      setNewName("");
      await linkSubject(subjectId, { manageBusy: false, displayName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create property.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink(subjectId: string) {
    if (!subjectId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/people/${encodeURIComponent(partyId)}/subjects/${encodeURIComponent(subjectId)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error ?? "Could not unlink."));
      setLocalLinked((prev) => prev.filter((row) => String(row.id) !== subjectId));
      setNotice("Unlinked.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlink.");
    } finally {
      setBusy(false);
    }
  }

  const linkedIds = new Set(localLinked.map((s) => String(s.id ?? "")));
  const available = listings.filter((row) => !linkedIds.has(row.id));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {localLinked.length > 0 ? (
        <div style={{ display: "grid", gap: 6 }}>
          {localLinked.map((subject) => {
            const id = String(subject.id ?? "");
            return (
              <div
                key={id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 10px",
                  border: `1px solid ${cockpitColors.panelBorder}`,
                  borderRadius: radius.medium,
                  background: cockpitColors.panel,
                }}
              >
                <Link
                  href={`/b/${encodeURIComponent(businessId)}/properties/${encodeURIComponent(id)}`}
                  style={{ color: cockpitColors.textPrimary, fontWeight: 700, textDecoration: "none" }}
                >
                  {String(subject.displayName ?? id)}
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void unlink(id)}
                  style={{
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    borderRadius: 8,
                    padding: "4px 8px",
                    background: cockpitColors.panel,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  Unlink
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.45 }}>
          Link a property so campaigns, follow-up, and automations know what they asked about.
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {available.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select a property…</option>
              {available.map((row) => (
                <option key={row.id} value={row.id}>{row.displayName}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !selectedId}
              onClick={() => void linkSubject(selectedId)}
              style={buttonStyle(Boolean(selectedId) && !busy)}
            >
              Link property
            </button>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Or type a new listing name"
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          />
          <button
            type="button"
            disabled={busy || !newName.trim()}
            onClick={() => void createAndLink()}
            style={buttonStyle(Boolean(newName.trim()) && !busy)}
          >
            Create &amp; link
          </button>
        </div>
      </div>

      {notice ? <div style={{ fontSize: 12, color: cockpitColors.textSecondary }}>{notice}</div> : null}
      {error ? <div style={{ fontSize: 12, color: cockpitColors.warning }}>{error}</div> : null}
    </div>
  );
}

const inputStyle: CSSProperties = {
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: radius.medium,
  padding: "8px 10px",
  font: "inherit",
  fontWeight: 600,
  color: cockpitColors.textPrimary,
  background: cockpitColors.panel,
};

function buttonStyle(enabled: boolean): CSSProperties {
  return {
    border: "none",
    borderRadius: 10,
    padding: "8px 12px",
    background: enabled ? cockpitColors.accent : "rgba(15,118,110,0.35)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 12,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}
