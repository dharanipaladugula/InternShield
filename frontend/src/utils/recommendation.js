import { trustLabel } from "./analysisHelpers";

/**
 * Human recommendation panel copy from analysis result.
 */
export function buildRecommendation(result) {
  if (!result) {
    return {
      risky: false,
      title: "Awaiting scan",
      body: "Enter an internship URL above to generate intelligence and recommendations.",
      ctaLabel: "Verify Official Company Site",
      ctaUrl: null,
    };
  }

  const label = trustLabel(result);
  const domain = result.domain;
  const officialSearch = domain
    ? `https://www.google.com/search?q=${encodeURIComponent(domain + " official careers")}`
    : "https://www.google.com/search?q=company+official+careers+site";

  if (result.safeBrowsingFlagged) {
    return {
      risky: true,
      title: "Do not interact with this link",
      body:
        "Google Safe Browsing flagged this URL as dangerous. Do not enter passwords, download files, or submit applications. Confirm any internship directly on the employer's official website.",
      ctaLabel: "Verify Official Company Site",
      ctaUrl: officialSearch,
    };
  }

  if (result.impersonationRisk) {
    return {
      risky: true,
      title: "High impersonation risk",
      body:
        "This posting references a well-known company but the website domain does not match official records. Treat this as a potential fake listing until you verify the role on the company's real careers portal.",
      ctaLabel: "Verify Official Company Site",
      ctaUrl: officialSearch,
    };
  }

  if (result.trustScore < 50) {
    return {
      risky: true,
      title: "This internship link looks risky",
      body:
        "Multiple trust signals raised concerns — new domains, redirect chains, or suspicious URL patterns. Pause before applying and validate the employer through official channels.",
      ctaLabel: "Verify Official Company Site",
      ctaUrl: officialSearch,
    };
  }

  if (result.trustScore < 75) {
    return {
      risky: false,
      title: "Proceed with caution",
      body:
        "Some signals warrant a closer look. Cross-check the posting against the company's official careers page, avoid upfront fees, and never share banking details over email.",
      ctaLabel: "Verify Official Company Site",
      ctaUrl: officialSearch,
    };
  }

  return {
    risky: false,
    title: "Lower apparent risk",
    body:
      `Automated checks did not flag major issues (${label.text}). Still verify the role on an official company site — automated scans cannot confirm legitimacy on their own.`,
    ctaLabel: "Verify Official Company Site",
    ctaUrl: officialSearch,
  };
}
