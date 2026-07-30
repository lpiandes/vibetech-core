"use client";

import { useEffect, useMemo, useState } from "react";

import { SimplePanel, SimpleEmpty } from "@/components/product/SimpleUI";
import PrimaryButton from "@/components/product/PrimaryButton";
import { cockpitColors, spacing, typography } from "@/design/tokens";

type WeeklyWindow = { day: number; start: string; end: string };
type AvailabilityMember = {
  memberId: string;
  displayName: string;
  timezone: string | null;
  weekly: WeeklyWindow[];
  bookable: boolean;
};
type Availability = { timezone: string; members: Record<string, AvailabilityMember> };

const WEEKDAYS: Array<{ day: number; label: string }> = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
];

function defaultWeeklyRows(): Record<number, { start: string; end: string; enabled: boolean }> {
  return Object.fromEntries(WEEKDAYS.map(({ day }) => [day, { start: "09:00", end: "17:00", enabled: true }]));
}

function rowsFromWeekly(weekly: WeeklyWindow[] | undefined): Record<number, { start: string; end: string; enabled: boolean }> {
  const rows = Object.fromEntries(WEEKDAYS.map(({ day }) => [day, { start: "09:00", end: "17:00", enabled: false }]));
  for (const window of weekly ?? []) {
    if (rows[window.day]) rows[window.day] = { start: window.start, end: window.end, enabled: true };
  }
  return rows;
}

export default function TeamAvailabilityPanel({
  businessId,
  members,
  canManage,
}: {
  businessId: string;
  members: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id ?? "");
  const [rows, setRows] = useState(defaultWeeklyRows());
  const [bookable, setBookable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/team/availability`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) setAvailability(data.availability);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(() => {
    if (!selectedMemberId) return;
    const existing = availability?.members?.[selectedMemberId];
    setRows(rowsFromWeekly(existing?.weekly));
    setBookable(existing?.bookable ?? true);
  }, [selectedMemberId, availability]);

  const selectedMemberName = useMemo(
    () => members.find((m) => m.id === selectedMemberId)?.name ?? "",
    [members, selectedMemberId],
  );

  if (!canManage) return null;
  if (members.length === 0) {
    return (
      <SimplePanel title="Appointment availability">
        <SimpleEmpty>Add staff first, then set who is bookable for appointments.</SimpleEmpty>
      </SimplePanel>
    );
  }

  async function save() {
    if (!selectedMemberId) return;
    setSaving(true);
    setMessage(null);
    try {
      const weekly = WEEKDAYS.filter(({ day }) => rows[day]?.enabled).map(({ day }) => ({
        day,
        start: rows[day].start,
        end: rows[day].end,
      }));
      const res = await fetch(`/api/businesses/${businessId}/team/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: selectedMemberId, displayName: selectedMemberName, weekly, bookable }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.error ?? "Could not save availability.");
        return;
      }
      setAvailability((prev) => ({
        timezone: prev?.timezone ?? "America/New_York",
        members: { ...(prev?.members ?? {}), [selectedMemberId]: data.member },
      }));
      setMessage("Saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SimplePanel title="Appointment availability">
      <div style={{ padding: spacing.md, display: "flex", flexDirection: "column", gap: spacing.md }}>
        <p style={{ ...typography.caption, color: cockpitColors.textMuted, margin: 0 }}>
          Set weekly hours for each bookable teammate. The appointment setter auto-books confirmed appointments into these windows.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <label style={{ ...typography.caption, color: cockpitColors.textSecondary, fontWeight: 700 }}>
            Teammate
          </label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            style={{
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
              padding: "6px 10px",
              fontSize: 14,
              background: cockpitColors.panel,
              color: cockpitColors.textPrimary,
            }}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", ...typography.caption, color: cockpitColors.textSecondary }}>
            <input type="checkbox" checked={bookable} onChange={(e) => setBookable(e.target.checked)} />
            Bookable for appointments
          </label>
        </div>

        {loading ? (
          <p style={{ ...typography.caption, color: cockpitColors.textMuted, margin: 0 }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            {WEEKDAYS.map(({ day, label }) => {
              const row = rows[day];
              return (
                <div key={day} style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, width: 60, ...typography.caption, color: cockpitColors.textPrimary, fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => setRows({ ...rows, [day]: { ...row, enabled: e.target.checked } })}
                    />
                    {label}
                  </label>
                  <input
                    type="time"
                    value={row.start}
                    disabled={!row.enabled}
                    onChange={(e) => setRows({ ...rows, [day]: { ...row, start: e.target.value } })}
                    style={{ borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}`, padding: "5px 8px", fontSize: 13 }}
                  />
                  <span style={{ color: cockpitColors.textMuted, fontSize: 13 }}>to</span>
                  <input
                    type="time"
                    value={row.end}
                    disabled={!row.enabled}
                    onChange={(e) => setRows({ ...rows, [day]: { ...row, end: e.target.value } })}
                    style={{ borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}`, padding: "5px 8px", fontSize: 13 }}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <PrimaryButton onClick={() => void save()} disabled={saving || !selectedMemberId}>
            {saving ? "Saving…" : "Save availability"}
          </PrimaryButton>
          {message ? <span style={{ ...typography.caption, color: cockpitColors.accent }}>{message}</span> : null}
        </div>
      </div>
    </SimplePanel>
  );
}
