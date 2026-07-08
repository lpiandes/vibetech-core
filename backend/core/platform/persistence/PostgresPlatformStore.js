import crypto from "node:crypto";

import { withClient } from "../db/pool.js";
import {
  mapUserRow,
  mapBusinessRow,
  mapMembershipRow,
  mapInvitationRow,
  hashToken,
  generateInvitationToken,
} from "./platformMappers.js";
import { mapKnowledgeDocumentRow } from "../knowledge/BusinessKnowledgeDocument.js";
import {
  mapImportArtifactRow,
  mapImportRunRow,
  mapImportRunRowResultRow,
} from "../../import/persistence/importMappers.js";
import { encryptInvitationToken, decryptInvitationToken } from "../delivery/InvitationDeliveryTokenCrypto.js";
import { INVITATION_TTL_DAYS, MEMBERSHIP_ROLES } from "../permissions/rolePermissions.js";

export class PostgresPlatformStore {
  async createUser({ email, name, passwordHash, platformRole = null }) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const { rows } = await withClient((client) =>
      client.query(
        `INSERT INTO users (email, name, password_hash, platform_role)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [normalizedEmail, String(name ?? "").trim(), passwordHash ?? null, platformRole],
      ),
    );
    return mapUserRow(rows[0]);
  }

  async getUserByEmail(email) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const { rows } = await withClient((client) =>
      client.query(`SELECT * FROM users WHERE email = $1`, [normalizedEmail]),
    );
    return mapUserRow(rows[0] ?? null);
  }

  async getUserById(userId) {
    const { rows } = await withClient((client) =>
      client.query(`SELECT * FROM users WHERE id = $1`, [String(userId)]),
    );
    return mapUserRow(rows[0] ?? null);
  }

  async updateUserName(userId, name) {
    const { rows } = await withClient((client) =>
      client.query(
        `UPDATE users SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [String(userId), String(name).trim()],
      ),
    );
    return mapUserRow(rows[0] ?? null);
  }

  async setUserPassword(userId, passwordHash) {
    const { rows } = await withClient((client) =>
      client.query(
        `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [String(userId), passwordHash],
      ),
    );
    return mapUserRow(rows[0] ?? null);
  }

  async createBusiness({
    id = crypto.randomUUID(),
    name,
    kind = "NORMAL",
    industryPackageId = null,
    industryPackageVersion = 1,
    demoConfigurationId = null,
    packageConfiguration = {},
    status = "ACTIVE",
  }) {
    const { rows } = await withClient((client) =>
      client.query(
        `INSERT INTO businesses (id, name, kind, industry_package_id, industry_package_version, demo_configuration_id, package_configuration, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
         RETURNING *`,
        [
          String(id),
          String(name).trim(),
          kind,
          industryPackageId,
          industryPackageVersion,
          demoConfigurationId,
          JSON.stringify(packageConfiguration ?? {}),
          status,
        ],
      ),
    );
    return mapBusinessRow(rows[0]);
  }

  async getBusinessById(businessId) {
    const { rows } = await withClient((client) =>
      client.query(`SELECT * FROM businesses WHERE id = $1`, [String(businessId)]),
    );
    return mapBusinessRow(rows[0] ?? null);
  }

  async listBusinesses() {
    const { rows } = await withClient((client) =>
      client.query(`SELECT * FROM businesses ORDER BY created_at DESC`),
    );
    return rows.map(mapBusinessRow);
  }

  async listBusinessesForUser(userId) {
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT b.* FROM businesses b
         INNER JOIN business_memberships m ON m.business_id = b.id
         WHERE m.user_id = $1 AND m.status = 'ACTIVE'
         ORDER BY b.name ASC`,
        [String(userId)],
      ),
    );
    return rows.map(mapBusinessRow);
  }

  async createMembership({ userId, businessId, role, status = "ACTIVE" }) {
    const { rows } = await withClient((client) =>
      client.query(
        `INSERT INTO business_memberships (user_id, business_id, role, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, business_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, updated_at = NOW()
         RETURNING *`,
        [String(userId), String(businessId), role, status],
      ),
    );
    return mapMembershipRow(rows[0]);
  }

  async getActiveMembershipByEmail(businessId, email) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT m.*, u.email, u.name AS user_name
         FROM business_memberships m
         INNER JOIN users u ON u.id = m.user_id
         WHERE m.business_id = $1 AND m.status = 'ACTIVE' AND LOWER(u.email) = $2
         LIMIT 1`,
        [String(businessId), normalizedEmail],
      ),
    );
    if (!rows[0]) return null;
    return {
      ...mapMembershipRow(rows[0]),
      email: String(rows[0].email),
      userName: String(rows[0].user_name ?? ""),
    };
  }

  async getMembership(userId, businessId) {
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT * FROM business_memberships WHERE user_id = $1 AND business_id = $2`,
        [String(userId), String(businessId)],
      ),
    );
    return mapMembershipRow(rows[0] ?? null);
  }

  async listMembershipsForBusiness(businessId) {
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT m.*, u.email, u.name AS user_name
         FROM business_memberships m
         INNER JOIN users u ON u.id = m.user_id
         WHERE m.business_id = $1 AND m.status = 'ACTIVE'
         ORDER BY m.created_at ASC`,
        [String(businessId)],
      ),
    );
    return rows.map((row) => ({
      ...mapMembershipRow(row),
      email: String(row.email),
      userName: String(row.user_name ?? ""),
    }));
  }

  async getOwnerMembership(businessId) {
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT m.*, u.email, u.name AS user_name
         FROM business_memberships m
         INNER JOIN users u ON u.id = m.user_id
         WHERE m.business_id = $1 AND m.role = 'OWNER' AND m.status = 'ACTIVE'
         ORDER BY m.created_at ASC
         LIMIT 1`,
        [String(businessId)],
      ),
    );
    if (!rows[0]) return null;
    return {
      ...mapMembershipRow(rows[0]),
      email: String(rows[0].email),
      userName: String(rows[0].user_name ?? ""),
    };
  }

  async createInvitation({ businessId, email, role, invitedByUserId, token = generateInvitationToken() }) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const tokenHash = hashToken(token);

    const { rows: revokedRows } = await withClient((client) =>
      client.query(
        `UPDATE invitations SET revoked_at = NOW()
         WHERE business_id = $1 AND email = $2 AND accepted_at IS NULL AND revoked_at IS NULL
         RETURNING id`,
        [String(businessId), normalizedEmail],
      ),
    );
    for (const row of revokedRows) {
      await this.deleteInvitationDeliveryToken(String(row.id));
    }

    const { rows } = await withClient((client) =>
      client.query(
        `INSERT INTO invitations (business_id, email, role, invited_by_user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [String(businessId), normalizedEmail, role, invitedByUserId ?? null, tokenHash, expiresAt.toISOString()],
      ),
    );

    return { invitation: mapInvitationRow(rows[0]), token };
  }

  async getInvitationByToken(token) {
    const tokenHash = hashToken(token);
    const { rows } = await withClient((client) =>
      client.query(`SELECT * FROM invitations WHERE token_hash = $1`, [tokenHash]),
    );
    return mapInvitationRow(rows[0] ?? null);
  }

  async getInvitationById(invitationId) {
    const { rows } = await withClient((client) =>
      client.query(`SELECT * FROM invitations WHERE id = $1`, [String(invitationId)]),
    );
    return mapInvitationRow(rows[0] ?? null);
  }

  async listAllPendingInvitations() {
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT i.*, b.name AS business_name
         FROM invitations i
         INNER JOIN businesses b ON b.id = i.business_id
         WHERE i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW()
         ORDER BY i.created_at DESC`,
      ),
    );
    return rows.map((row) => ({
      ...mapInvitationRow(row),
      businessName: String(row.business_name),
    }));
  }

  async listPendingInvitationsForBusiness(businessId) {
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT * FROM invitations
         WHERE business_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [String(businessId)],
      ),
    );
    return rows.map(mapInvitationRow);
  }

  async revokeInvitation(invitationId) {
    const { rows } = await withClient((client) =>
      client.query(
        `UPDATE invitations SET revoked_at = NOW() WHERE id = $1 AND accepted_at IS NULL RETURNING *`,
        [String(invitationId)],
      ),
    );
    const invitation = mapInvitationRow(rows[0] ?? null);
    if (invitation) {
      await this.deleteInvitationDeliveryToken(invitation.id);
    }
    return invitation;
  }

  async saveInvitationDeliveryToken(invitationId, token) {
    const tokenCiphertext = encryptInvitationToken(token);
    await withClient((client) =>
      client.query(
        `INSERT INTO invitation_delivery_tokens (invitation_id, token_ciphertext)
         VALUES ($1, $2)
         ON CONFLICT (invitation_id) DO UPDATE SET token_ciphertext = EXCLUDED.token_ciphertext, created_at = NOW()`,
        [String(invitationId), tokenCiphertext],
      ),
    );
  }

  async getInvitationDeliveryToken(invitationId) {
    const { rows } = await withClient((client) =>
      client.query(`SELECT token_ciphertext FROM invitation_delivery_tokens WHERE invitation_id = $1`, [
        String(invitationId),
      ]),
    );
    if (!rows[0]?.token_ciphertext) return null;
    return decryptInvitationToken(String(rows[0].token_ciphertext));
  }

  async deleteInvitationDeliveryToken(invitationId) {
    await withClient((client) =>
      client.query(`DELETE FROM invitation_delivery_tokens WHERE invitation_id = $1`, [String(invitationId)]),
    );
  }

  async acceptInvitation({ invitationId, userId }) {
    return withClient(async (client) => {
      await client.query("BEGIN");
      try {
        const { rows: invRows } = await client.query(`SELECT * FROM invitations WHERE id = $1 FOR UPDATE`, [
          String(invitationId),
        ]);
        const invitation = invRows[0];
        if (!invitation) throw new Error("INVITATION_NOT_FOUND");

        if (invitation.revoked_at) throw new Error("INVITATION_REVOKED");
        if (invitation.accepted_at) {
          const { rows: existingMem } = await client.query(
            `SELECT * FROM business_memberships WHERE user_id = $1 AND business_id = $2`,
            [String(userId), String(invitation.business_id)],
          );
          await client.query("COMMIT");
          return {
            invitation: mapInvitationRow(invitation),
            membership: mapMembershipRow(existingMem[0] ?? null),
            alreadyAccepted: true,
          };
        }
        if (new Date(invitation.expires_at).getTime() < Date.now()) throw new Error("INVITATION_EXPIRED");

        await client.query(`UPDATE invitations SET accepted_at = NOW() WHERE id = $1`, [String(invitationId)]);

        await client.query(`DELETE FROM invitation_delivery_tokens WHERE invitation_id = $1`, [String(invitationId)]);

        const { rows: memRows } = await client.query(
          `INSERT INTO business_memberships (user_id, business_id, role, status)
           VALUES ($1, $2, $3, 'ACTIVE')
           ON CONFLICT (user_id, business_id) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE', updated_at = NOW()
           RETURNING *`,
          [String(userId), String(invitation.business_id), invitation.role],
        );

        await client.query("COMMIT");
        return {
          invitation: mapInvitationRow({ ...invitation, accepted_at: new Date() }),
          membership: mapMembershipRow(memRows[0]),
          alreadyAccepted: false,
        };
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    });
  }

  /**
   * @param {{ actorUserId?: string | null, businessId?: string | null, action: string, targetType?: string | null, targetId?: string | null, metadata?: Record<string, unknown> }} input
   */
  async recordAuditEvent({ actorUserId, businessId = null, action, targetType = null, targetId = null, metadata = {} }) {
    const { rows } = await withClient((client) =>
      client.query(
        `INSERT INTO audit_events (actor_user_id, business_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING *`,
        [
          actorUserId ?? null,
          businessId ?? null,
          action,
          targetType,
          targetId,
          JSON.stringify(metadata ?? {}),
        ],
      ),
    );
    return rows[0];
  }

  async getBusinessOwnerStatus(businessId) {
    const ownerMembership = await this.getOwnerMembership(businessId);
    if (ownerMembership) return "Active";

    const { rows } = await withClient((client) =>
      client.query(
        `SELECT 1 FROM invitations
         WHERE business_id = $1 AND role = $2 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
         LIMIT 1`,
        [String(businessId), MEMBERSHIP_ROLES.OWNER],
      ),
    );
    if (rows.length > 0) return "Owner invited";
    return "No owner";
  }

  async createKnowledgeDocument({
    businessId,
    title,
    originalFilename,
    storageKey,
    mimeType,
    sizeBytes,
    sourceType,
    uploadedByUserId,
  }) {
    const { rows } = await withClient((client) =>
      client.query(
        `INSERT INTO business_knowledge_documents (
           business_id, title, original_filename, storage_key, mime_type, size_bytes,
           source_type, status, text_extraction_status, uploaded_by_user_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', 'skipped', $8)
         RETURNING *`,
        [
          String(businessId),
          String(title).trim(),
          String(originalFilename),
          String(storageKey),
          String(mimeType),
          Number(sizeBytes),
          String(sourceType),
          uploadedByUserId ? String(uploadedByUserId) : null,
        ],
      ),
    );
    return mapKnowledgeDocumentRow(rows[0]);
  }

  async listKnowledgeDocumentsForBusiness(businessId) {
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT d.*, u.name AS uploaded_by_name
         FROM business_knowledge_documents d
         LEFT JOIN users u ON u.id = d.uploaded_by_user_id
         WHERE d.business_id = $1 AND d.status = 'ready' AND d.deleted_at IS NULL
         ORDER BY d.created_at DESC`,
        [String(businessId)],
      ),
    );
    return rows.map((row) => mapKnowledgeDocumentRow(row));
  }

  async getKnowledgeDocumentById(documentId, businessId) {
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT d.*, u.name AS uploaded_by_name
         FROM business_knowledge_documents d
         LEFT JOIN users u ON u.id = d.uploaded_by_user_id
         WHERE d.id = $1 AND d.business_id = $2 AND d.deleted_at IS NULL`,
        [String(documentId), String(businessId)],
      ),
    );
    return mapKnowledgeDocumentRow(rows[0] ?? null);
  }

  async softDeleteKnowledgeDocument({ documentId, businessId, deletedByUserId }) {
    const { rows } = await withClient((client) =>
      client.query(
        `UPDATE business_knowledge_documents
         SET status = 'deleted', deleted_at = NOW(), deleted_by_user_id = $3, updated_at = NOW()
         WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [String(documentId), String(businessId), deletedByUserId ? String(deletedByUserId) : null],
      ),
    );
    return mapKnowledgeDocumentRow(rows[0] ?? null);
  }

  async countActiveKnowledgeDocuments(businessId) {
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM business_knowledge_documents
         WHERE business_id = $1 AND status = 'ready' AND deleted_at IS NULL`,
        [String(businessId)],
      ),
    );
    return Number(rows[0]?.count ?? 0);
  }

  async isTeamInviteChecklistComplete(businessId) {
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT EXISTS (
           SELECT 1 FROM business_memberships
           WHERE business_id = $1 AND status = 'ACTIVE' AND role <> 'OWNER'
         ) OR EXISTS (
           SELECT 1 FROM invitations
           WHERE business_id = $1
             AND role <> 'OWNER'
             AND accepted_at IS NULL
             AND revoked_at IS NULL
             AND expires_at > NOW()
         ) AS complete`,
        [String(businessId)],
      ),
    );
    return Boolean(rows[0]?.complete);
  }

  async createImportArtifact({
    businessId,
    sourceSystem,
    originalFilename,
    storageKey,
    contentHash,
    mimeType,
    sizeBytes,
    uploadedByUserId = null,
  }) {
    const { rows } = await withClient((client) =>
      client.query(
        `INSERT INTO import_artifacts (
           business_id, source_system, original_filename, storage_key,
           content_hash, mime_type, size_bytes, uploaded_by_user_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          String(businessId),
          String(sourceSystem),
          String(originalFilename),
          String(storageKey),
          String(contentHash),
          String(mimeType),
          Number(sizeBytes),
          uploadedByUserId ? String(uploadedByUserId) : null,
        ],
      ),
    );
    return mapImportArtifactRow(rows[0]);
  }

  async getImportArtifactById(artifactId, businessId) {
    const { rows } = await withClient((client) =>
      client.query(`SELECT * FROM import_artifacts WHERE id = $1 AND business_id = $2`, [
        String(artifactId),
        String(businessId),
      ]),
    );
    return mapImportArtifactRow(rows[0] ?? null);
  }

  async createImportRun({
    businessId,
    artifactId,
    sourceSystem,
    contentHash,
    status,
    profileId = null,
    columnMapping = null,
    stats = {},
    planSummary = null,
  }) {
    const { rows } = await withClient((client) =>
      client.query(
        `INSERT INTO import_runs (
           business_id, artifact_id, source_system, profile_id, status,
           content_hash, column_mapping, stats, plan_summary
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)
         RETURNING *`,
        [
          String(businessId),
          String(artifactId),
          String(sourceSystem),
          profileId ? String(profileId) : null,
          String(status),
          String(contentHash),
          columnMapping ? JSON.stringify(columnMapping) : null,
          JSON.stringify(stats ?? {}),
          planSummary ? JSON.stringify(planSummary) : null,
        ],
      ),
    );
    return mapImportRunRow(rows[0]);
  }

  async getImportRunById(runId, businessId) {
    const { rows } = await withClient((client) =>
      client.query(`SELECT * FROM import_runs WHERE id = $1 AND business_id = $2`, [
        String(runId),
        String(businessId),
      ]),
    );
    return mapImportRunRow(rows[0] ?? null);
  }

  async updateImportRun(runId, businessId, patch = {}) {
    const fields = [];
    const values = [];
    let idx = 1;

    const setField = (column, value, json = false) => {
      fields.push(`${column} = $${idx}${json ? "::jsonb" : ""}`);
      values.push(json ? JSON.stringify(value) : value);
      idx += 1;
    };

    if (patch.status !== undefined) setField("status", String(patch.status));
    if (patch.profileId !== undefined) setField("profile_id", patch.profileId ? String(patch.profileId) : null);
    if (patch.columnMapping !== undefined) setField("column_mapping", patch.columnMapping ?? null, true);
    if (patch.stats !== undefined) setField("stats", patch.stats ?? {}, true);
    if (patch.planSummary !== undefined) setField("plan_summary", patch.planSummary ?? null, true);
    if (patch.committedAt !== undefined) setField("committed_at", patch.committedAt ?? null);
    if (patch.committedByUserId !== undefined) setField("committed_by_user_id", patch.committedByUserId ? String(patch.committedByUserId) : null);
    if (patch.lastCommittedRow !== undefined) setField("last_committed_row", patch.lastCommittedRow === null ? null : Number(patch.lastCommittedRow));

    if (!fields.length) {
      return this.getImportRunById(runId, businessId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(String(runId), String(businessId));

    const { rows } = await withClient((client) =>
      client.query(
        `UPDATE import_runs SET ${fields.join(", ")}
         WHERE id = $${idx} AND business_id = $${idx + 1}
         RETURNING *`,
        values,
      ),
    );
    return mapImportRunRow(rows[0] ?? null);
  }

  async deleteImportRunRowResults(importRunId) {
    await withClient((client) =>
      client.query(`DELETE FROM import_run_row_results WHERE import_run_id = $1`, [String(importRunId)]),
    );
  }

  async insertImportRunRowResults(importRunId, rows = []) {
    if (!rows.length) return [];
    const inserted = [];
    await withClient(async (client) => {
      for (const row of rows) {
        const { rows: result } = await client.query(
          `INSERT INTO import_run_row_results (
             import_run_id, row_number, external_id, resolved_party_id, match_tier,
             planned_actions, outcome_status, warnings, errors, raw_normalized, raw_unmapped
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)
           ON CONFLICT (import_run_id, row_number)
           DO UPDATE SET
             external_id = EXCLUDED.external_id,
             resolved_party_id = EXCLUDED.resolved_party_id,
             match_tier = EXCLUDED.match_tier,
             planned_actions = EXCLUDED.planned_actions,
             outcome_status = EXCLUDED.outcome_status,
             warnings = EXCLUDED.warnings,
             errors = EXCLUDED.errors,
             raw_normalized = EXCLUDED.raw_normalized,
             raw_unmapped = EXCLUDED.raw_unmapped,
             created_at = NOW()
           RETURNING *`,
          [
            String(importRunId),
            Number(row.rowNumber),
            row.externalId ?? null,
            row.resolvedPartyId ?? null,
            row.matchTier ?? null,
            JSON.stringify(row.plannedActions ?? []),
            String(row.outcomeStatus),
            JSON.stringify(row.warnings ?? []),
            JSON.stringify(row.errors ?? []),
            row.rawNormalized ? JSON.stringify(row.rawNormalized) : null,
            row.rawUnmapped ? JSON.stringify(row.rawUnmapped) : null,
          ],
        );
        inserted.push(mapImportRunRowResultRow(result[0]));
      }
    });
    return inserted;
  }

  async listImportRunRowResults({
    importRunId,
    businessId,
    page = 1,
    pageSize = 50,
    status = null,
  } = {}) {
    const limit = Math.min(Math.max(Number(pageSize) || 50, 1), 200);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const params = [String(importRunId), String(businessId)];
    let statusClause = "";
    if (status) {
      params.push(String(status));
      statusClause = ` AND r.outcome_status = $${params.length}`;
    }

    const countQuery = `
      SELECT COUNT(*)::int AS count
      FROM import_run_row_results r
      JOIN import_runs run ON run.id = r.import_run_id
      WHERE r.import_run_id = $1 AND run.business_id = $2${statusClause}`;

    const dataQuery = `
      SELECT r.*
      FROM import_run_row_results r
      JOIN import_runs run ON run.id = r.import_run_id
      WHERE r.import_run_id = $1 AND run.business_id = $2${statusClause}
      ORDER BY r.row_number ASC
      LIMIT ${limit} OFFSET ${offset}`;

    const { rows: countRows } = await withClient((client) => client.query(countQuery, params));
    const { rows } = await withClient((client) => client.query(dataQuery, params));

    return {
      totalRows: Number(countRows[0]?.count ?? 0),
      page: Math.max(Number(page) || 1, 1),
      pageSize: limit,
      rows: rows.map(mapImportRunRowResultRow),
    };
  }

  async listAllImportRunRowResults({ importRunId, businessId } = {}) {
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT r.*
         FROM import_run_row_results r
         JOIN import_runs run ON run.id = r.import_run_id
         WHERE r.import_run_id = $1 AND run.business_id = $2
         ORDER BY r.row_number ASC`,
        [String(importRunId), String(businessId)],
      ),
    );
    return rows.map(mapImportRunRowResultRow);
  }

  async updateImportRunRowCommitState({
    importRunId,
    businessId,
    rowNumber,
    commitStatus,
    commitResult = null,
    commitError = null,
    committedAt = null,
    incrementAttempts = false,
  } = {}) {
    const { rows } = await withClient((client) =>
      client.query(
        `UPDATE import_run_row_results r
         SET commit_status = $4,
             commit_result = $5::jsonb,
             commit_error = $6::jsonb,
             committed_at = $7,
             commit_attempts = commit_attempts + $8
         FROM import_runs run
         WHERE r.import_run_id = run.id
           AND r.import_run_id = $1
           AND run.business_id = $2
           AND r.row_number = $3
         RETURNING r.*`,
        [
          String(importRunId),
          String(businessId),
          Number(rowNumber),
          String(commitStatus),
          commitResult === undefined ? null : JSON.stringify(commitResult),
          commitError === undefined ? null : JSON.stringify(commitError),
          committedAt ?? null,
          incrementAttempts ? 1 : 0,
        ],
      ),
    );
    return mapImportRunRowResultRow(rows[0] ?? null);
  }

  async countImportRunRowResults(importRunId) {
    const { rows } = await withClient((client) =>
      client.query(`SELECT COUNT(*)::int AS count FROM import_run_row_results WHERE import_run_id = $1`, [
        String(importRunId),
      ]),
    );
    return Number(rows[0]?.count ?? 0);
  }
}

export const platformStore = new PostgresPlatformStore();
