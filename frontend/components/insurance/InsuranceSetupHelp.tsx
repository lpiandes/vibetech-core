import { VIBEKEEP_OPS_EMAIL, VIBEKEEP_OPS_PHONE_DISPLAY } from "../../../backend/core/fe-retention/FeRetentionOnboardingCatalog.js";

export function InsuranceSetupHelp() {
  return (
    <p style={{ margin: "1rem 0 0", fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>
      Need help? Email{" "}
      <a href={`mailto:${VIBEKEEP_OPS_EMAIL}`}>{VIBEKEEP_OPS_EMAIL}</a>
      {" "}or call{" "}
      <a href={`tel:+16038182383`}>{VIBEKEEP_OPS_PHONE_DISPLAY}</a>.
    </p>
  );
}
