"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import {
  VtDock,
  VtEmpty,
  VtHero,
  VtPage,
  VtPanel,
  VtStatusChip,
  vtInputStyle,
} from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

type Stage = { id: string; label: string; order: number };
type Card = {
  id: string;
  title: string;
  stageId: string;
  contactId?: string;
  value?: number;
};
type Pipeline = {
  id: string;
  name: string;
  stages: Stage[];
  cards: Card[];
};
type Contact = { id: string; name: string; email?: string; kind?: string };

function isTerminalStage(stage: Stage) {
  const key = `${stage.id} ${stage.label}`.toLowerCase();
  return /\bwon\b/.test(key) || /\blost\b/.test(key);
}

export default function PipelinesExperience({ businessId }: { businessId: string }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragStageId, setDragStageId] = useState<string | null>(null);
  const [editingPipeline, setEditingPipeline] = useState(false);
  const [pipelineDraft, setPipelineDraft] = useState("");
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stageDraft, setStageDraft] = useState("");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardDraft, setCardDraft] = useState("");
  const [cardContactId, setCardContactId] = useState("");
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [busy, setBusy] = useState(false);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const stageNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cardNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(async () => {
    const [pipeRes, contactRes] = await Promise.all([
      fetch(`/api/businesses/${encodeURIComponent(businessId)}/pipelines`),
      fetch(`/api/businesses/${encodeURIComponent(businessId)}/contacts`),
    ]);
    const data = await pipeRes.json().catch(() => ({}));
    const contactData = await contactRes.json().catch(() => ({}));
    if (!pipeRes.ok || !data.ok) throw new Error(data.error ?? "Could not load pipelines");
    setPipelines(data.pipelines ?? []);
    setContacts(contactData.contacts ?? []);
    setActiveId((prev) => {
      if (prev && (data.pipelines ?? []).some((p: Pipeline) => p.id === prev)) return prev;
      return data.pipelines?.[0]?.id ?? null;
    });
  }, [businessId]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [load]);

  const pipeline = useMemo(
    () => pipelines.find((p) => p.id === activeId) ?? pipelines[0] ?? null,
    [pipelines, activeId],
  );

  useEffect(() => {
    if (!editingStageId) return;
    const id = editingStageId;
    const t = window.setTimeout(() => {
      stageNodeRefs.current[id]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, 40);
    return () => window.clearTimeout(t);
  }, [editingStageId, pipeline?.stages?.length]);

  useEffect(() => {
    if (!editingCardId) return;
    const id = editingCardId;
    const t = window.setTimeout(() => {
      cardNodeRefs.current[id]?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
    }, 40);
    return () => window.clearTimeout(t);
  }, [editingCardId, pipeline?.cards?.length]);

  const openCount = useMemo(() => {
    if (!pipeline) return 0;
    const terminalIds = new Set(
      (pipeline.stages ?? []).filter(isTerminalStage).map((s) => s.id),
    );
    return (pipeline.cards ?? []).filter((c) => !terminalIds.has(c.stageId)).length;
  }, [pipeline]);

  async function post(body: Record<string, unknown>) {
    let res: Response;
    try {
      res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/pipelines`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Network error — is the disk full?");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? `Update failed (${res.status})`);
    }
    setPipelines(data.pipelines ?? []);
    return data as {
      ok: true;
      pipelines: Pipeline[];
      createdPipelineId?: string | null;
      createdStageId?: string | null;
      createdCardId?: string | null;
    };
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function focusCardForEdit(cardId: string, draft = "", contactId = "") {
    setEditingCardId(cardId);
    setCardDraft(draft);
    setCardContactId(contactId);
  }

  async function addOpportunity(stageId?: string) {
    if (!pipeline) return;
    const stages = (pipeline.stages ?? []).slice().sort((a, b) => a.order - b.order);
    const targetStageId = stageId || stages[0]?.id;
    if (!targetStageId) {
      setError("Add a stage first.");
      return;
    }
    await run(async () => {
      const data = await post({
        action: "add_card",
        pipelineId: pipeline.id,
        card: {
          title: "",
          stageId: targetStageId,
          contactId: cardContactId || undefined,
        },
      });
      stageNodeRefs.current[targetStageId]?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
      if (data.createdCardId) {
        focusCardForEdit(data.createdCardId, "", cardContactId);
      }
    });
  }

  async function commitRenameCard() {
    if (!pipeline || !editingCardId) return;
    const cardId = editingCardId;
    const card = (pipeline.cards ?? []).find((c) => c.id === cardId);
    const next = cardDraft.trim() || "Untitled";
    const nextContactId = cardContactId;
    setEditingCardId(null);
    if (!card) return;
    if (next === card.title && String(card.contactId ?? "") === String(nextContactId ?? "")) return;
    await run(async () => {
      await post({
        action: "rename_card",
        pipelineId: pipeline.id,
        card: {
          id: cardId,
          title: next,
          stageId: card.stageId,
          contactId: nextContactId || "",
          value: card.value,
        },
      });
    });
  }

  async function onDrop(stageId: string) {
    if (!pipeline || !dragCardId) return;
    await run(async () => {
      await post({
        action: "move_card",
        pipelineId: pipeline.id,
        cardId: dragCardId,
        stageId,
      });
    });
    setDragCardId(null);
  }

  function startRenamePipeline() {
    if (!pipeline) return;
    setPipelineDraft(pipeline.name);
    setEditingPipeline(true);
  }

  async function commitRenamePipeline() {
    if (!pipeline) return;
    const next = pipelineDraft.trim();
    setEditingPipeline(false);
    if (!next || next === pipeline.name) return;
    await run(async () => {
      await post({ action: "rename_pipeline", pipelineId: pipeline.id, name: next });
    });
  }

  function startRenameStage(stage: Stage) {
    setEditingStageId(stage.id);
    setStageDraft(stage.label);
  }

  async function commitRenameStage() {
    if (!pipeline || !editingStageId) return;
    const stageId = editingStageId;
    const next = stageDraft.trim() || "Untitled";
    const prev = pipeline.stages.find((s) => s.id === stageId)?.label;
    setEditingStageId(null);
    if (next === prev) return;
    await run(async () => {
      await post({
        action: "rename_stage",
        pipelineId: pipeline.id,
        stageId,
        label: next,
      });
    });
  }

  function focusStageForEdit(stageId: string, draft = "") {
    setEditingStageId(stageId);
    setStageDraft(draft);
  }

  async function createNewPipeline() {
    const name = newPipelineName.trim() || "New pipeline";
    await run(async () => {
      const data = await post({ action: "create_pipeline", name });
      if (data.createdPipelineId) setActiveId(data.createdPipelineId);
      setNewPipelineName("");
      setNewPipelineOpen(false);
    });
  }

  async function removeActivePipeline() {
    if (!pipeline || pipelines.length <= 1) return;
    if (!window.confirm(`Delete pipeline “${pipeline.name}”? Cards in it will be removed.`)) return;
    const removingId = pipeline.id;
    await run(async () => {
      const data = await post({ action: "delete_pipeline", pipelineId: removingId });
      const remaining = (data.pipelines ?? []).filter((p) => p.id !== removingId);
      setActiveId(remaining[0]?.id ?? data.pipelines?.[0]?.id ?? null);
      setEditingStageId(null);
      setEditingCardId(null);
    });
  }

  async function addStage() {
    if (!pipeline) return;
    await run(async () => {
      const data = await post({
        action: "add_stage",
        pipelineId: pipeline.id,
        label: "",
      });
      const stageId = data.createdStageId;
      if (stageId) {
        focusStageForEdit(stageId, "");
      }
    });
  }

  async function reorderStage(stageId: string, toIndex: number) {
    if (!pipeline) return;
    await run(async () => {
      await post({
        action: "reorder_stages",
        pipelineId: pipeline.id,
        stageId,
        toIndex,
      });
    });
  }

  async function onStageDrop(targetStageId: string, targetIndex: number) {
    if (dragStageId) {
      if (dragStageId !== targetStageId) {
        await reorderStage(dragStageId, targetIndex);
      }
      setDragStageId(null);
      return;
    }
    if (dragCardId) {
      await onDrop(targetStageId);
    }
  }

  async function removeOpportunity(card: Card) {
    if (!pipeline) return;
    const label = card.title.trim() || "Untitled";
    if (!window.confirm(`Delete opportunity “${label}”?`)) return;
    await run(async () => {
      if (editingCardId === card.id) setEditingCardId(null);
      await post({
        action: "delete_card",
        pipelineId: pipeline.id,
        cardId: card.id,
      });
    });
  }

  async function removeStage(stage: Stage) {
    if (!pipeline || pipeline.stages.length <= 1) return;
    const cardsInStage = (pipeline.cards ?? []).filter((c) => c.stageId === stage.id).length;
    const msg = cardsInStage
      ? `Remove “${stage.label}”? ${cardsInStage} card(s) move to the first stage.`
      : `Remove stage “${stage.label}”?`;
    if (!window.confirm(msg)) return;
    await run(async () => {
      await post({
        action: "remove_stage",
        pipelineId: pipeline.id,
        stageId: stage.id,
      });
    });
  }

  return (
    <VtPage maxWidth="none">
      <VtHero
        eyebrow="Mission · Pipelines"
        title={(
          editingPipeline ? (
            <input
              autoFocus
              value={pipelineDraft}
              onChange={(e) => setPipelineDraft(e.target.value)}
              onBlur={() => void commitRenamePipeline()}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commitRenamePipeline();
                }
                if (e.key === "Escape") {
                  setEditingPipeline(false);
                }
              }}
              aria-label="Pipeline name"
              style={heroTitleInput}
            />
          ) : (
            <button type="button" onClick={startRenamePipeline} style={heroTitleBtn} title="Click to rename">
              {pipeline?.name ?? "Pipelines"}
              <span style={editHint}>edit</span>
            </button>
          )
        )}
        right={<VtStatusChip label={`${openCount} OPEN`} tone={openCount > 0 ? "live" : "neutral"} />}
      >
        <VtDock>
          <button type="button" onClick={() => setNewPipelineOpen((v) => !v)} style={dockBtnStyle} disabled={busy}>
            {newPipelineOpen ? "Close" : "+ Pipeline"}
          </button>
          <button type="button" onClick={() => void addStage()} style={dockBtnStyle} disabled={busy || !pipeline}>
            + Stage
          </button>
          <button
            type="button"
            onClick={() => void addOpportunity()}
            style={dockBtnStyle}
            disabled={busy || !pipeline || !(pipeline.stages?.length)}
            title={!(pipeline?.stages?.length) ? "Add a stage first" : undefined}
          >
            + Opportunity
          </button>
        </VtDock>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "rgba(255,255,255,0.72)", fontWeight: 650, maxWidth: 720 }}>
          + Stage and + Opportunity drop straight onto the board — type the name in place.
          Drag the ⋮⋮ handle to reorder stages; drag cards between stages.
        </p>
      </VtHero>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {pipelines.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setActiveId(p.id);
              setEditingPipeline(false);
              setEditingStageId(null);
              setEditingCardId(null);
            }}
            style={{
              borderRadius: 999,
              border: p.id === pipeline?.id ? `2px solid ${cockpitColors.accent}` : `1px solid ${cockpitColors.panelBorder}`,
              padding: "7px 14px",
              fontWeight: 900,
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              background: p.id === pipeline?.id
                ? "linear-gradient(180deg, #0f766e, #115e59)"
                : "#fff",
              color: p.id === pipeline?.id ? "#fff" : cockpitColors.textPrimary,
              cursor: "pointer",
            }}
          >
            {p.name}
          </button>
        ))}
        {pipelines.length > 1 && pipeline ? (
          <SecondaryButton onClick={() => void removeActivePipeline()} disabled={busy}>
            Delete pipeline
          </SecondaryButton>
        ) : null}
      </div>

      {newPipelineOpen ? (
        <VtPanel title="New pipeline">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <input
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              placeholder="e.g. Tryouts, Sponsorships"
              style={{ ...vtInputStyle, flex: "1 1 220px" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createNewPipeline();
              }}
            />
            <PrimaryButton onClick={() => void createNewPipeline()} disabled={busy}>Create</PrimaryButton>
          </div>
        </VtPanel>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {pipeline && pipeline.stages.length === 0 ? (
          <VtPanel title="Build this board">
            <p style={{ margin: 0, color: cockpitColors.textSecondary, fontWeight: 650 }}>
              This pipeline has no stages yet. Add stages (e.g. Applied, Interview, Signed), then create opportunities.
            </p>
            <div style={{ marginTop: 12 }}>
              <PrimaryButton onClick={() => void addStage()} disabled={busy}>+ Add first stage</PrimaryButton>
            </div>
          </VtPanel>
        ) : null}

        {pipeline && pipeline.stages.length > 0 ? (
          <div
            ref={boardScrollRef}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${pipeline.stages.length}, minmax(200px, 1fr))`,
              gap: 10,
              overflowX: "auto",
              paddingBottom: 4,
              scrollBehavior: "smooth",
            }}
          >
            {pipeline.stages
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((stage, stageIndex) => {
                const cards = (pipeline.cards ?? []).filter((c) => c.stageId === stage.id);
                const isStageDragOver = dragStageId && dragStageId !== stage.id;
                return (
                  <div
                    key={stage.id}
                    ref={(node) => {
                      stageNodeRefs.current[stage.id] = node;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = dragStageId ? "move" : "move";
                    }}
                    onDrop={() => void onStageDrop(stage.id, stageIndex)}
                    style={{
                      minHeight: 340,
                      borderRadius: 14,
                      border: `2px solid ${
                        dragStageId === stage.id
                          ? cockpitColors.accent
                          : isStageDragOver
                            ? "rgba(15,118,110,0.35)"
                            : cockpitColors.panelBorder
                      }`,
                      background: "linear-gradient(180deg, #f5f5f4 0%, #ebe8e2 100%)",
                      padding: 10,
                      display: "grid",
                      gap: 8,
                      alignContent: "start",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
                      opacity: dragStageId === stage.id ? 0.7 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, flex: 1 }}>
                        <span
                          draggable
                          title="Drag to reorder stage"
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", stage.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragStageId(stage.id);
                            setDragCardId(null);
                          }}
                          onDragEnd={() => setDragStageId(null)}
                          style={stageDragHandle}
                        >
                          ⋮⋮
                        </span>
                        {editingStageId === stage.id ? (
                          <InlineRename
                            value={stageDraft}
                            onChange={setStageDraft}
                            onCommit={() => void commitRenameStage()}
                            onCancel={() => {
                              if (!stage.label.trim()) {
                                void commitRenameStage();
                                return;
                              }
                              setEditingStageId(null);
                            }}
                            ariaLabel="Stage name"
                            placeholder="Name this stage"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startRenameStage(stage)}
                            title="Click to rename stage"
                            style={stageTitleBtn}
                          >
                            {stage.label.trim() || "Untitled"}
                          </button>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <span style={countBadge}>{cards.length}</span>
                        {pipeline.stages.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => void removeStage(stage)}
                            title="Remove stage"
                            style={stageRemoveBtn}
                            disabled={busy}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {cards.length === 0 && editingCardId == null ? (
                      <button
                        type="button"
                        onClick={() => void addOpportunity(stage.id)}
                        style={{
                          border: `1.5px dashed ${cockpitColors.panelBorder}`,
                          borderRadius: 12,
                          background: "transparent",
                          padding: "18px 12px",
                          color: cockpitColors.textMuted,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        + Opportunity
                      </button>
                    ) : null}
                    {cards.map((card) => {
                      const contact = contacts.find((c) => c.id === card.contactId);
                      const isEditing = editingCardId === card.id;
                      return (
                        <div
                          key={card.id}
                          ref={(node) => {
                            cardNodeRefs.current[card.id] = node;
                          }}
                          draggable={!isEditing}
                          onDragStart={(e) => {
                            if (isEditing) {
                              e.preventDefault();
                              return;
                            }
                            e.dataTransfer.setData("text/plain", card.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragCardId(card.id);
                            setDragStageId(null);
                          }}
                          onDragEnd={() => setDragCardId(null)}
                          style={{
                            borderRadius: 12,
                            border: `1px solid ${isEditing ? cockpitColors.accent : "rgba(28,25,23,0.1)"}`,
                            background: "linear-gradient(165deg, #fff, #f0fdfa)",
                            padding: "11px 12px",
                            cursor: isEditing ? "text" : "grab",
                            boxShadow: "0 6px 16px rgba(28,25,23,0.06)",
                            borderLeft: `3px solid ${cockpitColors.accent}`,
                            display: "grid",
                            gap: 6,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {isEditing ? (
                                <div style={{ display: "grid", gap: 6 }}>
                                  <InlineRename
                                    value={cardDraft}
                                    onChange={setCardDraft}
                                    onCommit={() => void commitRenameCard()}
                                    onCancel={() => {
                                      if (!card.title.trim()) {
                                        void commitRenameCard();
                                        return;
                                      }
                                      setEditingCardId(null);
                                    }}
                                    ariaLabel="Opportunity name"
                                    placeholder="Name this opportunity"
                                    uppercase={false}
                                  />
                                  <select
                                    value={cardContactId}
                                    onChange={(e) => setCardContactId(e.target.value)}
                                    onBlur={() => void commitRenameCard()}
                                    style={{
                                      width: "100%",
                                      borderRadius: 8,
                                      border: `1px solid ${cockpitColors.panelBorder}`,
                                      padding: "6px 8px",
                                      fontSize: 12,
                                      fontWeight: 650,
                                      background: "#fff",
                                    }}
                                    aria-label="Linked contact"
                                  >
                                    <option value="">No contact linked</option>
                                    {contacts.map((c) => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => focusCardForEdit(card.id, card.title, card.contactId ?? "")}
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    padding: 0,
                                    margin: 0,
                                    font: "inherit",
                                    fontWeight: 800,
                                    color: cockpitColors.textPrimary,
                                    cursor: "text",
                                    textAlign: "left",
                                    width: "100%",
                                  }}
                                >
                                  {card.title.trim() || "Untitled"}
                                </button>
                              )}
                              {!isEditing && contact ? (
                                <div style={{ fontSize: 12, color: cockpitColors.textSecondary, marginTop: 4, fontWeight: 600 }}>
                                  {contact.name}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void removeOpportunity(card);
                              }}
                              title="Delete opportunity"
                              style={stageRemoveBtn}
                              disabled={busy}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
          </div>
        ) : !pipeline ? (
          <VtEmpty label="No pipeline yet — create one with + Pipeline" />
        ) : null}
      </div>

      {error ? <p style={{ color: cockpitColors.critical, fontWeight: 800 }}>{error}</p> : null}
      <style>{`
        @media (max-width: 900px) {
          .vt-pipe-compose { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </VtPage>
  );
}

function InlineRename({
  value,
  onChange,
  onCommit,
  onCancel,
  ariaLabel,
  placeholder,
  uppercase = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  ariaLabel: string;
  placeholder?: string;
  uppercase?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      style={{
        ...vtInputStyle,
        fontSize: uppercase ? 12 : 15,
        fontWeight: 900,
        letterSpacing: uppercase ? "0.06em" : "-0.01em",
        textTransform: uppercase ? "uppercase" : "none",
        padding: "6px 8px",
        minWidth: 0,
        width: "100%",
      }}
    />
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

const heroTitleBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  fontWeight: 900,
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "baseline",
  gap: 10,
  textAlign: "left",
};

const heroTitleInput: CSSProperties = {
  ...vtInputStyle,
  fontSize: "inherit",
  fontWeight: 900,
  color: cockpitColors.textPrimary,
  maxWidth: "min(100%, 420px)",
  width: "100%",
};

const editHint: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.55)",
};

const stageDragHandle: CSSProperties = {
  cursor: "grab",
  color: cockpitColors.textMuted,
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: "-0.08em",
  padding: "2px 4px",
  userSelect: "none",
  flexShrink: 0,
  lineHeight: 1,
};

const stageTitleBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  margin: 0,
  padding: "2px 0",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: cockpitColors.textPrimary,
  cursor: "pointer",
  textAlign: "left",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const countBadge: CSSProperties = {
  minWidth: 24,
  height: 24,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: cockpitColors.accent,
  color: "#fff",
  fontSize: 11,
  fontWeight: 900,
};

const stageRemoveBtn: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 8,
  border: `1px solid ${cockpitColors.panelBorder}`,
  background: "#fff",
  color: cockpitColors.textMuted,
  fontWeight: 900,
  fontSize: 16,
  lineHeight: 1,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
