function mapImportArtifactRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    sourceSystem: String(row.source_system),
    originalFilename: String(row.original_filename),
    storageKey: String(row.storage_key),
    contentHash: String(row.content_hash),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    uploadedByUserId: row.uploaded_by_user_id ? String(row.uploaded_by_user_id) : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function mapImportRunRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    artifactId: String(row.artifact_id),
    sourceSystem: String(row.source_system),
    profileId: row.profile_id ? String(row.profile_id) : null,
    status: String(row.status),
    contentHash: String(row.content_hash),
    columnMapping: row.column_mapping ?? null,
    stats: row.stats ?? {},
    planSummary: row.plan_summary ?? null,
    committedAt: row.committed_at ? String(row.committed_at) : null,
    committedByUserId: row.committed_by_user_id ? String(row.committed_by_user_id) : null,
    lastCommittedRow: row.last_committed_row ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

function mapImportRunRowResultRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    importRunId: String(row.import_run_id),
    rowNumber: Number(row.row_number),
    externalId: row.external_id ? String(row.external_id) : null,
    resolvedPartyId: row.resolved_party_id ? String(row.resolved_party_id) : null,
    matchTier: row.match_tier ? String(row.match_tier) : null,
    plannedActions: row.planned_actions ?? [],
    outcomeStatus: String(row.outcome_status),
    warnings: row.warnings ?? [],
    errors: row.errors ?? [],
    rawNormalized: row.raw_normalized ?? null,
    rawUnmapped: row.raw_unmapped ?? null,
    commitStatus: row.commit_status ? String(row.commit_status) : "pending",
    commitAttempts: Number(row.commit_attempts ?? 0),
    committedAt: row.committed_at ? (row.committed_at instanceof Date ? row.committed_at.toISOString() : String(row.committed_at)) : null,
    commitError: row.commit_error ?? null,
    commitResult: row.commit_result ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export { mapImportArtifactRow, mapImportRunRow, mapImportRunRowResultRow };
