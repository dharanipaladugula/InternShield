import GlassCard from "../shared/GlassCard";

export default function DetectionSummary({ result }) {
  const items = [];

  items.push({
    label: "HTTPS Enabled",
    passed: result.urlChecked?.startsWith("https")
  });

  items.push({
    label: "Domain Age Available",
    passed: result.domainAgeDays !== null
  });

  items.push({
    label: "Safe Browsing Passed",
    passed: !result.safeBrowsingFlagged
  });

  items.push({
    label: "Company Verification",
    passed: !result.impersonationRisk
  });

  return (
    <GlassCard className="detection-summary" delay={0.25}>
      <h3 className="panel-heading">
      Security Overview
      </h3>

      <div className="detection-summary__list">
        {items.map((item) => (
          <div
            key={item.label}
            className={`detection-summary__item ${
              item.passed
                ? "detection-summary__item--pass"
                : "detection-summary__item--fail"
            }`}
          >
            <span>
              {item.passed ? "✓" : "✕"}
            </span>

            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}