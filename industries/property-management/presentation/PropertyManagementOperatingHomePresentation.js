import { deepFreeze } from "../../../backend/core/workspace/_utils/deepFreeze.js";

export const PROPERTY_MANAGEMENT_OPERATING_HOME_PRESENTATION = deepFreeze({
  metrics: {
    activeProperties: "Active properties",
    openInquiries: "Open inquiries",
    interestedProspects: "Interested prospects",
    openFollowUps: "Open follow-ups",
  },
  sections: {
    businessToday: "Business today",
    businessStatus: "Business status",
    attention: "Needs decision",
    movingNow: "Business moving now",
    digitalWorkforce: "Digital workforce",
    workInMotion: "Work in motion",
    propertyIntelligence: "Property intelligence",
    recentActivity: "Recent activity",
    recentCommunications: "Recent communications",
  },
  portfolioTable: {
    property: "Property",
    inquiries: "Inquiries",
    interested: "Interested",
    followUps: "Open follow-ups",
    latestActivity: "Latest activity",
  },
  unattributedCallout: "{count} inquiries not linked to a property",
  emptyStates: {
    metrics: "Metrics will appear after you add properties or receive inquiries.",
    propertyIntelligence:
      "Add a property and send an inquiry to see portfolio intelligence.",
    recentActivity: "Activity will appear after your first inquiry.",
    attention: "You're all caught up.",
    topPropertiesNone: "No properties yet.",
    portfolio:
      "Add your first property to connect inquiries, interested prospects, follow-up work, and activity to a specific record.",
  },
  portfolioIndex: {
    pageTitle: "Properties",
    pageDescription:
      "Portfolio intelligence across your listings and properties — inquiry activity, interested prospects, and follow-up work.",
    addProperty: "Add property",
    addFirstProperty: "Add your first property",
    createDialogTitle: "Add property",
    detailMetrics: {
      inquiries: "Inquiries",
      interested: "Interested prospects",
      openFollowUps: "Open follow-ups",
      latestActivity: "Latest activity",
    },
  },
  subjectTypeLabels: {
    listing: "Listing",
    property: "Property",
    unit: "Unit",
  },
  detail: {
    recentInquiries: "Recent requests",
    openWork: "Open work",
    recentActivity: "Recent activity",
    noInquiries: "No requests for this property yet.",
    noOpenWork: "No open work for this property.",
    noActivity: "No activity for this property yet.",
  },
});
