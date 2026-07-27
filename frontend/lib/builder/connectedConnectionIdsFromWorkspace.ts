/**
 * Connection type ids Home / Launch treat as live (calendar, business_email, …).
 */
export function connectedConnectionIdsFromWorkspace(service: any): string[] {
  const connected = new Set<string>();
  const runtime =
    service?.connected?.integrationPlatform?.connectionRuntime?.getConnections?.() ?? [];
  const snapshot = service?.connected?.connectedSystemsSnapshot?.connections ?? [];
  for (const conn of snapshot) {
    const id = String(conn?.id ?? "").trim();
    if (id && String(conn?.status ?? "").toUpperCase() === "CONNECTED") connected.add(id);
  }
  for (const conn of runtime) {
    const id = String(conn?.connectionType ?? "").trim();
    if (id && String(conn?.status ?? "").toUpperCase() === "CONNECTED") connected.add(id);
  }
  return [...connected];
}
