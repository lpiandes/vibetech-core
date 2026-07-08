import { deepFreeze } from "../../../backend/core/workspace/_utils/deepFreeze.js";

/**
 * Package-authored CRM status/tag → relationship type mappings.
 * Keys are normalized lowercase source values.
 */
export const MCBRIDE_RELATIONSHIP_IMPORT_MAPPINGS = deepFreeze({
  prospect: "PROSPECT",
  lead: "PROSPECT",
  buyer: "BUYER",
  "active buyer": "BUYER",
  seller: "SELLER",
  "seller prospect": "SELLER_PROSPECT",
  "past buyer": "PAST_BUYER",
  "past seller": "PAST_SELLER",
  owner: "OWNER",
  resident: "RESIDENT",
  tenant: "RESIDENT",
  vendor: "VENDOR",
  referral: "REFERRAL_SOURCE",
  "referral source": "REFERRAL_SOURCE",
  investor: "INVESTOR",
});

export const MCBRIDE_STATUS_IMPORT_MAPPINGS = deepFreeze({
  inactive: "inactive",
  archived: "archived",
  active: "active",
});
