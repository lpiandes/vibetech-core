import { notFound } from "next/navigation";

import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import PeopleDetailRenderer from "@/components/people/PeopleDetailRenderer";
import CrmContactDetail from "@/components/people/CrmContactDetail";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";
import { getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import { readCrmState } from "../../../../../../backend/core/crm/CrmStore.js";
import { findContact } from "../../../../../../backend/core/crm/ensureCrmContactAndOptionalCard.js";
import { PERMISSIONS } from "@/lib/platform/permissions";

export default async function PeopleDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; partyId: string }>;
}) {
  const { businessId, partyId } = await params;

  return runTimedPage("people-detail", async () => {
    const { service } = await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);

    const installation = await getCachedBusinessOsInstallation(businessId).catch(() => null);
    const crm = readCrmState(installation);
    const contact = findContact(crm, { id: partyId, partyId });

    if (contact) {
      const cards = [];
      for (const pipe of crm.pipelines ?? []) {
        for (const card of pipe.cards ?? []) {
          if (String(card.contactId) === String(contact.id) || String(card.partyId) === String(contact.id)) {
            const stage = (pipe.stages ?? []).find((s: { id: string }) => s.id === card.stageId);
            cards.push({
              id: card.id,
              title: card.title,
              stageId: card.stageId,
              stageLabel: stage?.label,
              pipelineId: pipe.id,
              pipelineName: pipe.name,
              value: card.value,
            });
          }
        }
      }

      let linkedSubjects: Array<{ id?: string; displayName?: string }> = [];
      try {
        const viewModel = service.loadEngagementViewModel(String(contact.partyId || contact.id));
        linkedSubjects = Array.isArray(viewModel?.subjects) ? viewModel.subjects : [];
      } catch {
        linkedSubjects = [];
      }

      markRequestTiming("VIEW_MODEL", { source: "crm" });
      return (
        <CrmContactDetail
          businessId={businessId}
          model={{ contact, cards, linkedSubjects }}
        />
      );
    }

    let viewModel;
    try {
      viewModel = service.loadEngagementViewModel(partyId);
    } catch {
      notFound();
    }

    markRequestTiming("VIEW_MODEL", { source: "graph" });
    return <PeopleDetailRenderer businessId={businessId} viewModel={viewModel} />;
  });
}
