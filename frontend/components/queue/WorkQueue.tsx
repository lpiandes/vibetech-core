 "use client";

import { motion } from "framer-motion";

import QueueHeader from "./QueueHeader";
import QueueFilters from "./QueueFilters";
import QueueItem, { type QueueItemModel } from "./QueueItem";
import EmptyState from "./EmptyState";

const mockItems: QueueItemModel[] = [
  {
    id: "q1",
    title: "Settlement Offer",
    clientName: "Thompson Legal Group",
    matterType: "Settlement Negotiation",
    priority: "High",
    status: "Needs Review",
    employee: "Client Update Employee",
    createdTimeISO: "2026-06-25T13:15:00.000Z",
  },
  {
    id: "q2",
    title: "Client Requested Update",
    clientName: "Harborstone Law",
    matterType: "Client Communication",
    priority: "Medium",
    status: "Needs Review",
    employee: "Client Update Employee",
    createdTimeISO: "2026-06-25T14:05:00.000Z",
  },
  {
    id: "q3",
    title: "Discovery Documents",
    clientName: "Evergreen Chambers",
    matterType: "Discovery Intake",
    priority: "Medium",
    status: "Approved",
    employee: "Client Update Employee",
    createdTimeISO: "2026-06-24T18:30:00.000Z",
  },
  {
    id: "q4",
    title: "Hearing Rescheduled",
    clientName: "Cedar & Stone Attorneys",
    matterType: "Court Events",
    priority: "High",
    status: "Needs Review",
    employee: "Client Update Employee",
    createdTimeISO: "2026-06-25T11:50:00.000Z",
  },
  {
    id: "q5",
    title: "Medical Records Received",
    clientName: "Summit Legal Services",
    matterType: "Medical Evidence",
    priority: "Low",
    status: "Completed",
    employee: "Client Update Employee",
    createdTimeISO: "2026-06-23T16:20:00.000Z",
  },
  {
    id: "q6",
    title: "Insurance Response",
    clientName: "Northwind Law Partners",
    matterType: "Insurance Correspondence",
    priority: "Medium",
    status: "Approved",
    employee: "Client Update Employee",
    createdTimeISO: "2026-06-24T21:10:00.000Z",
  },
  {
    id: "q7",
    title: "Case Closed",
    clientName: "Brightwater Legal",
    matterType: "Case Closure",
    priority: "Low",
    status: "Completed",
    employee: "Client Update Employee",
    createdTimeISO: "2026-06-25T06:35:00.000Z",
  },
  {
    id: "q8",
    title: "Waiting on Opposing Counsel",
    clientName: "Marigold Legal",
    matterType: "External Party Coordination",
    priority: "Low",
    status: "Needs Review",
    employee: "Client Update Employee",
    createdTimeISO: "2026-06-25T08:20:00.000Z",
  },
];

export default function WorkQueue() {
  return (
    <div className="space-y-8">
      <QueueHeader />

      <QueueFilters />

      <div className="space-y-5">
        {mockItems.length === 0 ? (
          <EmptyState />
        ) : (
          mockItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02, duration: 0.25 }}
            >
              <QueueItem item={item} />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

