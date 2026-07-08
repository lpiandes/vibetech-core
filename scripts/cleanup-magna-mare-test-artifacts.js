#!/usr/bin/env node
/**
 * One-off: remove confirmed @manual.local test artifacts from magna mare dev business.
 * Safe to re-run (no-ops when artifacts are already gone).
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { withClient, closePool } from "../backend/core/platform/db/pool.js";

const MAGNA_MARE_BUSINESS_ID = "e58a7a52-969b-4377-a77e-98500e5bf648";
const PRESERVE_OWNER_MEMBERSHIP_ID = "bb7681a3-6170-40a7-a5eb-05acda22bdff";
const PRESERVE_OWNER_USER_ID = "5cdd1989-d04d-42a8-b950-f6977bf4f15d";
const PRESERVE_PENDING_INVITATION_ID = "99027338-ad4e-4dd2-a1cb-dff0f054a726";

const TEST_MEMBERSHIP_IDS = [
  "aa5e8e89-09f0-4df3-8b9a-765bc08ab8d9",
  "97b1fb3f-a4b9-4586-8eff-a3ad0bdad2a9",
  "316fa115-8d1c-428e-9700-801b93e21191",
  "aaabfcfa-336a-4ef6-9899-a43fab9e2da7",
  "59dfd46a-6edd-40f6-8285-9443278590a0",
  "ca462c59-ef2d-4b7b-9e7a-6cd006476e27",
];

const TEST_USER_IDS = [
  "14b7c76c-133f-4350-923d-1c6be7fbcbf7",
  "d8170110-ba33-41b2-be9b-92917d8de437",
  "dfc36004-9f5c-4cb4-ab66-25b5d37d93e6",
  "3d647a8e-ce97-4efe-9986-2546c4f16a30",
  "ae621685-849d-4f0d-af97-e1417aac6e64",
  "0bbbacf1-add7-4a80-8889-5aadffc87431",
  "4d9f6b55-4849-40ca-b069-33218baac646",
];

const result = await withClient(async (client) => {
  await client.query("BEGIN");

  const biz = await client.query(`SELECT id, name FROM businesses WHERE id = $1`, [MAGNA_MARE_BUSINESS_ID]);
  if (!biz.rows[0]) throw new Error("magna mare business not found");

  const ownerMem = await client.query(`SELECT id, user_id FROM business_memberships WHERE id = $1`, [
    PRESERVE_OWNER_MEMBERSHIP_ID,
  ]);
  if (ownerMem.rows[0]?.user_id !== PRESERVE_OWNER_USER_ID) {
    throw new Error("Owner membership preflight failed");
  }

  const pending = await client.query(
    `SELECT id, email, role FROM invitations
     WHERE id = $1 AND business_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL`,
    [PRESERVE_PENDING_INVITATION_ID, MAGNA_MARE_BUSINESS_ID],
  );
  if (!pending.rows[0] || pending.rows[0].role !== "MANAGER") {
    throw new Error("Pending Manager invitation preflight failed");
  }

  for (const membershipId of TEST_MEMBERSHIP_IDS) {
    const row = await client.query(`SELECT id, user_id, business_id FROM business_memberships WHERE id = $1`, [
      membershipId,
    ]);
    if (!row.rows[0]) continue;
    if (row.rows[0].business_id !== MAGNA_MARE_BUSINESS_ID) {
      throw new Error(`Membership ${membershipId} is not scoped to magna mare`);
    }
    if (row.rows[0].user_id === PRESERVE_OWNER_USER_ID) {
      throw new Error(`Refusing to delete owner membership ${membershipId}`);
    }
  }

  const deletedMemberships = await client.query(
    `DELETE FROM business_memberships
     WHERE id = ANY($1::uuid[]) AND business_id = $2
     RETURNING id`,
    [TEST_MEMBERSHIP_IDS, MAGNA_MARE_BUSINESS_ID],
  );

  const deletedUsers = await client.query(
    `DELETE FROM users u
     WHERE u.id = ANY($1::uuid[])
       AND u.id <> $2
       AND u.email LIKE '%@manual.local'
       AND NOT EXISTS (SELECT 1 FROM business_memberships m WHERE m.user_id = u.id)
     RETURNING id, email`,
    [TEST_USER_IDS, PRESERVE_OWNER_USER_ID],
  );

  await client.query("COMMIT");

  const remaining = await client.query(
    `SELECT u.email, u.name, m.role
     FROM business_memberships m JOIN users u ON u.id = m.user_id
     WHERE m.business_id = $1 AND m.status = 'ACTIVE'
     ORDER BY m.created_at`,
    [MAGNA_MARE_BUSINESS_ID],
  );

  return {
    businessName: biz.rows[0].name,
    deletedMemberships: deletedMemberships.rows,
    deletedUsers: deletedUsers.rows,
    remainingMembers: remaining.rows,
    pendingInvitation: pending.rows[0],
  };
});

console.log("Cleanup complete for magna mare:");
console.log(JSON.stringify(result, null, 2));
await closePool();
