import { deepFreeze } from "../../../backend/core/workspace/_utils/deepFreeze.js";

export const MCBRIDE_RELATIONSHIP_TYPES = deepFreeze([
  { type: "PROSPECT", label: "Prospect", category: "pipeline", lifecycleStage: "inquiry" },
  { type: "BUYER", label: "Buyer", category: "brokerage", lifecycleStage: "active_client" },
  { type: "SELLER_PROSPECT", label: "Seller Prospect", category: "brokerage", lifecycleStage: "inquiry" },
  { type: "SELLER", label: "Seller", category: "brokerage", lifecycleStage: "active_client" },
  { type: "PAST_BUYER", label: "Past Buyer", category: "brokerage", lifecycleStage: "past_client" },
  { type: "PAST_SELLER", label: "Past Seller", category: "brokerage", lifecycleStage: "past_client" },
  { type: "OWNER", label: "Owner", category: "property_management", lifecycleStage: "active_client" },
  { type: "RESIDENT", label: "Resident", category: "property_management", lifecycleStage: "active_client" },
  { type: "VENDOR", label: "Vendor", category: "operations", lifecycleStage: "active" },
  { type: "REFERRAL_SOURCE", label: "Referral Source", category: "brokerage", lifecycleStage: "active" },
  { type: "INVESTOR", label: "Investor", category: "brokerage", lifecycleStage: "active" },
]);

export const MCBRIDE_LIFECYCLE_TRANSITIONS = deepFreeze([
  { from: "BUYER", to: "PAST_BUYER" },
  { from: "SELLER_PROSPECT", to: "SELLER" },
  { from: "SELLER", to: "PAST_SELLER" },
]);

const RENTAL_INTENTS = deepFreeze(["rent", "rental", "leasing"]);

export const MCBRIDE_PEOPLE_FILTERS = deepFreeze([
  { id: "all", label: "All", predicate: { type: "all" } },
  { id: "prospects", label: "Prospects", predicate: { type: "hasActiveRelationship", types: ["PROSPECT"] } },
  { id: "active_buyers", label: "Active Buyers", predicate: { type: "hasActiveRelationship", types: ["BUYER"], excludePartyStatus: ["inactive", "archived"] } },
  { id: "seller_prospects", label: "Seller Prospects", predicate: { type: "hasActiveRelationship", types: ["SELLER_PROSPECT"] } },
  { id: "past_clients", label: "Past Clients", predicate: { type: "hasActiveRelationship", types: ["PAST_BUYER", "PAST_SELLER"] } },
  { id: "rental_inquiries", label: "Rental Inquiries", predicate: { type: "rentalInquiry", rentalIntents: RENTAL_INTENTS } },
  {
    id: "property_management_clients",
    label: "Property Management Clients",
    predicate: { type: "hasActiveRelationship", types: ["OWNER"] },
  },
  { id: "referral_sources", label: "Referral Sources", predicate: { type: "hasActiveRelationship", types: ["REFERRAL_SOURCE"] } },
  { id: "owners", label: "Owners", predicate: { type: "hasActiveRelationship", types: ["OWNER"] } },
  { id: "residents", label: "Residents", predicate: { type: "hasActiveRelationship", types: ["RESIDENT"] } },
  { id: "investors", label: "Investors", predicate: { type: "hasActiveRelationship", types: ["INVESTOR"] } },
  { id: "inactive", label: "Inactive Contacts", predicate: { type: "partyStatus", statuses: ["inactive", "archived"] } },
  { id: "with_open_work", label: "With open work", predicate: { type: "openWork" } },
  { id: "with_property_interest", label: "With property interest", predicate: { type: "propertyInterest" } },
]);

export function relationshipLabelsFromRegistry(relationshipTypes = MCBRIDE_RELATIONSHIP_TYPES) {
  return Object.fromEntries(relationshipTypes.map((entry) => [entry.type, entry.label]));
}

export function terminologyByRelationshipFromRegistry(relationshipTypes = MCBRIDE_RELATIONSHIP_TYPES) {
  return Object.fromEntries(relationshipTypes.map((entry) => [entry.type, entry.label]));
}
