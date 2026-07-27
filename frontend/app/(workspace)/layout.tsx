import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SELECTED_WORKSPACE_COOKIE } from "@/lib/workspace/getWorkspaceService";

const PATH_MAP: Record<string, string> = {
  "/home": "home",
  "/mission-control": "home",
  "/attention": "intelligence",
  "/for-you": "intelligence",
  "/work": "work",
  "/work-queue": "work",
  "/people": "people",
  "/engagement": "people",
  "/audiences": "people",
  "/team": "team",
  "/digital-workforce": "team",
  "/knowledge": "knowledge",
  "/connections": "integrations",
  "/analytics": "home",
  "/dashboard": "home",
  "/setup": "home",
  "/request": "work",
  "/communications": "inbox",
  "/automations": "automations",
  "/capabilities": "settings",
};

/**
 * Legacy `(workspace)/**` portal — redirect to canonical `/b/[businessId]/**`.
 * Preserves query string so deep links keep context.
 */
export default async function ProductWorkspaceLayout(_props: { children: ReactNode }) {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(SELECTED_WORKSPACE_COOKIE)?.value;
  if (!workspaceId) {
    redirect("/");
  }

  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "/home";
  const search = headerStore.get("x-search") ?? "";
  const mapped =
    PATH_MAP[pathname]
    ?? (pathname.startsWith("/") ? pathname.replace(/^\//, "").split("/")[0] : "home");

  if (pathname.startsWith("/engagement/")) {
    const partyId = pathname.split("/")[2];
    redirect(`/b/${encodeURIComponent(workspaceId)}/people/${encodeURIComponent(partyId ?? "")}${search}`);
  }
  if (pathname.startsWith("/work-queue/")) {
    const workId = pathname.split("/")[2];
    const qs = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    if (workId) qs.set("workId", workId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    redirect(`/b/${encodeURIComponent(workspaceId)}/work${suffix}`);
  }

  redirect(`/b/${encodeURIComponent(workspaceId)}/${mapped || "home"}${search}`);
}
