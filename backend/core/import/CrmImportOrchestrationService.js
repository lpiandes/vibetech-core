import crypto from "node:crypto";

import { IMPORT_RUN_STATUSES } from "./ImportRunStatus.js";
import { createImportSourceDescriptor } from "./ImportSourceDescriptor.js";
import {
  resolveImportProfile,
  buildEffectiveColumnMap,
  suggestColumnMapFromHeaders,
} from "./ImportProfile.js";
import { CsvImportParser } from "./parsers/CsvImportParser.js";
import { CanonicalStateReader } from "./CanonicalStateReader.js";
import { CrmImportDryRunExecutor } from "./CrmImportDryRunExecutor.js";
import { CrmImportCommitExecutor } from "./CrmImportCommitExecutor.js";
import { createImportArtifactStore } from "./storage/ImportArtifactStore.js";
import { importRunRepository } from "./persistence/ImportRunRepository.js";

export class CrmImportOrchestrationService {
  constructor({
    repository = importRunRepository,
    artifactStore = createImportArtifactStore(),
    parser = new CsvImportParser(),
    dryRunExecutor = new CrmImportDryRunExecutor(),
    commitExecutor = new CrmImportCommitExecutor(),
  } = {}) {
    this.repository = repository;
    this.artifactStore = artifactStore;
    this.parser = parser;
    this.dryRunExecutor = dryRunExecutor;
    this.commitExecutor = commitExecutor;
  }

  /**
   * @param {{ businessId: string, userId: string|null, buffer: Buffer, filename: string, mimeType: string, sourceSystem: string, profileId?: string, installationResult: object }} args
   */
  async upload({
    businessId,
    userId,
    buffer,
    filename,
    mimeType,
    sourceSystem,
    profileId,
    installationResult,
  } = {}) {
    const { artifact, contentHash } = await this.artifactStore.uploadArtifact({
      businessId,
      userId,
      buffer,
      filename,
      mimeType,
      sourceSystem,
    });

    const profile = resolveImportProfile({ installationResult, sourceSystem, profileId });

    const importRun = await this.repository.createRun({
      businessId,
      artifactId: artifact.id,
      sourceSystem,
      contentHash,
      status: IMPORT_RUN_STATUSES.UPLOADED,
      profileId: profile?.profileId ?? null,
    });

    return {
      importRun,
      sourceDescriptor: createImportSourceDescriptor({
        workspaceId: businessId,
        sourceSystem,
        artifactId: artifact.id,
        filename: artifact.originalFilename,
        contentHash,
        mimeType: artifact.mimeType,
        uploadedAt: artifact.createdAt,
      }),
    };
  }

  /** @param {{ businessId: string, runId: string, installationResult: object }} args */
  async inspect({ businessId, runId, installationResult } = {}) {
    const importRun = await this.requireRun(businessId, runId);
    const artifact = await this.requireArtifact(businessId, importRun.artifactId);
    const buffer = await this.artifactStore.readArtifactBuffer({ businessId, artifact });
    const parsed = await this.parser.parse(buffer, { sampleLimit: 5 });

    const profile = resolveImportProfile({
      installationResult,
      sourceSystem: importRun.sourceSystem,
      profileId: importRun.profileId,
    });

    const suggestedColumnMap = suggestColumnMapFromHeaders(parsed.columns, profile);

    await this.repository.updateRun(runId, businessId, {
      status: IMPORT_RUN_STATUSES.INSPECTED,
      columnMapping: importRun.columnMapping ?? suggestedColumnMap,
    });

    return {
      columns: parsed.columns,
      sampleRows: parsed.sampleRows,
      rowCount: parsed.rowCount,
      detectedProfile: profile
        ? { profileId: profile.profileId, suggestedColumnMap }
        : null,
      status: IMPORT_RUN_STATUSES.INSPECTED,
    };
  }

  /**
   * @param {{ businessId: string, runId: string, profileId?: string, columnMapping?: object, installationResult: object }} args
   */
  async mapColumns({ businessId, runId, profileId, columnMapping, installationResult } = {}) {
    const importRun = await this.requireRun(businessId, runId);
    const profile = resolveImportProfile({
      installationResult,
      sourceSystem: importRun.sourceSystem,
      profileId: profileId ?? importRun.profileId,
    });
    if (!profile) {
      const err = new Error("Import profile not found for this business package.");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const effectiveMap = buildEffectiveColumnMap({ profile, columnMapping });

    const updated = await this.repository.updateRun(runId, businessId, {
      status: IMPORT_RUN_STATUSES.MAPPED,
      profileId: profile.profileId,
      columnMapping: effectiveMap,
    });

    return { importRun: updated };
  }

  /**
   * @param {{ businessId: string, runId: string, stack: object, installationResult: object, rowLimit?: number|null }} args
   */
  async dryRun({ businessId, runId, stack, installationResult, rowLimit = null } = {}) {
    const importRun = await this.requireRun(businessId, runId);
    if (importRun.status !== IMPORT_RUN_STATUSES.MAPPED && importRun.status !== IMPORT_RUN_STATUSES.DRY_RUN_COMPLETE) {
      const err = new Error("Import run must be mapped before dry run.");
      err.code = "INVALID_STATE";
      throw err;
    }

    const artifact = await this.requireArtifact(businessId, importRun.artifactId);
    const buffer = await this.artifactStore.readArtifactBuffer({ businessId, artifact });
    const parsed = await this.parser.parse(buffer);
    const rows = rowLimit ? parsed.rows.slice(0, Number(rowLimit)) : parsed.rows;

    const profile = resolveImportProfile({
      installationResult,
      sourceSystem: importRun.sourceSystem,
      profileId: importRun.profileId,
    });
    const columnMap = importRun.columnMapping ?? profile?.columnMap ?? {};

    const reader = new CanonicalStateReader({ stack });
    const canonicalSnapshot = reader.readSnapshot();

    const { dryRunResult, rowResults } = this.dryRunExecutor.execute({
      parsedRows: rows,
      columnMap,
      profile,
      sourceSystem: importRun.sourceSystem,
      importRunId: runId,
      canonicalSnapshot,
      installationResult,
    });

    await this.repository.upsertRowResults(runId, rowResults);

    const updated = await this.repository.updateRun(runId, businessId, {
      status: IMPORT_RUN_STATUSES.DRY_RUN_COMPLETE,
      stats: dryRunResult.stats,
      planSummary: dryRunResult.planSummary,
    });

    return { dryRun: { ...dryRunResult, importRunId: runId }, importRun: updated };
  }

  async getRun(businessId, runId) {
    return this.requireRun(businessId, runId);
  }

  /**
   * @param {{ businessId: string, runId: string, stack: object, installationResult: object, userId?: string|null, allowReviewCommit?: boolean, nowISO?: string, persistence?: object }} args
   */
  async commit({ businessId, runId, stack, installationResult, userId = null, allowReviewCommit = false, nowISO = new Date().toISOString(), persistence } = {}) {
    const importRun = await this.requireRun(businessId, runId);
    const retryableStatuses = new Set([
      IMPORT_RUN_STATUSES.DRY_RUN_COMPLETE,
      IMPORT_RUN_STATUSES.COMMIT_IN_PROGRESS,
      IMPORT_RUN_STATUSES.COMMITTED,
      IMPORT_RUN_STATUSES.COMMIT_FAILED,
      IMPORT_RUN_STATUSES.COMMIT_PARTIALLY_FAILED,
    ]);
    if (!retryableStatuses.has(importRun.status)) {
      const err = new Error("Import run must have a completed dry run before commit.");
      err.code = "INVALID_STATE";
      throw err;
    }

    await this.repository.updateRun(runId, businessId, {
      status: IMPORT_RUN_STATUSES.COMMIT_IN_PROGRESS,
      committedByUserId: userId ?? null,
    });

    const result = await this.commitExecutor.execute({
      repository: this.repository,
      businessId,
      run: importRun,
      stack,
      installationResult,
      userId,
      allowReviewCommit,
      nowISO,
      persistence,
    });

    let status = IMPORT_RUN_STATUSES.COMMITTED;
    if (Number(result.stats.failedRows ?? 0) > 0) {
      status =
        Number(result.stats.committedRows ?? 0) > 0 || Number(result.stats.skippedRows ?? 0) > 0
          ? IMPORT_RUN_STATUSES.COMMIT_PARTIALLY_FAILED
          : IMPORT_RUN_STATUSES.COMMIT_FAILED;
    }

    const updated = await this.repository.updateRun(runId, businessId, {
      status,
      stats: { ...(importRun.stats ?? {}), commit: result.stats },
      committedAt: status === IMPORT_RUN_STATUSES.COMMITTED ? nowISO : null,
      committedByUserId: userId ?? null,
      lastCommittedRow: result.rows.reduce(
        (max, row) => (row.commitStatus === "committed" ? Math.max(max, Number(row.rowNumber ?? 0)) : max),
        importRun.lastCommittedRow ?? 0,
      ),
    });

    return {
      importRun: updated,
      commit: {
        importRunId: runId,
        status,
        stats: result.stats,
        rows: result.rows,
      },
    };
  }

  /**
   * @param {{ businessId: string, runId: string, page?: number, pageSize?: number, status?: string|null }} args
   */
  async getReport({ businessId, runId, page = 1, pageSize = 50, status = null } = {}) {
    const importRun = await this.requireRun(businessId, runId);
    const report = await this.repository.listRowResults({
      importRunId: runId,
      businessId,
      page,
      pageSize,
      status,
    });
    return {
      importRunId: runId,
      stats: importRun.stats ?? {},
      ...report,
    };
  }

  async requireRun(businessId, runId) {
    const importRun = await this.repository.getRun(runId, businessId);
    if (!importRun) {
      const err = new Error("Import run not found.");
      err.code = "NOT_FOUND";
      throw err;
    }
    return importRun;
  }

  async requireArtifact(businessId, artifactId) {
    const artifact = await this.repository.getArtifact(artifactId, businessId);
    if (!artifact) {
      const err = new Error("Import artifact not found.");
      err.code = "NOT_FOUND";
      throw err;
    }
    return artifact;
  }
}

export function createCrmImportOrchestrationService(options = {}) {
  return new CrmImportOrchestrationService(options);
}

export const crmImportOrchestrationService = createCrmImportOrchestrationService();
