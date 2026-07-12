/**
 * Post-invite / first-run routing: Architect is primary when the business
 * has no installed Operating System yet.
 */
export async function resolvePostInviteRedirect({
  platformStore,
  getAiBuilderService,
  businessId,
  membershipRole,
  actorUserId,
  businessName = null,
}: {
  platformStore: any;
  getAiBuilderService: () => any;
  businessId: string;
  membershipRole: string | null | undefined;
  actorUserId: string;
  businessName?: string | null;
}): Promise<{ redirectTo: string; architectSessionId?: string }> {
  const home = `/b/${businessId}/home`;
  const role = String(membershipRole ?? "").toUpperCase();
  if (role !== "OWNER") {
    return { redirectTo: home };
  }

  let installation = null;
  try {
    installation = await platformStore.getBusinessOSInstallation?.(businessId);
  } catch {
    installation = null;
  }
  if (installation?.status === "installed") {
    return { redirectTo: home };
  }

  try {
    const builder = getAiBuilderService();
    const existing = await builder.listSessions?.({ businessId });
    const cards = existing?.sessions ?? [];
    const resumable = cards.find((row: any) => {
      const stage = String(row.stageKey ?? "");
      return stage && stage !== "installed" && stage !== "archived" && stage !== "failed";
    });
    if (resumable?.sessionId) {
      const sessionId = String(resumable.sessionId);
      return { redirectTo: `/architect/${sessionId}`, architectSessionId: sessionId };
    }

    const started = await builder.startSession({
      mode: "configure_existing_business",
      businessId,
      businessName: businessName ?? undefined,
      actorId: actorUserId,
      description: "Configure this business with Architect.",
    });
    const sessionId = started.session?.sessionId;
    if (sessionId) {
      return { redirectTo: `/architect/${sessionId}`, architectSessionId: sessionId };
    }
  } catch (err) {
    console.error("[post-invite] architect bootstrap failed", err);
  }

  return { redirectTo: `/architect?businessId=${encodeURIComponent(businessId)}` };
}
