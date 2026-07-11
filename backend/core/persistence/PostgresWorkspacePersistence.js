import { WorkspacePersistencePort } from "./WorkspacePersistencePort.js";

const SCHEMA_VERSION = 1;

export class PostgresWorkspacePersistence extends WorkspacePersistencePort {
  /**
   * @param {(fn: (client: any) => Promise<any>) => Promise<any>} withClient
   */
  constructor(withClient) {
    super();
    if (typeof withClient !== "function") {
      throw new Error("PostgresWorkspacePersistence requires a withClient database port");
    }
    this.withClient = withClient;
  }

  async loadRuntimeSnapshots(workspaceId) {
    const wid = String(workspaceId ?? "");
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT runtime_kind, schema_version, state
         FROM workspace_runtime_snapshots
         WHERE workspace_id = $1`,
        [wid],
      ),
    );
    return rows.map((row) => ({
      kind: String(row.runtime_kind),
      state: row.state,
      schemaVersion: Number(row.schema_version ?? SCHEMA_VERSION),
    }));
  }

  async saveRuntimeSnapshots(workspaceId, snapshots) {
    const wid = String(workspaceId ?? "");
    if (!snapshots?.length) return;

    await this.withClient(async (client) => {
      await client.query("BEGIN");
      try {
        for (const snapshot of snapshots) {
          const kind = String(snapshot?.kind ?? "");
          if (!kind || snapshot?.state === undefined) continue;
          await client.query(
            `INSERT INTO workspace_runtime_snapshots (workspace_id, runtime_kind, schema_version, state, updated_at)
             VALUES ($1, $2, $3, $4::jsonb, NOW())
             ON CONFLICT (workspace_id, runtime_kind)
             DO UPDATE SET schema_version = EXCLUDED.schema_version,
                           state = EXCLUDED.state,
                           updated_at = NOW()`,
            [wid, kind, snapshot.schemaVersion ?? SCHEMA_VERSION, JSON.stringify(snapshot.state)],
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    });
  }
}
