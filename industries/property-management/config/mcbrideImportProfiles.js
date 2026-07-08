import { deepFreeze } from "../../../backend/core/workspace/_utils/deepFreeze.js";
import { createImportProfile } from "../../../backend/core/import/ImportProfile.js";
import {
  MCBRIDE_RELATIONSHIP_IMPORT_MAPPINGS,
  MCBRIDE_STATUS_IMPORT_MAPPINGS,
} from "./mcbrideRelationshipImportMappings.js";
import { MCBRIDE_CONSENT_IMPORT_MAPPINGS } from "./mcbrideConsentImportMappings.js";

const GENERIC_COLUMN_MAP = deepFreeze({
  "Contact Id": "externalContactId",
  "Contact ID": "externalContactId",
  Id: "externalContactId",
  Email: "email",
  "E-mail": "email",
  Phone: "phone",
  Mobile: "phone",
  "First Name": "firstName",
  "Last Name": "lastName",
  Name: "fullName",
  Status: "relationshipType",
  Tags: "tags",
  Source: "leadSource",
  Notes: "notes",
  "Created Date": "createdDate",
  "Updated Date": "updatedDate",
});

const FOLLOW_UP_BOSS_COLUMN_MAP = deepFreeze({
  ...GENERIC_COLUMN_MAP,
  "Client Type": "clientType",
  "Assigned Agent": "assignedAgentName",
  "Email Opt In": "emailOptIn",
  "SMS Opt In": "smsOptIn",
  "Do Not Contact": "doNotContact",
});

const QUALIFICATION_FIELD_MAP = deepFreeze({
  Intent: "intent",
  "Preferred Location": "preferredLocation",
  "Price Range": "priceRange",
  "Property Type": "propertyType",
  Bedrooms: "bedrooms",
  Bathrooms: "bathrooms",
  "Decision Timeline": "decisionTimeline",
  "Financing Status": "financingStatus",
  "Property of Interest": "propertyOfInterest",
});

export const MCBRIDE_IMPORT_PROFILES = deepFreeze([
  createImportProfile({
    profileId: "generic_csv",
    sourceSystem: "generic_csv",
    label: "Generic CRM CSV",
    columnMap: GENERIC_COLUMN_MAP,
    relationshipMappings: MCBRIDE_RELATIONSHIP_IMPORT_MAPPINGS,
    statusMappings: MCBRIDE_STATUS_IMPORT_MAPPINGS,
    consentMappings: MCBRIDE_CONSENT_IMPORT_MAPPINGS,
    qualificationFieldMap: QUALIFICATION_FIELD_MAP,
  }),
  createImportProfile({
    profileId: "follow_up_boss_contacts",
    sourceSystem: "follow_up_boss",
    label: "Follow Up Boss Contacts Export",
    columnMap: FOLLOW_UP_BOSS_COLUMN_MAP,
    relationshipMappings: MCBRIDE_RELATIONSHIP_IMPORT_MAPPINGS,
    statusMappings: MCBRIDE_STATUS_IMPORT_MAPPINGS,
    consentMappings: MCBRIDE_CONSENT_IMPORT_MAPPINGS,
    qualificationFieldMap: QUALIFICATION_FIELD_MAP,
  }),
  createImportProfile({
    profileId: "appfolio_contacts_export",
    sourceSystem: "appfolio_contacts_export",
    label: "AppFolio Contacts Export (CSV)",
    columnMap: {
      ...GENERIC_COLUMN_MAP,
      "Tenant Status": "relationshipType",
      "Owner Status": "relationshipType",
    },
    relationshipMappings: MCBRIDE_RELATIONSHIP_IMPORT_MAPPINGS,
    statusMappings: MCBRIDE_STATUS_IMPORT_MAPPINGS,
    consentMappings: MCBRIDE_CONSENT_IMPORT_MAPPINGS,
    qualificationFieldMap: QUALIFICATION_FIELD_MAP,
  }),
]);
