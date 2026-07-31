import SocialCheckerClient from "./SocialCheckerClient";
import { getSocialCheckerAccess } from "@/lib/platform/socialCheckerAccess";

export default async function SocialCheckerPage() {
  const access = await getSocialCheckerAccess();
  return (
    <SocialCheckerClient
      signedIn={access.signedIn}
      entitled={access.entitled}
      displayName={access.displayName}
      organizationName={access.organizationName}
      organizationCode={access.organizationCode}
    />
  );
}
