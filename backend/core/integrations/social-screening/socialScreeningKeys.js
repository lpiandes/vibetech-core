/**
 * Resolve whether social background screening can run (platform env and/or connection).
 */
export function readSocialScreeningKeys({
  env = process.env,
  secrets = null,
} = {}) {
  const fromSecrets = secrets && typeof secrets === "object" ? secrets : {};
  const serperApiKey = String(
    fromSecrets.serperApiKey
    ?? fromSecrets.SERPER_API_KEY
    ?? env.SERPER_API_KEY
    ?? "",
  ).trim();
  const scrapingBeeApiKey = String(
    fromSecrets.scrapingBeeApiKey
    ?? fromSecrets.SCRAPINGBEE_API_KEY
    ?? env.SCRAPINGBEE_API_KEY
    ?? "",
  ).trim();
  return {
    serperApiKey,
    scrapingBeeApiKey,
    ready: Boolean(serperApiKey && scrapingBeeApiKey),
  };
}

export function isSocialScreeningReady({
  env = process.env,
  connection = null,
  secrets = null,
} = {}) {
  if (connection?.metadata?.ready === true || connection?.metadata?.keysPresent === true) {
    return true;
  }
  if (secrets) return readSocialScreeningKeys({ env, secrets }).ready;
  return readSocialScreeningKeys({ env }).ready;
}
