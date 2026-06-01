/**
 * analysisHelpers.js
 * Pure functions for labels, colors, and risk severity — no UI here.
 */

export function trustLabel(result) {
  if (result.safeBrowsingFlagged) {
    return {
      text: "Dangerous link detected",
      severity: "danger",
      className: "safe-browsing",
    };
  }

  if (result.impersonationRisk) {
    return {
      text: "Potential impersonation risk",
      severity: "danger",
      className: "impersonation",
    };
  }

  const score = result.trustScore;
  if (score >= 75) {
    return { text: "Likely trustworthy", severity: "safe", className: "good" };
  }
  if (score >= 50) {
    return { text: "Proceed with caution", severity: "warning", className: "warn" };
  }
  return { text: "High risk", severity: "danger", className: "bad" };
}

export function isImpersonationIndicator(text) {
  return (
    text.startsWith("Possible fake ") ||
    text.startsWith("Impersonation check:")
  );
}

export function isSafeBrowsingIndicator(text) {
  return text.startsWith("Google Safe Browsing:");
}

export function getRiskItemSeverity(text) {
  if (isSafeBrowsingIndicator(text) || isImpersonationIndicator(text)) {
    return "danger";
  }
  if (
    text.includes("Could not") ||
    text.includes("skipped") ||
    text.includes("failed")
  ) {
    return "warning";
  }
  if (
    text.includes("No major red flags") ||
    text.includes("established") ||
    text.includes("Final destination")
  ) {
    return "safe";
  }
  if (
    text.includes("−") ||
    text.includes("Suspicious") ||
    text.includes("Excessive") ||
    text.includes("shortener") ||
    text.includes("HTTPS") ||
    text.includes("impersonation") ||
    text.includes("Safe Browsing")
  ) {
    return "danger";
  }
  return "warning";
}

export function domainAgeDisplay(domainAgeDays) {
  if (domainAgeDays == null) {
    return {
      text: "N/A",
      hint: "WHOIS lookup skipped or unavailable",
      severity: "warning",
    };
  }
  if (domainAgeDays < 30) {
    return {
      text: `${domainAgeDays}d`,
      hint: "Very new domain",
      severity: "danger",
    };
  }
  if (domainAgeDays < 180) {
    return {
      text: `${domainAgeDays}d`,
      hint: "Under 6 months old",
      severity: "warning",
    };
  }
  const years = Math.floor(domainAgeDays / 365);
  return {
    text: `${domainAgeDays}d`,
    hint: years >= 1 ? `~${years}y established` : "Established",
    severity: "safe",
  };
}
