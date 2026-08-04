import crypto from "node:crypto";

import {
  mapUserRow,
  mapBusinessRow,
  mapMembershipRow,
  mapInvitationRow,
  hashToken,
  generateInvitationToken,
} from "./platformMappers.js";
import { mapKnowledgeDocumentRow } from "../knowledge/BusinessKnowledgeDocument.js";
import { mapBusinessCampaignTemplateRow } from "../campaigns/BusinessCampaignTemplate.js";
import {
  mapImportArtifactRow,
  mapImportRunRow,
  mapImportRunRowResultRow,
} from "../../import/persistence/importMappers.js";
import { encryptInvitationToken, decryptInvitationToken } from "../delivery/InvitationDeliveryTokenCrypto.js";
import {
  encryptIntegrationSecrets,
  decryptIntegrationSecrets,
} from "../../integrations/credentials/IntegrationCredentialCrypto.js";
import { INVITATION_TTL_DAYS, MEMBERSHIP_ROLES } from "../permissions/rolePermissions.js";

export class PostgresPlatformStore {
  /** @param {(fn: (client: any) => Promise<any>) => Promise<any>} withClient */
  constructor(withClient) {
    if (typeof withClient !== "function") {
      throw new Error("PostgresPlatformStore requires a withClient database port");
    }
    this.withClient = withClient;
  }

  async createUser({ email, name, passwordHash, platformRole = null }) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
      client.query(`SELECT * FROM users WHERE email = $1`, [normalizedEmail]),
    );
    return mapUserRow(rows[0] ?? null);
  }

  async getUserById(userId) {
    const { rows } = await this.withClient((client) =>
      client.query(`SELECT * FROM users WHERE id = $1`, [String(userId)]),
    );
    return mapUserRow(rows[0] ?? null);
  }

  async updateUserName(userId, name) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `UPDATE users SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [String(userId), String(name).trim()],
      ),
    );
    return mapUserRow(rows[0] ?? null);
  }

  async setUserPassword(userId, passwordHash) {
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
      client.query(`SELECT * FROM businesses WHERE id = $1`, [String(businessId)]),
    );
    return mapBusinessRow(rows[0] ?? null);
  }

  async updateBusinessName({ businessId, name }) {
    const nextName = String(name ?? "").trim();
    if (!businessId || !nextName) return null;
    const { rows } = await this.withClient((client) =>
      client.query(
        `UPDATE businesses
         SET name = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [String(businessId), nextName],
      ),
    );
    return mapBusinessRow(rows[0] ?? null);
  }

  async updateBusinessPackageConfiguration({ businessId, packageConfiguration }) {
    if (!businessId) return null;
    const { rows } = await this.withClient((client) =>
      client.query(
        `UPDATE businesses
         SET package_configuration = $2::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [String(businessId), JSON.stringify(packageConfiguration ?? {})],
      ),
    );
    return mapBusinessRow(rows[0] ?? null);
  }

  async archiveBusiness({ businessId }) {
    if (!businessId) return null;
    const { rows } = await this.withClient((client) =>
      client.query(
        `UPDATE businesses
         SET status = 'ARCHIVED', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [String(businessId)],
      ),
    );
    return mapBusinessRow(rows[0] ?? null);
  }

  async restoreBusiness({ businessId }) {
    if (!businessId) return null;
    const { rows } = await this.withClient((client) =>
      client.query(
        `UPDATE businesses
         SET status = 'ACTIVE', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [String(businessId)],
      ),
    );
    return mapBusinessRow(rows[0] ?? null);
  }

  async updateBusinessIndustryPackage({
    businessId,
    industryPackageId = null,
    industryPackageVersion = 1,
    packageConfiguration = {},
  }) {
    if (!businessId) return null;
    const { rows } = await this.withClient((client) =>
      client.query(
        `UPDATE businesses
         SET industry_package_id = $2,
             industry_package_version = $3,
             package_configuration = $4::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          String(businessId),
          industryPackageId ? String(industryPackageId) : null,
          Number(industryPackageVersion ?? 1),
          JSON.stringify(packageConfiguration ?? {}),
        ],
      ),
    );
    return mapBusinessRow(rows[0] ?? null);
  }

  async listBusinesses({ includeArchived = false } = {}) {
    const { rows } = await this.withClient((client) =>
      client.query(
        includeArchived
          ? `SELECT * FROM businesses ORDER BY created_at DESC`
          : `SELECT * FROM businesses WHERE COALESCE(status, 'ACTIVE') <> 'ARCHIVED' ORDER BY created_at DESC`,
      ),
    );
    return rows.map(mapBusinessRow);
  }

  async listBusinessesForUser(userId) {
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM business_memberships WHERE user_id = $1 AND business_id = $2`,
        [String(userId), String(businessId)],
      ),
    );
    return mapMembershipRow(rows[0] ?? null);
  }

  async listMembershipsForBusiness(businessId) {
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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

    const { rows: revokedRows } = await this.withClient((client) =>
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

    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
      client.query(`SELECT * FROM invitations WHERE token_hash = $1`, [tokenHash]),
    );
    return mapInvitationRow(rows[0] ?? null);
  }

  async getInvitationById(invitationId) {
    const { rows } = await this.withClient((client) =>
      client.query(`SELECT * FROM invitations WHERE id = $1`, [String(invitationId)]),
    );
    return mapInvitationRow(rows[0] ?? null);
  }

  async listAllPendingInvitations() {
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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
    await this.withClient((client) =>
      client.query(
        `INSERT INTO invitation_delivery_tokens (invitation_id, token_ciphertext)
         VALUES ($1, $2)
         ON CONFLICT (invitation_id) DO UPDATE SET token_ciphertext = EXCLUDED.token_ciphertext, created_at = NOW()`,
        [String(invitationId), tokenCiphertext],
      ),
    );
  }

  async getInvitationDeliveryToken(invitationId) {
    const { rows } = await this.withClient((client) =>
      client.query(`SELECT token_ciphertext FROM invitation_delivery_tokens WHERE invitation_id = $1`, [
        String(invitationId),
      ]),
    );
    if (!rows[0]?.token_ciphertext) return null;
    return decryptInvitationToken(String(rows[0].token_ciphertext));
  }

  async deleteInvitationDeliveryToken(invitationId) {
    await this.withClient((client) =>
      client.query(`DELETE FROM invitation_delivery_tokens WHERE invitation_id = $1`, [String(invitationId)]),
    );
  }

  async upsertIntegrationCredential({ workspaceId, credentialId, providerType, secrets, metadata = {} } = {}) {
    const secretsCiphertext = encryptIntegrationSecrets(secrets);
    const meta = metadata && typeof metadata === "object" ? metadata : {};
    await this.withClient((client) =>
      client.query(
        `INSERT INTO integration_credentials (workspace_id, credential_id, provider_type, secrets_ciphertext, metadata, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
         ON CONFLICT (workspace_id, credential_id) DO UPDATE SET
           provider_type = EXCLUDED.provider_type,
           secrets_ciphertext = EXCLUDED.secrets_ciphertext,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [
          String(workspaceId),
          String(credentialId),
          String(providerType),
          secretsCiphertext,
          JSON.stringify(meta),
        ],
      ),
    );
    return {
      workspaceId: String(workspaceId),
      credentialId: String(credentialId),
      providerType: String(providerType),
      metadata: meta,
    };
  }

  async listIntegrationCredentialsForWorkspace(workspaceId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT workspace_id, credential_id, provider_type, secrets_ciphertext, metadata, updated_at
         FROM integration_credentials
         WHERE workspace_id = $1
         ORDER BY credential_id ASC`,
        [String(workspaceId)],
      ),
    );
    return rows.map((row) => ({
      workspaceId: String(row.workspace_id),
      credentialId: String(row.credential_id),
      providerType: String(row.provider_type),
      secrets: decryptIntegrationSecrets(String(row.secrets_ciphertext)),
      metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }));
  }

  /**
   * Distinct workspace ids with a live credential for `providerType` (e.g. "gmail").
   * Used by lightweight recurring jobs (Gmail inbox sync tick) that need to fan out
   * across businesses without a full per-workspace job registry entry.
   *
   * `offset` supports cursor-style rotation across ticks (see
   * runHostedPlatformJobTick.ts) so that with more connected businesses than
   * fit in one pool, every business eventually rotates into view instead of
   * only ever the first `limit` (by workspace_id) ever syncing.
   */
  async listWorkspaceIdsWithIntegrationCredentialType(providerType, { limit = 25, offset = 0 } = {}) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT DISTINCT ON (workspace_id) workspace_id, updated_at
         FROM integration_credentials
         WHERE provider_type = $1
         ORDER BY workspace_id ASC, updated_at DESC
         LIMIT $2 OFFSET $3`,
        [String(providerType), Number(limit) || 25, Math.max(0, Number(offset) || 0)],
      ),
    );
    return rows.map((row) => String(row.workspace_id));
  }

  async deleteIntegrationCredential({ workspaceId, credentialId } = {}) {
    await this.withClient((client) =>
      client.query(
        `DELETE FROM integration_credentials WHERE workspace_id = $1 AND credential_id = $2`,
        [String(workspaceId), String(credentialId)],
      ),
    );
  }

  async acceptInvitation({ invitationId, userId }) {
    return this.withClient(async (client) => {
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
    const { rows } = await this.withClient((client) =>
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

  async getAiAskQuotaUsage({ key }) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT used_count FROM ai_ask_quota_usage WHERE quota_key = $1`,
        [String(key)],
      ),
    );
    return rows[0]?.used_count ?? null;
  }

  async incrementAiAskQuotaUsage({
    key,
    day,
    scope,
    userId = null,
    businessId = null,
    employeeId = null,
  }) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO ai_ask_quota_usage (
           quota_key, scope, day_utc, user_id, business_id, employee_id, used_count, updated_at
         ) VALUES ($1, $2, $3::date, $4, $5, $6, 1, NOW())
         ON CONFLICT (quota_key) DO UPDATE SET
           used_count = ai_ask_quota_usage.used_count + 1,
           updated_at = NOW()
         RETURNING used_count`,
        [
          String(key),
          String(scope ?? "ask"),
          String(day),
          userId ?? null,
          businessId ?? null,
          employeeId ?? null,
        ],
      ),
    );
    return rows[0]?.used_count ?? 1;
  }

  async getBusinessOwnerStatus(businessId) {
    const ownerMembership = await this.getOwnerMembership(businessId);
    if (ownerMembership) return "Active";

    const { rows } = await this.withClient((client) =>
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

  async ensureKnowledgeContentTextColumn() {
    await this.withClient((client) =>
      client.query(`
        ALTER TABLE business_knowledge_documents
        ADD COLUMN IF NOT EXISTS content_text TEXT
      `),
    );
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
    categoryIds = [],
    contentText = null,
    textExtractionStatus = "skipped",
  }) {
    const cats = Array.isArray(categoryIds) ? categoryIds.map(String) : [];
    // Self-heal: code shipped before prod migration ran (local migrate only).
    await this.ensureKnowledgeContentTextColumn();
    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO business_knowledge_documents (
           business_id, title, original_filename, storage_key, mime_type, size_bytes,
           source_type, status, text_extraction_status, uploaded_by_user_id, category_ids,
           content_text
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', $8, $9, $10::text[], $11)
         RETURNING *`,
        [
          String(businessId),
          String(title).trim(),
          String(originalFilename),
          String(storageKey),
          String(mimeType),
          Number(sizeBytes),
          String(sourceType),
          String(textExtractionStatus || "skipped"),
          uploadedByUserId ? String(uploadedByUserId) : null,
          cats,
          contentText != null ? String(contentText) : null,
        ],
      ),
    );
    return mapKnowledgeDocumentRow(rows[0]);
  }

  async updateKnowledgeDocumentContentText({ documentId, businessId, contentText, textExtractionStatus = null }) {
    await this.ensureKnowledgeContentTextColumn();
    const { rows } = await this.withClient((client) =>
      client.query(
        `UPDATE business_knowledge_documents
         SET content_text = $3,
             text_extraction_status = COALESCE($4, text_extraction_status),
             updated_at = NOW()
         WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [
          String(documentId),
          String(businessId),
          contentText != null ? String(contentText) : null,
          textExtractionStatus != null ? String(textExtractionStatus) : null,
        ],
      ),
    );
    return mapKnowledgeDocumentRow(rows[0] ?? null);
  }

  async updateKnowledgeDocumentCategories({ documentId, businessId, categoryIds = [] }) {
    const cats = Array.isArray(categoryIds) ? categoryIds.map(String) : [];
    const { rows } = await this.withClient((client) =>
      client.query(
        `UPDATE business_knowledge_documents
         SET category_ids = $3::text[], updated_at = NOW()
         WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [String(documentId), String(businessId), cats],
      ),
    );
    return mapKnowledgeDocumentRow(rows[0] ?? null);
  }

  async listKnowledgeDocumentsForBusiness(businessId) {
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT COUNT(*)::int AS count
         FROM business_knowledge_documents
         WHERE business_id = $1 AND status = 'ready' AND deleted_at IS NULL`,
        [String(businessId)],
      ),
    );
    return Number(rows[0]?.count ?? 0);
  }

  async listCampaignTemplatesForBusiness(businessId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT *
         FROM business_campaign_templates
         WHERE business_id = $1 AND status = 'active' AND deleted_at IS NULL
         ORDER BY updated_at DESC`,
        [String(businessId)],
      ),
    );
    return rows.map((row) => mapBusinessCampaignTemplateRow(row));
  }

  async getCampaignTemplateById(templateId, businessId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT *
         FROM business_campaign_templates
         WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
        [String(templateId), String(businessId)],
      ),
    );
    return mapBusinessCampaignTemplateRow(rows[0] ?? null);
  }

  async upsertCampaignTemplate({
    id,
    businessId,
    name,
    purpose = null,
    channel = "email",
    audience = {},
    subjectLine = "",
    previewText = null,
    cta = null,
    guardrails = [],
    sections = [],
    sourceTemplateId = null,
    approvalRequired = true,
    createdByUserId = null,
    updatedByUserId = null,
  }) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO business_campaign_templates (
           id, business_id, name, purpose, channel, audience, subject_line, preview_text,
           cta, guardrails, sections, source_template_id, approval_required,
           created_by_user_id, updated_by_user_id, status
         ) VALUES (
           $1, $2, $3, $4, $5, $6::jsonb, $7, $8,
           $9, $10::jsonb, $11::jsonb, $12, $13,
           $14, $15, 'active'
         )
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           purpose = EXCLUDED.purpose,
           channel = EXCLUDED.channel,
           audience = EXCLUDED.audience,
           subject_line = EXCLUDED.subject_line,
           preview_text = EXCLUDED.preview_text,
           cta = EXCLUDED.cta,
           guardrails = EXCLUDED.guardrails,
           sections = EXCLUDED.sections,
           source_template_id = EXCLUDED.source_template_id,
           approval_required = EXCLUDED.approval_required,
           updated_by_user_id = EXCLUDED.updated_by_user_id,
           status = 'active',
           deleted_at = NULL,
           deleted_by_user_id = NULL,
           updated_at = NOW()
         WHERE business_campaign_templates.business_id = EXCLUDED.business_id
         RETURNING *`,
        [
          String(id),
          String(businessId),
          String(name).trim(),
          purpose == null ? null : String(purpose),
          String(channel || "email"),
          JSON.stringify(audience ?? {}),
          String(subjectLine ?? ""),
          previewText == null ? null : String(previewText),
          cta == null ? null : String(cta),
          JSON.stringify(Array.isArray(guardrails) ? guardrails : []),
          JSON.stringify(Array.isArray(sections) ? sections : []),
          sourceTemplateId == null ? null : String(sourceTemplateId),
          approvalRequired !== false,
          createdByUserId ? String(createdByUserId) : null,
          updatedByUserId ? String(updatedByUserId) : null,
        ],
      ),
    );
    return mapBusinessCampaignTemplateRow(rows[0] ?? null);
  }

  async softDeleteCampaignTemplate({ templateId, businessId, deletedByUserId = null }) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `UPDATE business_campaign_templates
         SET status = 'deleted', deleted_at = NOW(), deleted_by_user_id = $3, updated_at = NOW()
         WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [String(templateId), String(businessId), deletedByUserId ? String(deletedByUserId) : null],
      ),
    );
    return mapBusinessCampaignTemplateRow(rows[0] ?? null);
  }

  async isTeamInviteChecklistComplete(businessId) {
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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

    const { rows } = await this.withClient((client) =>
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
    await this.withClient((client) =>
      client.query(`DELETE FROM import_run_row_results WHERE import_run_id = $1`, [String(importRunId)]),
    );
  }

  async insertImportRunRowResults(importRunId, rows = []) {
    if (!rows.length) return [];
    const inserted = [];
    await this.withClient(async (client) => {
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

    const { rows: countRows } = await this.withClient((client) => client.query(countQuery, params));
    const { rows } = await this.withClient((client) => client.query(dataQuery, params));

    return {
      totalRows: Number(countRows[0]?.count ?? 0),
      page: Math.max(Number(page) || 1, 1),
      pageSize: limit,
      rows: rows.map(mapImportRunRowResultRow),
    };
  }

  async listAllImportRunRowResults({ importRunId, businessId } = {}) {
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
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
    const { rows } = await this.withClient((client) =>
      client.query(`SELECT COUNT(*)::int AS count FROM import_run_row_results WHERE import_run_id = $1`, [
        String(importRunId),
      ]),
    );
    return Number(rows[0]?.count ?? 0);
  }

  async upsertBusinessOSSpecification({
    id,
    businessId = null,
    specificationId,
    specificationVersion,
    schemaVersion = 1,
    status,
    contentHash,
    specification,
    createdByUserId = null,
    updatedByUserId = null,
  }) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO business_os_specifications (
           id, business_id, specification_id, specification_version, schema_version,
           status, content_hash, specification, created_by_user_id, updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
         ON CONFLICT (business_id, specification_id, specification_version)
         DO UPDATE SET
           status = EXCLUDED.status,
           content_hash = EXCLUDED.content_hash,
           specification = EXCLUDED.specification,
           updated_by_user_id = EXCLUDED.updated_by_user_id,
           updated_at = NOW()
         RETURNING *`,
        [
          String(id),
          businessId ? String(businessId) : null,
          String(specificationId),
          Number(specificationVersion),
          Number(schemaVersion),
          String(status),
          String(contentHash),
          JSON.stringify(specification),
          createdByUserId ? String(createdByUserId) : null,
          updatedByUserId ? String(updatedByUserId) : null,
        ],
      ),
    );
    return mapBusinessOSSpecificationRow(rows[0] ?? null);
  }

  /** @param {{businessId: string, specificationId: string, specificationVersion?: number | null}} input */
  async getBusinessOSSpecification({ businessId, specificationId, specificationVersion = null }) {
    const params = [String(businessId), String(specificationId)];
    let sql = `SELECT * FROM business_os_specifications WHERE business_id = $1 AND specification_id = $2`;
    if (specificationVersion != null) {
      sql += ` AND specification_version = $3`;
      params.push(Number(specificationVersion));
    } else {
      sql += ` ORDER BY specification_version DESC`;
    }
    sql += ` LIMIT 1`;
    const { rows } = await this.withClient((client) => client.query(sql, params));
    return mapBusinessOSSpecificationRow(rows[0] ?? null);
  }

  async listBusinessOSSpecifications(businessId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM business_os_specifications WHERE business_id = $1 ORDER BY updated_at DESC`,
        [String(businessId)],
      ),
    );
    return rows.map(mapBusinessOSSpecificationRow);
  }

  async upsertBusinessOSInstallation({
    id,
    businessId,
    specificationRowId = null,
    specificationId,
    specificationVersion,
    specificationContentHash,
    planId,
    status = "installed",
    plan = {},
    actionCheckpoints = [],
    configuration = {},
    history = [],
    actorUserId = null,
    installedAt = null,
  }) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO business_os_installations (
           id, business_id, specification_row_id, specification_id, specification_version,
           specification_content_hash, plan_id, status, plan, action_checkpoints,
           configuration, history, actor_user_id, installed_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14)
         ON CONFLICT (business_id)
         DO UPDATE SET
           specification_row_id = EXCLUDED.specification_row_id,
           specification_id = EXCLUDED.specification_id,
           specification_version = EXCLUDED.specification_version,
           specification_content_hash = EXCLUDED.specification_content_hash,
           plan_id = EXCLUDED.plan_id,
           status = EXCLUDED.status,
           plan = EXCLUDED.plan,
           action_checkpoints = EXCLUDED.action_checkpoints,
           configuration = EXCLUDED.configuration,
           history = EXCLUDED.history,
           actor_user_id = EXCLUDED.actor_user_id,
           installed_at = EXCLUDED.installed_at,
           updated_at = NOW()
         RETURNING *`,
        [
          String(id),
          String(businessId),
          specificationRowId ? String(specificationRowId) : null,
          String(specificationId),
          Number(specificationVersion),
          String(specificationContentHash),
          String(planId),
          String(status),
          JSON.stringify(plan),
          JSON.stringify(actionCheckpoints),
          JSON.stringify(configuration),
          JSON.stringify(history),
          actorUserId ? String(actorUserId) : null,
          installedAt,
        ],
      ),
    );
    return mapBusinessOSInstallationRow(rows[0] ?? null);
  }

  async getBusinessOSInstallation(businessId) {
    const { rows } = await this.withClient((client) =>
      client.query(`SELECT * FROM business_os_installations WHERE business_id = $1`, [String(businessId)]),
    );
    return mapBusinessOSInstallationRow(rows[0] ?? null);
  }

  /**
   * @deprecated Legacy Business Builder sessions table. Production uses
   * upsertAiBuilderSession / ai_builder_sessions. Kept only for migration
   * compatibility — do not call from product paths.
   * @see docs/product/VIBETECH_PRODUCT_CONSTITUTION.md
   */
  async upsertBusinessBuilderSession({
    id,
    businessId = null,
    status = "discovery",
    mode = "operator",
    discovery = {},
    evidence = [],
    specificationRowId = null,
    createdByUserId = null,
    updatedByUserId = null,
  }) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO business_builder_sessions (
           id, business_id, status, mode, discovery, evidence, specification_row_id,
           created_by_user_id, updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)
         ON CONFLICT (id)
         DO UPDATE SET
           status = EXCLUDED.status,
           mode = EXCLUDED.mode,
           discovery = EXCLUDED.discovery,
           evidence = EXCLUDED.evidence,
           specification_row_id = EXCLUDED.specification_row_id,
           updated_by_user_id = EXCLUDED.updated_by_user_id,
           updated_at = NOW()
         RETURNING *`,
        [
          String(id),
          businessId ? String(businessId) : null,
          String(status),
          String(mode),
          JSON.stringify(discovery),
          JSON.stringify(evidence),
          specificationRowId ? String(specificationRowId) : null,
          createdByUserId ? String(createdByUserId) : null,
          updatedByUserId ? String(updatedByUserId) : null,
        ],
      ),
    );
    return mapBusinessBuilderSessionRow(rows[0] ?? null);
  }

  /**
   * @deprecated See upsertBusinessBuilderSession — use getAiBuilderSession instead.
   */
  async getBusinessBuilderSession(sessionId, businessId = null) {
    const params = [String(sessionId)];
    let sql = `SELECT * FROM business_builder_sessions WHERE id = $1`;
    if (businessId) {
      sql += ` AND business_id = $2`;
      params.push(String(businessId));
    }
    const { rows } = await this.withClient((client) => client.query(sql, params));
    return mapBusinessBuilderSessionRow(rows[0] ?? null);
  }

  async upsertBusinessCapabilityProposal({
    id,
    businessId = null,
    proposalId,
    requestedOutcome,
    evidence = [],
    affectedBusinesses = [],
    proposedUniversalCapability = {},
    proposedPackageExtension = {},
    whyInsufficient = null,
    safetyRequirements = [],
    estimatedDependencies = [],
    status = "proposed",
    createdByUserId = null,
  }) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO business_capability_proposals (
           id, business_id, proposal_id, requested_outcome, evidence, affected_businesses,
           proposed_universal_capability, proposed_package_extension, why_insufficient,
           safety_requirements, estimated_dependencies, status, created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12,$13)
         ON CONFLICT (business_id, proposal_id)
         DO UPDATE SET
           requested_outcome = EXCLUDED.requested_outcome,
           evidence = EXCLUDED.evidence,
           affected_businesses = EXCLUDED.affected_businesses,
           proposed_universal_capability = EXCLUDED.proposed_universal_capability,
           proposed_package_extension = EXCLUDED.proposed_package_extension,
           why_insufficient = EXCLUDED.why_insufficient,
           safety_requirements = EXCLUDED.safety_requirements,
           estimated_dependencies = EXCLUDED.estimated_dependencies,
           status = EXCLUDED.status,
           updated_at = NOW()
         RETURNING *`,
        [
          String(id),
          businessId ? String(businessId) : null,
          String(proposalId),
          String(requestedOutcome),
          JSON.stringify(evidence),
          JSON.stringify(affectedBusinesses),
          JSON.stringify(proposedUniversalCapability),
          JSON.stringify(proposedPackageExtension),
          whyInsufficient,
          JSON.stringify(safetyRequirements),
          JSON.stringify(estimatedDependencies),
          String(status),
          createdByUserId ? String(createdByUserId) : null,
        ],
      ),
    );
    return mapBusinessCapabilityProposalRow(rows[0] ?? null);
  }

  async listBusinessCapabilityProposals(businessId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM business_capability_proposals WHERE business_id = $1 ORDER BY updated_at DESC`,
        [String(businessId)],
      ),
    );
    return rows.map(mapBusinessCapabilityProposalRow);
  }

  async getBusinessCapabilityProposal(proposalId, businessId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM business_capability_proposals WHERE proposal_id = $1 AND business_id = $2`,
        [String(proposalId), String(businessId)],
      ),
    );
    return mapBusinessCapabilityProposalRow(rows[0] ?? null);
  }

  async upsertAiBuilderSession(session) {
    const sessionId = String(session.sessionId);
    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO ai_builder_sessions (
           id, session_id, business_id, actor_user_id, mode, current_stage,
           business_summary, website_urls, uploaded_artifact_ids, questions, answers,
           evidence, assumptions, unresolved_questions, recommendations,
           selected_blueprints, selected_components, capability_gaps, conversation,
           specification_id, specification_content_hash, installation_plan_id,
           installation_plan_hash, progress, appearance, metadata, created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,
           $7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,
           $12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,
           $16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,
           $20,$21,$22,$23,$24::jsonb,$25::jsonb,$26::jsonb,
           COALESCE($27::timestamptz, NOW()), NOW()
         )
         ON CONFLICT (session_id)
         DO UPDATE SET
           business_id = EXCLUDED.business_id,
           actor_user_id = EXCLUDED.actor_user_id,
           mode = EXCLUDED.mode,
           current_stage = EXCLUDED.current_stage,
           business_summary = EXCLUDED.business_summary,
           website_urls = EXCLUDED.website_urls,
           uploaded_artifact_ids = EXCLUDED.uploaded_artifact_ids,
           questions = EXCLUDED.questions,
           answers = EXCLUDED.answers,
           evidence = EXCLUDED.evidence,
           assumptions = EXCLUDED.assumptions,
           unresolved_questions = EXCLUDED.unresolved_questions,
           recommendations = EXCLUDED.recommendations,
           selected_blueprints = EXCLUDED.selected_blueprints,
           selected_components = EXCLUDED.selected_components,
           capability_gaps = EXCLUDED.capability_gaps,
           conversation = EXCLUDED.conversation,
           specification_id = EXCLUDED.specification_id,
           specification_content_hash = EXCLUDED.specification_content_hash,
           installation_plan_id = EXCLUDED.installation_plan_id,
           installation_plan_hash = EXCLUDED.installation_plan_hash,
           progress = EXCLUDED.progress,
           appearance = EXCLUDED.appearance,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
         RETURNING *`,
        [
          sessionId,
          sessionId,
          isUuidLike(session.businessId) ? String(session.businessId) : null,
          isUuidLike(session.actorId) ? String(session.actorId) : null,
          String(session.mode),
          String(session.currentStage),
          JSON.stringify(session.businessSummary ?? {}),
          JSON.stringify(session.websiteUrls ?? []),
          JSON.stringify(session.uploadedArtifactIds ?? []),
          JSON.stringify(session.questions ?? []),
          JSON.stringify(session.answers ?? []),
          JSON.stringify(session.evidence ?? []),
          JSON.stringify(session.assumptions ?? []),
          JSON.stringify(session.unresolvedQuestions ?? []),
          JSON.stringify(session.recommendations ?? []),
          JSON.stringify(session.selectedBlueprints ?? []),
          JSON.stringify(session.selectedComponents ?? []),
          JSON.stringify(session.capabilityGaps ?? []),
          JSON.stringify(session.conversation ?? []),
          session.specificationId ? String(session.specificationId) : null,
          session.specificationContentHash ? String(session.specificationContentHash) : null,
          session.installationPlanId ? String(session.installationPlanId) : null,
          session.installationPlanHash ? String(session.installationPlanHash) : null,
          JSON.stringify(session.progress ?? {}),
          JSON.stringify(session.appearance ?? {}),
          JSON.stringify(session.metadata ?? {}),
          session.createdAt ?? null,
        ],
      ),
    );
    return mapAiBuilderSessionRow(rows[0] ?? null);
  }

  async getAiBuilderSession(sessionId) {
    const { rows } = await this.withClient((client) =>
      client.query(`SELECT * FROM ai_builder_sessions WHERE session_id = $1`, [String(sessionId)]),
    );
    return mapAiBuilderSessionRow(rows[0] ?? null);
  }

  async listAiBuilderSessionsForBusiness(businessId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM ai_builder_sessions WHERE business_id = $1 ORDER BY updated_at DESC`,
        [String(businessId)],
      ),
    );
    return rows.map(mapAiBuilderSessionRow);
  }

  async listAiBuilderSessions() {
    const { rows } = await this.withClient((client) =>
      client.query(`SELECT * FROM ai_builder_sessions ORDER BY updated_at DESC LIMIT 500`),
    );
    return rows.map(mapAiBuilderSessionRow);
  }

  async listAuditEvents({ limit = 50 } = {}) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM audit_events ORDER BY created_at DESC LIMIT $1`,
        [Number(limit) || 50],
      ),
    );
    return rows.map((row) => ({
      id: String(row.id),
      actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
      businessId: row.business_id ? String(row.business_id) : null,
      action: String(row.action),
      targetType: row.target_type ? String(row.target_type) : null,
      targetId: row.target_id ? String(row.target_id) : null,
      metadata: row.metadata ?? {},
      createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    }));
  }

  async listUsers() {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT id, email, name, platform_role, created_at
         FROM users
         ORDER BY created_at DESC
         LIMIT 500`,
      ),
    );
    return rows.map((row) => ({
      id: String(row.id),
      email: String(row.email),
      name: row.name ? String(row.name) : null,
      platformRole: row.platform_role ? String(row.platform_role) : null,
      createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    }));
  }

  async listActiveSupportSessions() {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM support_access_sessions
         WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY started_at DESC
         LIMIT 100`,
      ),
    );
    return rows.map(mapSupportAccessSessionRow);
  }

  async upsertSupportAccessSession(session) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO support_access_sessions (
           id, session_id, business_id, admin_user_id, reason, mode, status,
           started_at, expires_at, ended_at, permanent_membership_granted, metadata, updated_at
         ) VALUES (
           $1, $2, $3::uuid, $4::uuid, $5, $6, $7,
           $8::timestamptz, $9::timestamptz, $10::timestamptz, $11, $12::jsonb, NOW()
         )
         ON CONFLICT (session_id) DO UPDATE SET
           status = EXCLUDED.status,
           ended_at = EXCLUDED.ended_at,
           expires_at = EXCLUDED.expires_at,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
         RETURNING *`,
        [
          session.sessionId,
          session.sessionId,
          String(session.businessId),
          String(session.adminUserId),
          String(session.reason),
          String(session.mode ?? "read_only"),
          String(session.status ?? "active"),
          session.startedAt ?? new Date().toISOString(),
          session.expiresAt ?? null,
          session.endedAt ?? null,
          Boolean(session.permanentMembershipGranted),
          JSON.stringify(session.metadata ?? {}),
        ],
      ),
    );
    return mapSupportAccessSessionRow(rows[0]);
  }

  async getActiveSupportAccessSession(adminUserId, businessId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM support_access_sessions
         WHERE admin_user_id = $1::uuid AND business_id = $2::uuid AND status = 'active'
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY started_at DESC
         LIMIT 1`,
        [String(adminUserId), String(businessId)],
      ),
    );
    return mapSupportAccessSessionRow(rows[0] ?? null);
  }

  async getSupportAccessSession(sessionId) {
    const { rows } = await this.withClient((client) =>
      client.query(`SELECT * FROM support_access_sessions WHERE session_id = $1`, [String(sessionId)]),
    );
    return mapSupportAccessSessionRow(rows[0] ?? null);
  }

  async upsertAccessRequest(record) {
    const id = String(record.accessRequestId);
    const approverId = isUuidLike(record.approverUserId) ? String(record.approverUserId) : null;
    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO business_access_requests (
           id, access_request_id, business_id, requester_user_id, request_kind,
           requested_permission, requested_module_id, requested_role_id, record_scope,
           reason, duration_hours, risk_level, status, approver_user_id,
           work_item_id, approval_request_id, current_access, decision_notes, decided_at, metadata, updated_at
         ) VALUES (
           $1, $2, $3::uuid, $4::uuid, $5,
           $6, $7, $8, $9,
           $10, $11, $12, $13, $14::uuid,
           $15, $16, $17::jsonb, $18, $19::timestamptz, $20::jsonb, NOW()
         )
         ON CONFLICT (business_id, access_request_id) DO UPDATE SET
           request_kind = EXCLUDED.request_kind,
           requested_permission = EXCLUDED.requested_permission,
           requested_module_id = EXCLUDED.requested_module_id,
           requested_role_id = EXCLUDED.requested_role_id,
           record_scope = EXCLUDED.record_scope,
           reason = EXCLUDED.reason,
           duration_hours = EXCLUDED.duration_hours,
           risk_level = EXCLUDED.risk_level,
           status = EXCLUDED.status,
           approver_user_id = EXCLUDED.approver_user_id,
           work_item_id = EXCLUDED.work_item_id,
           approval_request_id = EXCLUDED.approval_request_id,
           current_access = EXCLUDED.current_access,
           decision_notes = EXCLUDED.decision_notes,
           decided_at = EXCLUDED.decided_at,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
         RETURNING *`,
        [
          id,
          id,
          String(record.businessId),
          String(record.requesterUserId),
          String(record.requestKind),
          record.requestedPermission ?? null,
          record.requestedModuleId ?? null,
          record.requestedRoleId ?? null,
          record.recordScope ?? null,
          String(record.reason),
          record.durationHours ?? null,
          String(record.riskLevel ?? "medium"),
          String(record.status ?? "pending"),
          approverId,
          record.workItemId ?? null,
          record.approvalRequestId ?? null,
          JSON.stringify(record.currentAccess ?? {}),
          record.decisionNotes ?? null,
          record.decidedAt ?? null,
          JSON.stringify(record.metadata ?? {}),
        ],
      ),
    );
    return mapAccessRequestRow(rows[0]);
  }

  async getAccessRequest(businessId, accessRequestId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM business_access_requests
         WHERE business_id = $1::uuid AND access_request_id = $2
         LIMIT 1`,
        [String(businessId), String(accessRequestId)],
      ),
    );
    return mapAccessRequestRow(rows[0] ?? null);
  }

  async getAccessRequestByWorkItemId(workItemId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM business_access_requests WHERE work_item_id = $1 LIMIT 1`,
        [String(workItemId)],
      ),
    );
    return mapAccessRequestRow(rows[0] ?? null);
  }

  async getAccessRequestByApprovalId(approvalRequestId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM business_access_requests WHERE approval_request_id = $1 LIMIT 1`,
        [String(approvalRequestId)],
      ),
    );
    return mapAccessRequestRow(rows[0] ?? null);
  }

  async listOpenAccessRequests(businessId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM business_access_requests
         WHERE business_id = $1::uuid AND status = 'pending'
         ORDER BY created_at DESC`,
        [String(businessId)],
      ),
    );
    return rows.map(mapAccessRequestRow);
  }

  async listAccessRequests(businessId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM business_access_requests
         WHERE business_id = $1::uuid
         ORDER BY created_at DESC
         LIMIT 200`,
        [String(businessId)],
      ),
    );
    return rows.map(mapAccessRequestRow);
  }

  async upsertBusinessAnalyticsDefinitions({ businessId, payload }) {
    const id = `analytics_defs_${businessId}`;
    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO business_analytics_definitions (id, business_id, payload, updated_at)
         VALUES ($1, $2::uuid, $3::jsonb, NOW())
         ON CONFLICT (business_id) DO UPDATE SET
           payload = EXCLUDED.payload,
           updated_at = NOW()
         RETURNING *`,
        [id, String(businessId), JSON.stringify(payload ?? {})],
      ),
    );
    return mapAnalyticsDefinitionsRow(rows[0]);
  }

  async getBusinessAnalyticsDefinitions(businessId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM business_analytics_definitions WHERE business_id = $1::uuid`,
        [String(businessId)],
      ),
    );
    return mapAnalyticsDefinitionsProp(rows[0] ?? null);
  }

  async upsertCapabilityProofRecord({
    businessId,
    capabilityId,
    proveAction,
    ok = false,
    verified = false,
    detail = {},
  } = {}) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO capability_proof_records (
           business_id, capability_id, prove_action, ok, verified, detail, updated_at
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, NOW())
         ON CONFLICT (business_id, capability_id) DO UPDATE SET
           prove_action = EXCLUDED.prove_action,
           ok = EXCLUDED.ok,
           verified = EXCLUDED.verified,
           detail = EXCLUDED.detail,
           updated_at = NOW()
         RETURNING *`,
        [
          String(businessId),
          String(capabilityId),
          String(proveAction),
          Boolean(ok),
          Boolean(verified),
          JSON.stringify(detail ?? {}),
        ],
      ),
    );
    return mapCapabilityProofRow(rows[0]);
  }

  async listCapabilityProofRecords(businessId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM capability_proof_records
         WHERE business_id = $1::uuid
         ORDER BY capability_id ASC`,
        [String(businessId)],
      ),
    );
    return rows.map(mapCapabilityProofRow);
  }

  async getCapabilityProofRecord(businessId, capabilityId) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM capability_proof_records
         WHERE business_id = $1::uuid AND capability_id = $2
         LIMIT 1`,
        [String(businessId), String(capabilityId)],
      ),
    );
    return rows[0] ? mapCapabilityProofRow(rows[0]) : null;
  }

  async touchWorkerHeartbeat({ workerId, status = "ok", detail = {} } = {}) {
    await this.withClient((client) =>
      client.query(
        `INSERT INTO platform_worker_heartbeat (worker_id, status, detail, last_seen_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (worker_id) DO UPDATE SET
           status = EXCLUDED.status,
           detail = EXCLUDED.detail,
           last_seen_at = NOW()`,
        [String(workerId), String(status), JSON.stringify(detail ?? {})],
      ),
    );
    return { workerId: String(workerId), status: String(status) };
  }

  async getLatestWorkerHeartbeat({ maxAgeSeconds = 60 } = {}) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT worker_id, status, detail, last_seen_at
         FROM platform_worker_heartbeat
         ORDER BY last_seen_at DESC
         LIMIT 1`,
      ),
    );
    const row = rows[0];
    if (!row) return { ok: false, reason: "no_heartbeat" };
    const ageMs = Date.now() - new Date(row.last_seen_at).getTime();
    const fresh = ageMs <= Number(maxAgeSeconds) * 1000;
    return {
      ok: fresh && String(row.status) === "ok",
      workerId: String(row.worker_id),
      status: String(row.status),
      ageMs,
      lastSeenAt: row.last_seen_at?.toISOString?.() ?? row.last_seen_at,
      detail: row.detail ?? {},
    };
  }
}

function mapCapabilityProofRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    capabilityId: String(row.capability_id),
    proveAction: String(row.prove_action),
    ok: Boolean(row.ok),
    verified: Boolean(row.verified),
    detail: row.detail ?? {},
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at ?? null,
  };
}

function mapSupportAccessSessionRow(row) {
  if (!row) return null;
  return {
    sessionId: String(row.session_id),
    businessId: String(row.business_id),
    adminUserId: String(row.admin_user_id),
    reason: String(row.reason),
    mode: String(row.mode),
    status: String(row.status),
    startedAt: row.started_at?.toISOString?.() ?? row.started_at,
    expiresAt: row.expires_at?.toISOString?.() ?? row.expires_at,
    endedAt: row.ended_at?.toISOString?.() ?? row.ended_at,
    permanentMembershipGranted: Boolean(row.permanent_membership_granted),
    metadata: row.metadata ?? {},
  };
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ""));
}

function mapAccessRequestRow(row) {
  if (!row) return null;
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    accessRequestId: String(row.access_request_id),
    businessId: String(row.business_id),
    requesterUserId: String(row.requester_user_id),
    requestKind: String(row.request_kind),
    requestedPermission: row.requested_permission == null ? null : String(row.requested_permission),
    requestedModuleId: row.requested_module_id == null ? null : String(row.requested_module_id),
    requestedRoleId: row.requested_role_id == null ? null : String(row.requested_role_id),
    recordScope: row.record_scope == null ? null : String(row.record_scope),
    reason: String(row.reason),
    durationHours: row.duration_hours == null ? null : Number(row.duration_hours),
    currentAccess: row.current_access ?? {},
    riskLevel: String(row.risk_level ?? "medium"),
    approverUserId: row.approver_user_id == null
      ? (metadata.approverLabel ? String(metadata.approverLabel) : null)
      : String(row.approver_user_id),
    status: String(row.status),
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    decidedAt: row.decided_at?.toISOString?.() ?? row.decided_at ?? null,
    decisionNotes: row.decision_notes == null ? null : String(row.decision_notes),
    workItemId: row.work_item_id == null ? null : String(row.work_item_id),
    approvalRequestId: row.approval_request_id == null ? null : String(row.approval_request_id),
    metadata,
  };
}

function mapAnalyticsDefinitionsRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    payload: row.payload ?? {},
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}
function mapBusinessOSSpecificationRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    businessId: row.business_id ? String(row.business_id) : null,
    specificationId: String(row.specification_id),
    specificationVersion: Number(row.specification_version),
    schemaVersion: Number(row.schema_version),
    status: String(row.status),
    contentHash: String(row.content_hash),
    specification: row.specification,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

function mapBusinessOSInstallationRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    specificationRowId: row.specification_row_id ? String(row.specification_row_id) : null,
    specificationId: String(row.specification_id),
    specificationVersion: Number(row.specification_version),
    specificationContentHash: String(row.specification_content_hash),
    planId: String(row.plan_id),
    status: String(row.status),
    plan: row.plan,
    actionCheckpoints: row.action_checkpoints,
    configuration: row.configuration,
    history: row.history,
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    installedAt: row.installed_at?.toISOString?.() ?? row.installed_at,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

function mapBusinessBuilderSessionRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    businessId: row.business_id ? String(row.business_id) : null,
    status: String(row.status),
    mode: String(row.mode),
    discovery: row.discovery,
    evidence: row.evidence,
    specificationRowId: row.specification_row_id ? String(row.specification_row_id) : null,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

function mapBusinessCapabilityProposalRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    businessId: row.business_id ? String(row.business_id) : null,
    proposalId: String(row.proposal_id),
    requestedOutcome: String(row.requested_outcome),
    evidence: row.evidence,
    affectedBusinesses: row.affected_businesses,
    proposedUniversalCapability: row.proposed_universal_capability,
    proposedPackageExtension: row.proposed_package_extension,
    whyInsufficient: row.why_insufficient,
    safetyRequirements: row.safety_requirements,
    estimatedDependencies: row.estimated_dependencies,
    status: String(row.status),
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

function mapAiBuilderSessionRow(row) {
  if (!row) return null;
  return {
    sessionId: String(row.session_id),
    businessId: row.business_id ? String(row.business_id) : null,
    actorId: row.actor_user_id ? String(row.actor_user_id) : null,
    mode: String(row.mode),
    currentStage: String(row.current_stage),
    businessSummary: row.business_summary ?? {},
    websiteUrls: row.website_urls ?? [],
    uploadedArtifactIds: row.uploaded_artifact_ids ?? [],
    questions: row.questions ?? [],
    answers: row.answers ?? [],
    evidence: row.evidence ?? [],
    assumptions: row.assumptions ?? [],
    unresolvedQuestions: row.unresolved_questions ?? [],
    recommendations: row.recommendations ?? [],
    selectedBlueprints: row.selected_blueprints ?? [],
    selectedComponents: row.selected_components ?? [],
    capabilityGaps: row.capability_gaps ?? [],
    conversation: row.conversation ?? [],
    specificationId: row.specification_id ? String(row.specification_id) : null,
    specificationContentHash: row.specification_content_hash
      ? String(row.specification_content_hash)
      : null,
    installationPlanId: row.installation_plan_id ? String(row.installation_plan_id) : null,
    installationPlanHash: row.installation_plan_hash ? String(row.installation_plan_hash) : null,
    progress: row.progress ?? {},
    appearance: row.appearance ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}
