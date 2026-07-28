"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import {
  VtDock,
  VtDockLink,
  VtEmpty,
  VtFilterChip,
  VtHero,
  VtPage,
  VtPanel,
  VtStatusChip,
  vtInputStyle,
} from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

const KINDS = ["lead", "client", "family", "contractor", "vendor", "employee", "other"] as const;

type Contact = {
  id: string;
  partyId?: string;
  name: string;
  email?: string;
  phone?: string;
  kind?: string;
  tags?: string[];
  notes?: string;
};

type PipelineCard = {
  id: string;
  title: string;
  stageId: string;
  contactId?: string;
  pipelineName?: string;
  stageLabel?: string;
};

export default function ContactsCrmPanel({ businessId }: { businessId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState<string>("lead");
  const [notes, setNotes] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editKind, setEditKind] = useState("lead");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [relatedCards, setRelatedCards] = useState<PipelineCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string; stages: Array<{ id: string; label: string }> }>>([]);
  const [importPipelineId, setImportPipelineId] = useState("");
  const [importStageId, setImportStageId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<string | null>(null);
  const [addToPipeline, setAddToPipeline] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/contacts`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not load contacts");
    setContacts(data.contacts ?? []);
  }, [businessId]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [load]);

  useEffect(() => {
    if (!importOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/pipelines`);
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const list = (data.pipelines ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          stages: (p.stages ?? []).map((s: any) => ({ id: s.id, label: s.label })),
        }));
        setPipelines(list);
        if (!importPipelineId && list[0]) {
          setImportPipelineId(list[0].id);
          setImportStageId(list[0].stages?.[0]?.id ?? "");
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [importOpen, businessId, importPipelineId]);

  const importStages = useMemo(() => {
    return pipelines.find((p) => p.id === importPipelineId)?.stages ?? [];
  }, [pipelines, importPipelineId]);

  const selected = useMemo(
    () => contacts.find((c) => c.id === selectedId) ?? null,
    [contacts, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setRelatedCards([]);
      return;
    }
    setEditNotes(selected.notes ?? "");
    setEditKind(selected.kind ?? "lead");
    setEditName(selected.name ?? "");
    setEditEmail(selected.email ?? "");
    setEditPhone(selected.phone ?? "");
    let cancelled = false;
    void (async () => {
      try {
        const pipesRes = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/pipelines`);
        const pipes = await pipesRes.json().catch(() => ({}));
        if (cancelled) return;
        const cards: PipelineCard[] = [];
        for (const p of pipes.pipelines ?? []) {
          for (const card of p.cards ?? []) {
            if (card.contactId === selected.id || card.partyId === selected.id) {
              const stage = (p.stages ?? []).find((s: any) => s.id === card.stageId);
              cards.push({
                ...card,
                pipelineName: p.name,
                stageLabel: stage?.label ?? card.stageId,
              });
            }
          }
        }
        setRelatedCards(cards);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, businessId]);

  const visible = useMemo(() => {
    if (kindFilter === "all") return contacts;
    return contacts.filter((c) => c.kind === kindFilter);
  }, [contacts, kindFilter]);

  async function addContact() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/contacts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, phone, kind, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not save");
      setContacts(data.contacts ?? []);
      const created = (data.contacts ?? []).find((c: Contact) => c.name === name.trim())
        ?? data.contacts?.[data.contacts.length - 1];
      if (created?.id) setSelectedId(created.id);
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setComposerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/contacts`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          name: editName.trim() || selected.name,
          email: editEmail.trim(),
          phone: editPhone.trim(),
          kind: editKind,
          notes: editNotes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not update");
      setContacts(data.contacts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!window.confirm(`Remove ${selected.name} from roster?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/contacts`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not delete");
      setContacts(data.contacts ?? []);
      setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function runLeadImport() {
    if (!importFile) return;
    setBusy(true);
    setError(null);
    setImportReport(null);
    try {
      const form = new FormData();
      form.append("file", importFile);
      form.append("addToPipeline", addToPipeline ? "true" : "false");
      if (importPipelineId) form.append("pipelineId", importPipelineId);
      if (importStageId) form.append("stageId", importStageId);
      form.append("kind", "lead");
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/contacts/import`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Import failed");
      await load();
      setImportReport(
        `Imported ${data.rowCount ?? 0} rows · ${data.created ?? 0} created · ${data.updated ?? 0} updated · ${data.skipped ?? 0} skipped`,
      );
      setImportFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function runSocialScreen() {
    if (!selected && !editName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/social-screening/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contactId: selected?.id ?? null,
          subjectName: editName.trim() || selected?.name,
          name: editName.trim() || selected?.name,
          email: editEmail.trim() || selected?.email,
          phone: editPhone.trim() || selected?.phone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Screen failed");
      setError(null);
      window.alert(data.message ?? "Social background screen started.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screen failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <VtPage>
      <VtHero
        eyebrow="Mission · People"
        title="People"
        right={<VtStatusChip label={`${contacts.length} CONTACTS`} tone={contacts.length > 0 ? "live" : "neutral"} />}
      >
        <VtDock>
          <VtDockLink href={`/b/${encodeURIComponent(businessId)}/pipelines`}>Pipelines</VtDockLink>
          <VtDockLink href={`/b/${encodeURIComponent(businessId)}/inbox`}>Inbox</VtDockLink>
          <button type="button" onClick={() => setImportOpen((v) => !v)} style={dockBtnStyle}>
            {importOpen ? "Close import" : "Import leads"}
          </button>
          <button type="button" onClick={() => setComposerOpen((v) => !v)} style={dockBtnStyle}>
            {composerOpen ? "Close" : "+ Contact"}
          </button>
        </VtDock>
      </VtHero>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <VtFilterChip active={kindFilter === "all"} onClick={() => setKindFilter("all")}>All</VtFilterChip>
        {KINDS.map((k) => (
          <VtFilterChip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>{k}</VtFilterChip>
        ))}
      </div>

      {importOpen ? (
        <VtPanel title="Import lead list">
          <p style={{ margin: "0 0 10px", color: cockpitColors.textSecondary, fontSize: 13, fontWeight: 600 }}>
            Upload a CSV with name/email/phone columns. Leads land in People
            {addToPipeline ? " and on the selected pipeline stage." : "."}
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              style={vtInputStyle}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={addToPipeline}
                onChange={(e) => setAddToPipeline(e.target.checked)}
              />
              Add to pipeline
            </label>
            {addToPipeline ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <select
                  value={importPipelineId}
                  onChange={(e) => {
                    setImportPipelineId(e.target.value);
                    const stages = pipelines.find((p) => p.id === e.target.value)?.stages ?? [];
                    setImportStageId(stages[0]?.id ?? "");
                  }}
                  style={vtInputStyle}
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={importStageId}
                  onChange={(e) => setImportStageId(e.target.value)}
                  style={vtInputStyle}
                >
                  {importStages.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <PrimaryButton onClick={() => void runLeadImport()} disabled={busy || !importFile}>
              {busy ? "Importing…" : "Import CSV"}
            </PrimaryButton>
            {importReport ? (
              <p style={{ margin: 0, fontWeight: 750, color: cockpitColors.accent }}>{importReport}</p>
            ) : null}
          </div>
        </VtPanel>
      ) : null}

      {composerOpen ? (
        <VtPanel title="Recruit contact">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }} className="vt-people-compose">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={vtInputStyle} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={vtInputStyle} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" style={vtInputStyle} />
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={vtInputStyle}>
              {KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} style={vtInputStyle} />
          <PrimaryButton onClick={() => void addContact()} disabled={busy || !name.trim()}>
            {busy ? "…" : "Add"}
          </PrimaryButton>
        </VtPanel>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 300px)", gap: 12 }} className="vt-contacts-grid">
        <VtPanel title="Directory">
          {visible.length === 0 ? <VtEmpty label="No contacts in this filter" /> : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {visible.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                style={{
                  textAlign: "left",
                  borderRadius: 12,
                  border: `1px solid ${selectedId === c.id ? cockpitColors.accent : cockpitColors.panelBorder}`,
                  background: selectedId === c.id
                    ? "linear-gradient(165deg, #ecfdf5, #fff)"
                    : "linear-gradient(180deg, #fff, #fafaf9)",
                  padding: 12,
                  cursor: "pointer",
                  borderLeft: `3px solid ${cockpitColors.accent}`,
                  font: "inherit",
                }}
              >
                <div style={{ fontWeight: 800 }}>{c.name}</div>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: cockpitColors.accent, marginTop: 4 }}>
                  {c.kind || "lead"}
                </div>
                {c.email ? <div style={{ fontSize: 12, color: cockpitColors.textSecondary, marginTop: 6, fontWeight: 600 }}>{c.email}</div> : null}
              </button>
            ))}
          </div>
        </VtPanel>

        <VtPanel title="Intel">
          {selected ? (
            <div style={{ display: "grid", gap: 10 }}>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" style={vtInputStyle} />
              <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" style={vtInputStyle} />
              <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone" style={vtInputStyle} />
              <select value={editKind} onChange={(e) => setEditKind(e.target.value)} style={vtInputStyle}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} style={vtInputStyle} />
              <PrimaryButton onClick={() => void saveSelected()} disabled={busy}>Save</PrimaryButton>
              <PrimaryButton
                onClick={() => void runSocialScreen()}
                disabled={busy || !editName.trim()}
              >
                {busy ? "…" : "Run social background screen"}
              </PrimaryButton>
              <SecondaryButton href={`/b/${encodeURIComponent(businessId)}/people/${encodeURIComponent(selected.partyId ?? selected.id)}`}>
                Open person
              </SecondaryButton>
              <SecondaryButton onClick={() => void deleteSelected()} disabled={busy}>Remove</SecondaryButton>
              <SecondaryButton href={`/b/${encodeURIComponent(businessId)}/pipelines`}>Pipelines</SecondaryButton>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
                  Boards
                </div>
                {relatedCards.length === 0 ? (
                  <div style={{ marginTop: 6, fontSize: 13, color: cockpitColors.textMuted, fontWeight: 700 }}>Not on a board</div>
                ) : (
                  relatedCards.map((c) => (
                    <div key={c.id} style={{ marginTop: 6, padding: 10, borderRadius: 10, border: `1px solid ${cockpitColors.panelBorder}`, background: "#fff" }}>
                      <div style={{ fontWeight: 800 }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: cockpitColors.textSecondary }}>{c.pipelineName} · {c.stageLabel}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <VtEmpty label="Select a contact" />
          )}
        </VtPanel>
      </div>

      {error ? <p style={{ color: cockpitColors.critical, fontWeight: 800 }}>{error}</p> : null}
      <style>{`
        @media (max-width: 900px) {
          .vt-contacts-grid, .vt-people-compose { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </VtPage>
  );
}

const dockBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(0,0,0,0.22)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  cursor: "pointer",
} as const;
