import { domainAgeDisplay } from "./analysisHelpers";

/**
 * Turn API result into signal card data for the dashboard grid.
 */
export function buildSignalCards(result) {
  if (!result) return [];

  const indicators = result.riskIndicators || [];
  const hasHttpsIssue = indicators.some((t) =>
    t.toLowerCase().includes("does not use https")
  );
  const httpsSkipped = !indicators.some((t) => t.toLowerCase().includes("https"));

  const age = domainAgeDisplay(result.domainAgeDays);

  const redirectCount = result.redirectCount ?? 0;
  let redirectSeverity = "safe";
  let redirectValue = `${redirectCount} hop${redirectCount !== 1 ? "s" : ""}`;
  let redirectHint = "Chain within normal range";

  if (redirectCount > 3) {
    redirectSeverity = "danger";
    redirectHint = "Excessive redirect chain";
  } else if (redirectCount >= 1) {
    redirectSeverity = "warning";
    redirectHint = "Redirects detected";
  }

  const redirectFailed = indicators.some((t) =>
    t.includes("Could not fully inspect redirect")
  );
  if (redirectFailed) {
    redirectSeverity = "warning";
    redirectValue = "Unknown";
    redirectHint = "Redirect check incomplete";
  }

  let companySeverity = "safe";
  let companyValue = "Aligned";
  let companyHint = "No company/domain mismatch";

  if (result.impersonationRisk) {
    companySeverity = "danger";
    companyValue = "Mismatch";
    companyHint =
      result.impersonatedCompanies?.length > 0
        ? `Claims ${result.impersonatedCompanies.join(", ")}`
        : "Possible impersonation";
  } else if (
    indicators.some((t) => t.includes("Company domain verification failed"))
  ) {
    companySeverity = "warning";
    companyValue = "Unverified";
    companyHint = "Could not verify company domain";
  }

  let browsingSeverity = "safe";
  let browsingValue = "Clear";
  let browsingHint = "No Safe Browsing flags";

  if (result.safeBrowsingFlagged) {
    browsingSeverity = "danger";
    browsingValue = "Flagged";
    browsingHint =
      result.safeBrowsingThreats?.join(", ") || "Listed as dangerous";
  } else if (
    indicators.some((t) => t.includes("Safe Browsing check skipped"))
  ) {
    browsingSeverity = "warning";
    browsingValue = "Skipped";
    browsingHint = "API key not configured";
  }

  return [
    {
      id: "domain",
      title: "Domain Age",
      icon: "domain",
      value: age.text,
      hint: age.hint,
      severity: age.severity,
    },
    {
      id: "https",
      title: "HTTPS",
      icon: "lock",
      value: hasHttpsIssue ? "Missing" : httpsSkipped ? "OK" : "Secure",
      hint: hasHttpsIssue
        ? "Connection may not be encrypted"
        : "Encrypted connection",
      severity: hasHttpsIssue ? "danger" : "safe",
    },
    {
      id: "redirects",
      title: "Redirects",
      icon: "redirect",
      value: redirectValue,
      hint: redirectHint,
      severity: redirectSeverity,
    },
    {
      id: "browsing",
      title: "Safe Browsing",
      icon: "shield",
      value: browsingValue,
      hint: browsingHint,
      severity: browsingSeverity,
    },
    {
      id: "company",
      title: "Company Verification",
      icon: "building",
      value: companyValue,
      hint: companyHint,
      severity: companySeverity,
    },
  ];
}
