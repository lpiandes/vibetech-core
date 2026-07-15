"use client";

import { useMemo, useState } from "react";
import { architect } from "./architectTheme";
import { ArchitectBadge, ArchitectButton } from "./ArchitectPrimitives";
import { scrubProposalPurpose } from "./architectSemantics";
import { resolveBusinessDisplayName } from "@/lib/operating/businessLanguage";

/**
 * Simple plan review: Approve, or tell us what to change (remove / add).
 */
export default function ProposalStudio({
  proposal,
  continuous = false,
  onApprove,
  onRequestChanges,
  onBack,
  busy,
}: {
  proposal: any;
  continuous?: boolean;
  onApprove: () => void;
  onRequestChanges: (input: {
    removeModuleIds: string[];
    removeEmployeeIds: string[];
    addRequest: string;
  }) => Promise<void> | void;
  onBack?: () => void;
  busy?: boolean;
}) {
  const [mode, setMode] = useState<"review" | "changes">("review");
  const [removeModuleIds, setRemoveModuleIds] = useState<string[]>([]);
  const [removeEmployeeIds, setRemoveEmployeeIds] = useState<string[]>([]);
  const [addRequest, setAddRequest] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);

  const summary = String(
    proposal?.explanation?.summary
    ?? "A complete operating system tailored to how your business works.",
  );

  const workforce = useMemo(() => {
    const items = proposal?.views?.digitalWorkforce?.items;
    return Array.isArray(items) ? items : [];
  }, [proposal]);

  const workspaces = useMemo(() => {
    const items = proposal?.views?.navigation?.items;
    return Array.isArray(items) ? items : [];
  }, [proposal]);

  const ownerWorkspaces = workspaces.filter((item: any) => item.ownerAdded);
  const ownerTeammates = workforce.filter((item: any) => item.ownerAdded);

  function toggleId(list: string[], id: string, setter: (next: string[]) => void) {
    setter(list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]);
  }

  async function submitChanges() {
    setChangeError(null);
    if (!removeModuleIds.length && !removeEmployeeIds.length && !addRequest.trim()) {
      setChangeError("Remove something from the plan, or tell us what to add.");
      return;
    }
    try {
      await onRequestChanges({
        removeModuleIds,
        removeEmployeeIds,
        addRequest: addRequest.trim(),
      });
      setMode("review");
      setRemoveModuleIds([]);
      setRemoveEmployeeIds([]);
      setAddRequest("");
      setJustUpdated(true);
    } catch {
      setChangeError("Couldn’t update the plan. Try again.");
    }
  }

  if (mode === "changes") {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <ArchitectBadge tone="accent">Change the plan</ArchitectBadge>
          <h2 style={{ margin: 0, fontFamily: architect.display, fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
            Tell us what we should change
          </h2>
          <p style={{ margin: 0, color: architect.inkMuted, lineHeight: 1.55 }}>
            Remove anything that doesn’t belong, or ask for something to add. Nothing goes live until you approve.
          </p>
        </div>

        {workspaces.length ? (
          <div style={panel}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Remove workspaces</h3>
            <p style={{ margin: "6px 0 12px", color: architect.inkMuted, fontSize: 13, lineHeight: 1.45 }}>
              Check anything you want out of this plan.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {workspaces.map((item: any) => {
                const id = String(item.id);
                const checked = removeModuleIds.includes(id);
                return (
                  <label key={id} style={choiceRow}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={() => toggleId(removeModuleIds, id, setRemoveModuleIds)}
                    />
                    <span>
                      {String(item.label ?? id)}
                      {item.ownerAdded ? <OwnerTag /> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        {workforce.length ? (
          <div style={panel}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Remove AI teammates</h3>
            <p style={{ margin: "6px 0 12px", color: architect.inkMuted, fontSize: 13, lineHeight: 1.45 }}>
              Check teammates you don’t want in the first version.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {workforce.map((item: any) => {
                const id = String(item.id);
                const checked = removeEmployeeIds.includes(id);
                return (
                  <label key={id} style={choiceRow}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={() => toggleId(removeEmployeeIds, id, setRemoveEmployeeIds)}
                    />
                    <span>
                      <strong>{String(item.label ?? id)}</strong>
                      {item.ownerAdded ? <OwnerTag /> : null}
                      {item.purpose ? (
                        <span style={{ display: "block", color: architect.inkMuted, fontSize: 13, marginTop: 2 }}>
                          {scrubProposalPurpose(String(item.purpose), String(item.label ?? ""))}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <div style={panel}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Add something</h3>
          <p style={{ margin: "6px 0 12px", color: architect.inkMuted, fontSize: 13, lineHeight: 1.45 }}>
            Describe a workspace, AI teammate, or capability you want included.
          </p>
          <textarea
            value={addRequest}
            onChange={(event) => {
              setChangeError(null);
              setAddRequest(event.target.value);
            }}
            rows={4}
            placeholder="What should we add?"
            style={textareaStyle}
            disabled={busy}
          />
        </div>

        {changeError ? (
          <p role="alert" style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>{changeError}</p>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ArchitectButton variant="secondary" disabled={busy} onClick={() => setMode("review")}>
            Back
          </ArchitectButton>
          <ArchitectButton disabled={busy} onClick={() => void submitChanges()}>
            {busy ? "Updating…" : "Update plan"}
          </ArchitectButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <ArchitectBadge tone="accent">Your plan</ArchitectBadge>
        <h2 style={{ margin: 0, fontFamily: architect.display, fontSize: "clamp(1.8rem, 3vw, 2.6rem)" }}>
          {resolveBusinessDisplayName(proposal?.businessName, "Your Business Operating System")}
        </h2>
        <p style={{ margin: 0, color: architect.inkMuted, fontSize: 16, lineHeight: 1.55, maxWidth: 720 }}>
          {summary}
        </p>
      </div>

      {justUpdated || ownerWorkspaces.length || ownerTeammates.length ? (
        <div style={{ ...panel, borderColor: "rgba(20,184,166,.45)", background: "rgba(20,184,166,.08)" }}>
          <h3 style={{ margin: 0 }}>Your additions</h3>
          {!ownerWorkspaces.length && !ownerTeammates.length ? (
            <p style={{ margin: "8px 0 0", color: architect.inkMuted, fontSize: 14 }}>
              Removals saved. Ask again if you still want a new teammate or workspace added.
            </p>
          ) : (
            <ul style={{ ...list, marginTop: 10 }}>
              {ownerWorkspaces.map((item: any) => (
                <li key={`ws_${item.id}`}>Workspace: {String(item.label)}</li>
              ))}
              {ownerTeammates.map((item: any) => (
                <li key={`emp_${item.id}`}>
                  AI teammate: {String(item.label)}
                  {item.purpose ? (
                    <span style={{ display: "block", color: architect.inkMuted, fontSize: 13 }}>
                      {String(item.purpose)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {workspaces.length ? (
        <div style={panel}>
          <h3 style={{ margin: 0 }}>Workspaces</h3>
          <ul style={list}>
            {workspaces.map((item: any) => (
              <li key={String(item.id)}>
                {String(item.label ?? item.id)}
                {item.ownerAdded ? <OwnerTag /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {workforce.length ? (
        <div style={panel}>
          <h3 style={{ margin: 0 }}>AI teammates</h3>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {workforce.map((item: any) => (
              <div key={String(item.id)}>
                <div style={{ fontWeight: 700 }}>
                  {String(item.label ?? "Teammate")}
                  {item.ownerAdded ? <OwnerTag /> : null}
                </div>
                {item.purpose ? (
                  <div style={{ color: architect.inkMuted, fontSize: 14, marginTop: 4, lineHeight: 1.45 }}>
                    {scrubProposalPurpose(String(item.purpose), String(item.label ?? ""))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        <ArchitectButton disabled={busy} onClick={onApprove}>
          {continuous ? "Approve this change" : "Approve"}
        </ArchitectButton>
        <ArchitectButton variant="secondary" disabled={busy} onClick={() => {
          setJustUpdated(false);
          setMode("changes");
        }}>
          Tell us what we should change
        </ArchitectButton>
        {onBack ? (
          <ArchitectButton variant="ghost" disabled={busy} onClick={onBack}>
            Back
          </ArchitectButton>
        ) : null}
      </div>
    </div>
  );
}

function OwnerTag() {
  return (
    <span style={{
      marginLeft: 8,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: architect.accent,
    }}>
      You added
    </span>
  );
}

const panel = {
  borderRadius: architect.radius,
  border: `1px solid ${architect.border}`,
  background: "rgba(15,23,42,.42)",
  padding: 20,
};

const list = {
  margin: "12px 0 0",
  paddingLeft: 18,
  color: architect.ink,
  lineHeight: 1.7,
};

const choiceRow = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: 12,
  borderRadius: 12,
  border: `1px solid ${architect.border}`,
  background: "rgba(2,6,23,.35)",
  cursor: "pointer",
} as const;

const textareaStyle = {
  width: "100%",
  borderRadius: 10,
  border: `1px solid ${architect.border}`,
  background: "rgba(2,6,23,.45)",
  color: architect.ink,
  padding: "10px 12px",
  resize: "vertical" as const,
  fontFamily: architect.font,
  lineHeight: 1.45,
  fontSize: 15,
};
