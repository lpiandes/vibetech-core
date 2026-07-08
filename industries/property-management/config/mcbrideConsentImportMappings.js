import { deepFreeze } from "../../../backend/core/workspace/_utils/deepFreeze.js";

export const MCBRIDE_CONSENT_IMPORT_MAPPINGS = deepFreeze({
  emailOptIn: {
    yes: "opt_in",
    true: "opt_in",
    subscribed: "opt_in",
    opt_in: "opt_in",
    "opt-in": "opt_in",
  },
  smsOptIn: {
    yes: "opt_in",
    true: "opt_in",
    subscribed: "opt_in",
    opt_in: "opt_in",
    "opt-in": "opt_in",
  },
});
