"use client";

import { useEffect, useState } from "react";

import { SimplePanel } from "@/components/product/SimpleUI";
import PrimaryButton from "@/components/product/PrimaryButton";
import { cockpitColors, spacing, typography } from "@/design/tokens";

type ModuleDef = { id: string; label: string };
type RoleRow = { membershipRole: string; label: string; visibleModuleIds: string[] };

export default function RoleAccessPanel({
  businessId,
  canManage,
}: {
  businessId: string;
  canManage: boolean;
}) {
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId || !canManage) return;
    fetch(`/api/businesses/${businessId}/team/access`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          setModules(data.modules ?? []);
          setRoles(data.roles ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [businessId, canManage]);

  if (!canManage) return null;

  function toggle(membershipRole: string, moduleId: string) {
    setRoles((prev) =>
      prev.map((row) => {
        if (row.membershipRole !== membershipRole) return row;
        const has = row.visibleModuleIds.includes(moduleId);
        return {
          ...row,
          visibleModuleIds: has
            ? row.visibleModuleIds.filter((id) => id !== moduleId)
            : [...row.visibleModuleIds, moduleId],
        };
      }),
    );
  }

  async function save(membershipRole: string) {
    const row = roles.find((r) => r.membershipRole === membershipRole);
    if (!row) return;
    setSavingRole(membershipRole);
    setMessage(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/team/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipRole, visibleModuleIds: row.visibleModuleIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setMessage(data.error ?? "Could not save role access.");
        return;
      }
      setRoles(data.roles ?? roles);
      setMessage(`Saved ${row.label}.`);
    } finally {
      setSavingRole(null);
    }
  }

  return (
    <SimplePanel title="What each role can see">
      <div style={{ padding: spacing.md, display: "flex", flexDirection: "column", gap: spacing.md }}>
        <p style={{ ...typography.caption, color: cockpitColors.textMuted, margin: 0 }}>
          Choose which modules show up in navigation for each role. Owners always see everything.
        </p>

        {loading ? (
          <p style={{ ...typography.caption, color: cockpitColors.textMuted, margin: 0 }}>Loading…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      ...typography.caption,
                      color: cockpitColors.textSecondary,
                      fontWeight: 700,
                      borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                    }}
                  >
                    Role
                  </th>
                  {modules.map((module) => (
                    <th
                      key={module.id}
                      style={{
                        textAlign: "center",
                        padding: "8px 6px",
                        ...typography.caption,
                        color: cockpitColors.textSecondary,
                        fontWeight: 700,
                        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {module.label}
                    </th>
                  ))}
                  <th style={{ borderBottom: `1px solid ${cockpitColors.panelBorder}` }} />
                </tr>
              </thead>
              <tbody>
                {roles.map((row) => (
                  <tr key={row.membershipRole}>
                    <td
                      style={{
                        padding: "8px 10px",
                        fontWeight: 650,
                        color: cockpitColors.textPrimary,
                        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.label}
                    </td>
                    {modules.map((module) => (
                      <td
                        key={module.id}
                        style={{
                          textAlign: "center",
                          padding: "8px 6px",
                          borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={row.visibleModuleIds.includes(module.id)}
                          onChange={() => toggle(row.membershipRole, module.id)}
                        />
                      </td>
                    ))}
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
                      <PrimaryButton onClick={() => void save(row.membershipRole)} disabled={savingRole === row.membershipRole}>
                        {savingRole === row.membershipRole ? "Saving…" : "Save"}
                      </PrimaryButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {message ? <span style={{ ...typography.caption, color: cockpitColors.accent }}>{message}</span> : null}
      </div>
    </SimplePanel>
  );
}
