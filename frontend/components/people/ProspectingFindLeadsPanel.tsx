"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import {
  VtPanel,
  VtStatusChip,
  vtInputStyle,
} from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

type Pipeline = { id: string; name: string; stages: Array<{ id: string; label: string }> };

type RankedContact = {
  value: string;
  rank?: number;
  reason?: string | null;
  source?: string | null;
};

type FieldMeta = {
  value?: string | null;
  reason?: string | null;
  source?: string | null;
  rank?: number | null;
};

type Candidate = {
  id: string;
  status: string;
  companyName: string;
  website?: string | null;
  overview?: string | null;
  sizeEstimate?: string | null;
  sizeEstimated?: boolean;
  decisionMakerName?: string | null;
  decisionMakerTitle?: string | null;
  email?: FieldMeta;
  phone?: FieldMeta;
  phones?: RankedContact[];
  emails?: RankedContact[];
  sources?: string[];
  duplicateOfContactId?: string | null;
  acceptedContactId?: string | null;
};

type Run = {
  id: string;
  status: string;
  candidates: Candidate[];
  error?: string | null;
  criteria?: { pipelineId?: string | null; stageId?: string | null };
};

function rankedList(list: RankedContact[] | undefined, primary?: FieldMeta | null): RankedContact[] {
  if (Array.isArray(list) && list.length) {
    return [...list].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  }
  if (primary?.value) return [{ value: primary.value, rank: 1, reason: primary.reason }];
  return [];
}

function RankedContacts({
  label,
  list,
  primary,
}: {
  label: string;
  list?: RankedContact[];
  primary?: FieldMeta | null;
}) {
  const rows = rankedList(list, primary);
  if (!rows.length) {
    return <span style={{ color: cockpitColors.textMuted, fontSize: 12 }}>{label}: —</span>;
  }
  if (rows.length === 1) {
    return (
      <div style={{ fontSize: 13, fontWeight: 650 }}>
        {label}: {rows[0].value}
        {rows[0].reason ? (
          <span style={{ color: cockpitColors.textMuted, fontWeight: 600 }}> · {rows[0].reason}</span>
        ) : null}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: cockpitColors.textSecondary }}>
        {label}s (best first)
      </div>
      {rows.map((row) => (
        <div key={`${label}-${row.value}`} style={{ fontSize: 13, fontWeight: 650 }}>
          {row.rank ?? ""}. {row.value}
          {row.reason ? (
            <span style={{ color: cockpitColors.textMuted, fontWeight: 600 }}> · {row.reason}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function ProspectingFindLeadsPanel({
  businessId,
  open,
  onClose,
  onAccepted,
}: {
  businessId: string;
  open: boolean;
  onClose: () => void;
  onAccepted?: () => void;
}) {
  const [step, setStep] = useState<"criteria" | "results">("criteria");
  const [industry, setIndustry] = useState("");
  const [geo, setGeo] = useState("");
  const [keywords, setKeywords] = useState("");
  const [titles, setTitles] = useState("Owner, Practice Manager, Founder");
  const [companySizeBand, setCompanySizeBand] = useState("unknown");
  const [maxLeads, setMaxLeads] = useState(10);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caps, setCaps] = useState<{ maxRunsPerDay?: number; maxLeadsPerRun?: number } | null>(null);

  const stages = useMemo(
    () => pipelines.find((p) => p.id === pipelineId)?.stages ?? [],
    [pipelines, pipelineId],
  );

  const loadPipelines = useCallback(async () => {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/pipelines`);
    const data = await res.json().catch(() => ({}));
    const list = (data.pipelines ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      stages: (p.stages ?? []).map((s: any) => ({ id: s.id, label: s.label })),
    }));
    setPipelines(list);
    if (!pipelineId && list[0]) {
      setPipelineId(list[0].id);
      setStageId(list[0].stages?.[0]?.id ?? "");
    }
  }, [businessId, pipelineId]);

  useEffect(() => {
    if (!open) return;
    setStep("criteria");
    setError(null);
    setRun(null);
    setSelected(new Set());
    void loadPipelines().catch(() => undefined);
    void (async () => {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/prospecting/runs`);
      const data = await res.json().catch(() => ({}));
      if (data.caps) setCaps(data.caps);
    })();
  }, [open, businessId, loadPipelines]);

  useEffect(() => {
    if (!stages.length) return;
    if (!stages.some((s) => s.id === stageId)) {
      setStageId(stages[0]?.id ?? "");
    }
  }, [stages, stageId]);

  const pendingCandidates = useMemo(
    () => (run?.candidates ?? []).filter((c) => c.status === "pending"),
    [run],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllPending() {
    setSelected(new Set(pendingCandidates.map((c) => c.id)));
  }

  async function startRun() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/prospecting/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          industry,
          geo,
          keywords,
          titles,
          companySizeBand,
          maxLeads,
          pipelineId: pipelineId || null,
          stageId: stageId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Prospecting run failed");
      }
      setRun(data.run);
      setCaps(data.caps ?? caps);
      const pending = (data.run?.candidates ?? [])
        .filter((c: Candidate) => c.status === "pending")
        .map((c: Candidate) => c.id);
      setSelected(new Set(pending));
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function acceptSelected() {
    if (!run?.id || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/prospecting/runs/${encodeURIComponent(run.id)}/accept`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            candidateIds: [...selected],
            pipelineId: pipelineId || null,
            stageId: stageId || null,
            addToPipeline: true,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Accept failed");
      setRun(data.run);
      setSelected(new Set());
      onAccepted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setBusy(false);
    }
  }

  async function rejectSelected() {
    if (!run?.id || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/prospecting/runs/${encodeURIComponent(run.id)}/reject`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ candidateIds: [...selected] }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Reject failed");
      setRun(data.run);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <VtPanel title="Find leads · AI Prospecting">
      <div style={{ display: "grid", gap: 12 }}>
        <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: 13, fontWeight: 600 }}>
          Every lead includes a public phone, a name, and a short brief.
          Email only when found free in public search. Multiple phones/emails are listed best-first.
          Companies without a findable phone are skipped
          {caps?.maxLeadsPerRun ? ` (up to ${caps.maxLeadsPerRun}/run)` : ""}.
        </p>

        {error ? (
          <div style={{ color: "#b91c1c", fontWeight: 700, fontSize: 13 }}>{error}</div>
        ) : null}

        {step === "criteria" ? (
          <div style={{ display: "grid", gap: 10, maxWidth: 640 }}>
            <label style={labelStyle}>
              Industry
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. dental practices, HVAC contractors"
                style={vtInputStyle}
              />
            </label>
            <label style={labelStyle}>
              Location / geo
              <input
                value={geo}
                onChange={(e) => setGeo(e.target.value)}
                placeholder="e.g. Austin TX, remote US"
                style={vtInputStyle}
              />
            </label>
            <label style={labelStyle}>
              Keywords
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="optional, comma-separated"
                style={vtInputStyle}
              />
            </label>
            <label style={labelStyle}>
              Titles to find
              <input
                value={titles}
                onChange={(e) => setTitles(e.target.value)}
                style={vtInputStyle}
              />
            </label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ ...labelStyle, flex: "1 1 160px" }}>
                Company size (estimate)
                <select
                  value={companySizeBand}
                  onChange={(e) => setCompanySizeBand(e.target.value)}
                  style={vtInputStyle}
                >
                  <option value="unknown">Any / unknown</option>
                  <option value="1-10">1–10</option>
                  <option value="11-50">11–50</option>
                  <option value="51-200">51–200</option>
                  <option value="201-500">201–500</option>
                  <option value="500+">500+</option>
                </select>
              </label>
              <label style={{ ...labelStyle, flex: "0 0 120px" }}>
                Max leads
                <input
                  type="number"
                  min={1}
                  max={caps?.maxLeadsPerRun ?? 25}
                  value={maxLeads}
                  onChange={(e) => setMaxLeads(Number(e.target.value) || 10)}
                  style={vtInputStyle}
                />
              </label>
            </div>
            <label style={labelStyle}>
              Pipeline
              <select
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
                style={vtInputStyle}
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Stage
              <select value={stageId} onChange={(e) => setStageId(e.target.value)} style={vtInputStyle}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <PrimaryButton disabled={busy || (!industry.trim() && !keywords.trim())} onClick={() => void startRun()}>
                {busy ? "Researching…" : "Run research"}
              </PrimaryButton>
              <SecondaryButton disabled={busy} onClick={onClose}>Cancel</SecondaryButton>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <VtStatusChip
                label={(run?.status ?? "done").toUpperCase()}
                tone={run?.status === "completed" ? "live" : run?.status === "failed" ? "warn" : "neutral"}
              />
              <SecondaryButton disabled={busy} onClick={() => setStep("criteria")}>New search</SecondaryButton>
              <SecondaryButton disabled={busy || pendingCandidates.length === 0} onClick={selectAllPending}>
                Select pending
              </SecondaryButton>
              <PrimaryButton disabled={busy || selected.size === 0} onClick={() => void acceptSelected()}>
                Accept selected ({selected.size})
              </PrimaryButton>
              <SecondaryButton disabled={busy || selected.size === 0} onClick={() => void rejectSelected()}>
                Dismiss
              </SecondaryButton>
              <SecondaryButton disabled={busy} onClick={onClose}>Close</SecondaryButton>
            </div>

            {(run?.candidates ?? []).length === 0 ? (
              <p style={{ margin: 0, color: cockpitColors.textMuted, fontWeight: 650 }}>
                No candidates found. Try broader industry or geo.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {(run?.candidates ?? []).map((c) => {
                  const checked = selected.has(c.id);
                  const canSelect = c.status === "pending";
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: "grid",
                        gap: 6,
                        padding: 12,
                        borderRadius: 12,
                        border: `1px solid ${cockpitColors.panelBorder}`,
                        background: c.status === "accepted" ? "rgba(52,211,153,0.12)" : c.status === "rejected" ? cockpitColors.panelElevated : cockpitColors.panel,
                        opacity: c.status === "duplicate" ? 0.7 : 1,
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <input
                          type="checkbox"
                          disabled={!canSelect}
                          checked={checked}
                          onChange={() => toggle(c.id)}
                          style={{ marginTop: 4 }}
                        />
                        <div style={{ flex: 1, display: "grid", gap: 4 }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <strong style={{ fontSize: 15 }}>{c.companyName}</strong>
                            <VtStatusChip label={c.status.toUpperCase()} tone={c.status === "accepted" ? "live" : "neutral"} />
                            {c.sizeEstimate ? (
                              <span style={{ fontSize: 12, color: cockpitColors.textSecondary, fontWeight: 650 }}>
                                Size {c.sizeEstimate}{c.sizeEstimated ? " (est.)" : ""}
                              </span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 650 }}>
                            {c.decisionMakerName || "Decision-maker TBD"}
                            {c.decisionMakerTitle ? ` · ${c.decisionMakerTitle}` : ""}
                          </div>
                          {c.overview ? (
                            <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
                              {c.overview}
                            </p>
                          ) : null}
                          <RankedContacts label="Phone" list={c.phones} primary={c.phone} />
                          <RankedContacts label="Email" list={c.emails} primary={c.email} />
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
                            {c.website ? (
                              <a href={c.website} target="_blank" rel="noreferrer" style={{ color: cockpitColors.accent, fontWeight: 700 }}>
                                Website
                              </a>
                            ) : null}
                            {(c.sources ?? []).slice(0, 3).map((src) => (
                              <a key={src} href={src} target="_blank" rel="noreferrer" style={{ color: cockpitColors.textSecondary }}>
                                Source
                              </a>
                            ))}
                            {c.acceptedContactId ? (
                              <Link
                                href={`/b/${encodeURIComponent(businessId)}/people/${encodeURIComponent(c.acceptedContactId)}`}
                                style={{ color: cockpitColors.accent, fontWeight: 800 }}
                              >
                                Open person
                              </Link>
                            ) : null}
                            {c.duplicateOfContactId ? (
                              <span style={{ color: cockpitColors.textMuted, fontWeight: 650 }}>
                                Already in People
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </VtPanel>
  );
}

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  color: cockpitColors.textSecondary,
};
