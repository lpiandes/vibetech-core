import { MISSION_CONTROL_STATUS, PRIMARY_FOCUS } from "../MissionControlDefaults.js";

export const MISSION_CONTROL_VIEW_ID = "mission_control_view";

export const HERO_STATUS_MAP = {
  [MISSION_CONTROL_STATUS.excellent]: "success",
  [MISSION_CONTROL_STATUS.healthy]: "success",
  [MISSION_CONTROL_STATUS.needs_attention]: "warning",
  [MISSION_CONTROL_STATUS.critical]: "danger",
  [MISSION_CONTROL_STATUS.setup_required]: "danger",
};

export const OVERALL_STATUS_ALLOWED = Object.values(MISSION_CONTROL_STATUS);

export const LAYOUT_ALLOWED = ["stack", "single", "compact"];

export const STYLE_MAP_BY_PRIORITY = {
  immediate: "primary",
  soon: "secondary",
  later: "tertiary",
};

export const BADGE_MAP_BY_OVERALL_STATUS = {
  [MISSION_CONTROL_STATUS.excellent]: "success",
  [MISSION_CONTROL_STATUS.healthy]: "success",
  [MISSION_CONTROL_STATUS.needs_attention]: "warning",
  [MISSION_CONTROL_STATUS.critical]: "danger",
  [MISSION_CONTROL_STATUS.setup_required]: "danger",
};

export const PRIMARY_FOCUS_ALLOWED = PRIMARY_FOCUS;

