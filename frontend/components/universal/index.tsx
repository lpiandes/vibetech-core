"use client";

import type { ComponentType } from "react";
import { isRegisteredUniversalComponent } from "@/lib/universal-components/registry.js";
import { UNIVERSAL_REACT_MAP_KEYS } from "@/lib/universal-components/reactMapKeys.js";

import { MetricCards, KpiCards, InsightCards, AiRecommendationCards, Charts, Reports } from "./MetricsComponents";
import { ActivityFeed, Timeline, Calendar, SchedulingBoard } from "./TimelineComponents";
import { WorkQueue, ApprovalQueue, KanbanBoard, TaskList } from "./WorkComponents";
import { CommunicationCenter, Inbox, Notifications, Alerts } from "./CommunicationComponents";
import { KnowledgeBrowser, DocumentViewer, Attachments } from "./KnowledgeComponents";
import { Tables, DataGrid, SearchResults, Filters } from "./DataComponents";
import { EmployeeCards, TeamDirectory, OrganizationChart, CustomerList } from "./PeopleComponents";
import { AssetList, SubjectBrowser, PropertyBrowser, PatientBrowser, PlayerBrowser } from "./SubjectComponents";
import { Notes, Comments, AuditHistory } from "./CollaborationComponents";
import {
  QuickActions,
  DashboardSections,
  EmptyStates,
  SetupWizards,
  StatusBadges,
  Tags,
} from "./LayoutActionComponents";

/**
 * Static component map — never dynamic eval, never arbitrary React generation.
 */
const UNIVERSAL_COMPONENT_MAP: Record<string, ComponentType<any>> = {
  metric_cards: MetricCards,
  kpi_cards: KpiCards,
  insight_cards: InsightCards,
  ai_recommendation_cards: AiRecommendationCards,
  charts: Charts,
  reports: Reports,
  activity_feed: ActivityFeed,
  timeline: Timeline,
  calendar: Calendar,
  scheduling_board: SchedulingBoard,
  work_queue: WorkQueue,
  approval_queue: ApprovalQueue,
  kanban_board: KanbanBoard,
  task_list: TaskList,
  communication_center: CommunicationCenter,
  inbox: Inbox,
  notifications: Notifications,
  alerts: Alerts,
  knowledge_browser: KnowledgeBrowser,
  document_viewer: DocumentViewer,
  attachments: Attachments,
  tables: Tables,
  data_grid: DataGrid,
  search_results: SearchResults,
  filters: Filters,
  employee_cards: EmployeeCards,
  team_directory: TeamDirectory,
  organization_chart: OrganizationChart,
  customer_list: CustomerList,
  asset_list: AssetList,
  subject_browser: SubjectBrowser,
  property_browser: PropertyBrowser,
  patient_browser: PatientBrowser,
  player_browser: PlayerBrowser,
  notes: Notes,
  comments: Comments,
  audit_history: AuditHistory,
  quick_actions: QuickActions,
  dashboard_sections: DashboardSections,
  empty_states: EmptyStates,
  setup_wizards: SetupWizards,
  status_badges: StatusBadges,
  tags: Tags,
};

for (const key of UNIVERSAL_REACT_MAP_KEYS) {
  if (!UNIVERSAL_COMPONENT_MAP[key]) {
    throw new Error(`Universal component map missing implementation for "${key}"`);
  }
}

export function resolveUniversalReactComponent(type: string): ComponentType<any> | null {
  if (!isRegisteredUniversalComponent(type)) return null;
  return UNIVERSAL_COMPONENT_MAP[String(type)] ?? null;
}

export function UniversalComponent({
  type,
  ...props
}: { type: string } & Record<string, unknown>) {
  const Component = resolveUniversalReactComponent(type);
  if (!Component) return null;
  return <Component {...props} />;
}

export {
  MetricCards,
  KpiCards,
  InsightCards,
  AiRecommendationCards,
  Charts,
  Reports,
  ActivityFeed,
  Timeline,
  Calendar,
  SchedulingBoard,
  WorkQueue,
  ApprovalQueue,
  KanbanBoard,
  TaskList,
  CommunicationCenter,
  Inbox,
  Notifications,
  Alerts,
  KnowledgeBrowser,
  DocumentViewer,
  Attachments,
  Tables,
  DataGrid,
  SearchResults,
  Filters,
  EmployeeCards,
  TeamDirectory,
  OrganizationChart,
  CustomerList,
  AssetList,
  SubjectBrowser,
  PropertyBrowser,
  PatientBrowser,
  PlayerBrowser,
  Notes,
  Comments,
  AuditHistory,
  QuickActions,
  DashboardSections,
  EmptyStates,
  SetupWizards,
  StatusBadges,
  Tags,
};
