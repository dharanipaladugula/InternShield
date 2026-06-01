import { motion } from "framer-motion";
import GlassCard from "../shared/GlassCard";
import TrustScoreRing from "../TrustScoreRing";
import { trustLabel } from "../../utils/analysisHelpers";

export default function TrustMeterCard({ result }) {
  const label = trustLabel(result);

  return (
    <GlassCard className="trust-meter-card" delay={0.12}>
      <div className="trust-meter-card__header">
        <span className="trust-meter-card__eyebrow">Primary metric</span>
        <motion.span
          className={`trust-meter-card__pill trust-meter-card__pill--${label.severity}`}
          animate={{
            boxShadow: [
              "0 0 0 transparent",
              "0 0 22px var(--pill-glow)",
              "0 0 0 transparent",
            ],
          }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          {label.text}
        </motion.span>
      </div>

      <TrustScoreRing
        score={result.trustScore}
        severity={label.severity}
        label={label.text}
      />

      <div className="trust-meter-card__meta">
        <div>
          <span className="trust-meter-card__label">Risk level</span>
          <strong className={`trust-meter-card__risk trust-meter-card__risk--${label.severity}`}>
            {label.severity.toUpperCase()}
          </strong>
        </div>
        
        <div>
          <span className="trust-meter-card__label">Trust score</span>
          <strong>{result.trustScore} / 100</strong>
        </div>
      </div>
      <div className="trust-meter-card__signals">
  <h4>Top Signals</h4>

  <ul>
    {result.domainAgeDays !== null && (
      <li>
        ✓ Domain age: {Math.floor(result.domainAgeDays / 365)} years
      </li>
    )}

    {!result.safeBrowsingFlagged && (
      <li>
        ✓ Google Safe Browsing clear
      </li>
    )}

    {!result.impersonationRisk && (
      <li>
        ✓ Company domain verified
      </li>
    )}

    {result.redirectCount > 0 && (
      <li>
        ⚠ {result.redirectCount} redirect before final destination
      </li>
    )}
  </ul>
</div>
    </GlassCard>
  );
}
