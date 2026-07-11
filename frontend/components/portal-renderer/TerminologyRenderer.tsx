"use client";

/**
 * Terminology Renderer — display labels only; never mutates canonical types.
 */
export function TerminologyRenderer({
  label,
  terminology,
  entityKey,
}: {
  label: string;
  terminology?: Record<string, any> | null;
  entityKey?: string | null;
}) {
  return <>{resolveTerminologyLabel(label, terminology, entityKey)}</>;
}

export function resolveTerminologyLabel(
  label: string,
  terminology?: Record<string, any> | null,
  entityKey?: string | null,
) {
  if (!terminology) return label;
  const pages = terminology.pages ?? terminology.presentation?.pages ?? {};
  const entities = terminology.entityLabels ?? terminology.presentation?.entityLabels ?? {};
  if (entityKey && entities[entityKey]) return String(entities[entityKey]);
  if (pages[label]) return String(pages[label]);
  if (entities[label]) return String(entities[label]);
  return label;
}
