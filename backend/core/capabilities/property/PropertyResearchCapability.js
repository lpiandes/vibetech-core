function safeString(v) {
  return v === undefined || v === null ? "" : String(v);
}

function normalizeMessage(message) {
  return safeString(message).toLowerCase();
}

function computeBuyerFit({ buyerInquiry }) {
  const msg = normalizeMessage(buyerInquiry?.message);
  const priority = safeString(buyerInquiry?.priority).toLowerCase();

  const urgentCue =
    /urgent|asap|immediately|today|as soon as possible|right away/i.test(
      safeString(buyerInquiry?.message),
    );

  if (priority === "high" || urgentCue) return "Excellent";

  const scheduleCue = /walkthrough|schedule|next steps|timing|window|tour/i.test(msg);
  if (scheduleCue) return "Good";

  const generalCue = /interested|info|details|learn|understand|consider/i.test(msg);
  if (generalCue) return "Moderate";

  return "Weak";
}

function computeConfidence(buyerFit) {
  switch (buyerFit) {
    case "Excellent":
      return "High";
    case "Good":
      return "Medium";
    case "Moderate":
      return "Low";
    case "Weak":
    default:
      return "Low";
  }
}

function pickSellingPoints({ property, companyKnowledge }) {
  const highlights = Array.isArray(property?.highlights)
    ? property.highlights.map(safeString).filter(Boolean)
    : [];

  const points = [];
  for (const h of highlights) {
    if (points.length >= 5) break;
    points.push(h);
  }

  if (points.length < 3) {
    const ruleHints = Array.isArray(companyKnowledge?.propertyShowingRules)
      ? companyKnowledge.propertyShowingRules.map(safeString).filter(Boolean)
      : [];
    const hint = ruleHints[0];
    if (hint && points.length < 3) {
      points.push("Guided walkthrough coordination for your preferred timing");
    }
  }

  while (points.length < 3) {
    points.push("Clear next-step guidance to keep things moving");
  }

  return points.slice(0, 5);
}

function computeBuyerConsiderations({ property, buyerInquiry }) {
  const considerations = Array.isArray(property?.considerations)
    ? property.considerations.map(safeString).filter(Boolean)
    : [];

  const msg = normalizeMessage(buyerInquiry?.message);
  const financeCue = /budget|financ|mortgage|approval|financing|down payment/i.test(msg);
  const commuteCue = /commute|work|job|distance/i.test(msg);

  const derived = [];
  if (financeCue) derived.push("Budget or financing question to confirm");
  if (commuteCue) derived.push("Timing/location fit to confirm based on lifestyle needs");

  const combined = [...considerations, ...derived].filter(Boolean);
  return combined.slice(0, 4);
}

function computePropertySummary({ property }) {
  const highlights = Array.isArray(property?.highlights)
    ? property.highlights.map(safeString).filter(Boolean)
    : [];

  const addressBits = [safeString(property?.address).trim(), safeString(property?.city).trim(), safeString(property?.state).trim()].filter(Boolean);
  const addressLine = addressBits.length ? addressBits.join(", ") : "the property";

  const price = property?.price;
  const pricePart =
    typeof price === "number" && Number.isFinite(price)
      ? `listed at $${Math.round(price).toLocaleString()}`
      : "";

  const topHighlights = highlights.slice(0, 3);
  const highlightPart = topHighlights.length
    ? `${topHighlights.join(", ").replace(/\,$/, "")}`
    : "a well-kept, buyer-ready foundation";

  const sentenceBits = [
    highlightPart,
    pricePart ? `and ${pricePart}` : "",
  ].filter(Boolean);

  return `${sentenceBits.join(" ")} at ${addressLine}.`;
}

function computeRecommendedTalkingPoints({
  propertySummary,
  sellingPoints,
  buyerConsiderations,
  buyerInquiry,
  companyKnowledge,
}) {
  const talkingPoints = [];

  talkingPoints.push(`Here’s a quick overview: ${propertySummary}`);

  const topPoints = sellingPoints.slice(0, 3);
  for (const p of topPoints) {
    talkingPoints.push(`What stands out: ${p}`);
  }

  if (buyerConsiderations.length) {
    talkingPoints.push(`A few items to confirm next: ${buyerConsiderations.slice(0, 2).join(" and ")}`);
  }

  const preferredNextStep = (() => {
    const msg = normalizeMessage(buyerInquiry?.message);
    if (/walkthrough|tour/i.test(msg)) {
      return "Share your preferred walkthrough window and we’ll coordinate next steps.";
    }
    if (/next steps|schedule|timing|window/i.test(msg)) {
      return "Tell us your preferred timing and we’ll align the next steps for you.";
    }
    return "Reply with what you care about most, and we’ll confirm the best next step.";
  })();

  talkingPoints.push(preferredNextStep);

  // Keep 3-5 concise points.
  return talkingPoints.slice(0, 5);
}

export class PropertyResearchCapability {
  run({ property, buyerInquiry, companyKnowledge } = {}) {
    const buyerFit = computeBuyerFit({ buyerInquiry });
    const confidence = computeConfidence(buyerFit);

    const propertySummary = computePropertySummary({ property });
    const sellingPoints = pickSellingPoints({ property, companyKnowledge });
    const buyerConsiderations = computeBuyerConsiderations({ property, buyerInquiry });

    const recommendedTalkingPoints = computeRecommendedTalkingPoints({
      propertySummary,
      sellingPoints,
      buyerConsiderations,
      buyerInquiry,
      companyKnowledge,
    });

    const reasoning = (() => {
      const msg = safeString(buyerInquiry?.message);
      const hasHighlights = (Array.isArray(property?.highlights) && property.highlights.length) || false;
      const hasConsiderations =
        Array.isArray(property?.considerations) && property.considerations.length > 0;

      const urgencyCue =
        /urgent|asap|immediately|today/i.test(msg.toLowerCase()) ? "The buyer’s message signals urgency." : "";

      const fitCue =
        buyerFit === "Excellent"
          ? "The buyer’s intent aligns strongly with the property’s strengths."
          : buyerFit === "Good"
            ? "The buyer is looking for clear next steps that match the property’s strengths."
            : buyerFit === "Moderate"
              ? "The buyer shows interest, and the property fits, with a few items to confirm."
              : "The buyer’s message is more exploratory, so we should focus on clarity and key confirmations.";

      const considerationsCue = hasConsiderations
        ? `We should address the main considerations upfront to keep the next steps smooth.`
        : `No major constraints were identified from the property details, so we can keep guidance straightforward.`;

      const highlightCue = hasHighlights
        ? `Key selling points can be emphasized to reassure the buyer.`
        : `We can lean on the provided property details to keep the response grounded.`;

      return `${urgencyCue ? urgencyCue + " " : ""}${fitCue} ${considerationsCue} ${highlightCue}`;
    })();

    return {
      propertySummary,
      buyerFit,
      sellingPoints,
      buyerConsiderations,
      recommendedTalkingPoints,
      confidence,
      reasoning,
    };
  }
}

