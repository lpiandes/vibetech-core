import { createImportProfile } from "../../../backend/core/import/ImportProfile.js";

export const MCBRIDE_PROPERTY_LISTING_COLUMN_MAP = Object.freeze({
  "Property ID": "externalSubjectId",
  "External Property ID": "externalSubjectId",
  "Listing ID": "externalSubjectId",
  "Property Name": "displayName",
  "Listing Name": "displayName",
  Address: "address",
  Unit: "unit",
  City: "city",
  State: "state",
  Zip: "postalCode",
  "Postal Code": "postalCode",
  Price: "price",
  Rent: "price",
  Bedrooms: "bedrooms",
  Bathrooms: "bathrooms",
  "Property Type": "propertyType",
  Status: "status",
  Description: "description",
  URL: "listingUrl",
  "Listing URL": "listingUrl",
});

export const MCBRIDE_SUBJECT_IMPORT_PROFILES = Object.freeze([
  createImportProfile({
    profileId: "mcbride_property_listing_csv",
    sourceSystem: "property_listing_csv",
    label: "McBride property/listing CSV",
    importKind: "subject",
    defaultSubjectType: "listing",
    columnMap: MCBRIDE_PROPERTY_LISTING_COLUMN_MAP,
  }),
  createImportProfile({
    profileId: "magna_mare_property_listing_csv",
    sourceSystem: "magna_mare_properties",
    label: "Magna Mare property/listing CSV",
    importKind: "subject",
    defaultSubjectType: "listing",
    columnMap: MCBRIDE_PROPERTY_LISTING_COLUMN_MAP,
  }),
]);
