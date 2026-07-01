import DashboardHeader from "./DashboardHeader";
import DigitalWorkforceCard from "./DigitalWorkforceCard";
import LiveActivityFeed, {
  type LiveActivityEntry,
} from "./LiveActivityFeed";
import QuickActions from "./QuickActions";
import { demoCompany } from "@/lib/company/demoCompany";

export default function Dashboard() {
  const buyersById = new Map(
    demoCompany.companyData.buyers.map((b) => [b.buyerId, b.name]),
  );
  const propertiesById = new Map(
    demoCompany.companyData.properties.map((p) => [p.propertyId, p]),
  );

  const formatTime = (iso: string) =>
    new Date(iso).toISOString().slice(11, 16);

  const addMinutes = (iso: string, minutes: number) => {
    const d = new Date(iso);
    d.setUTCMinutes(d.getUTCMinutes() + minutes);
    return d.toISOString();
  };

  const entriesWithSort = demoCompany.companyData.inquiries.flatMap((i) => {
    const buyerName = buyersById.get(i.buyerId) ?? "Buyer";
    const property = propertiesById.get(i.propertyId);
    const propertyAddress = property?.address ?? "Property";

    return [
      {
        time: formatTime(i.submittedAtISO),
        employee: i.employeeName,
        activity: "Received Inquiry",
        object: buyerName,
        sortISO: i.submittedAtISO,
      },
      {
        time: formatTime(i.createdTimeISO),
        employee: i.employeeName,
        activity: "Reviewed Property",
        object: propertyAddress,
        sortISO: i.createdTimeISO,
      },
      {
        time: formatTime(addMinutes(i.createdTimeISO, 1)),
        employee: i.employeeName,
        activity: i.draftResponseReady
          ? "Prepared Draft Email"
          : "Draft In Progress",
        object: propertyAddress,
        sortISO: addMinutes(i.createdTimeISO, 1),
      },
      ...(i.status === "Needs Review" && i.draftResponseReady
        ? [
            {
              time: formatTime(addMinutes(i.createdTimeISO, 2)),
              employee: i.employeeName,
              activity: "Waiting For Approval",
              object: propertyAddress,
              sortISO: addMinutes(i.createdTimeISO, 2),
            },
          ]
        : []),
    ];
  });

  const timelineEntries: LiveActivityEntry[] = entriesWithSort
    .sort((a, b) => new Date(a.sortISO).getTime() - new Date(b.sortISO).getTime())
    .map(({ sortISO, ...e }) => e);

  return (
    <div className="space-y-8">
      <DashboardHeader />
      <DigitalWorkforceCard />
      <LiveActivityFeed entries={timelineEntries} />
      <QuickActions />
    </div>
  );
}

