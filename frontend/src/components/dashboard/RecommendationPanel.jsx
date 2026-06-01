import { motion } from "framer-motion";
import GlassCard from "../shared/GlassCard";

export default function RecommendationPanel({ recommendation }) {
  return (
    <GlassCard
      className={`recommendation ${recommendation.risky ? "recommendation--risky" : ""}`}
      delay={0.42}
    >
      <span className="recommendation__eyebrow">Intelligence brief</span>
      <h3 className="recommendation__title">{recommendation.title}</h3>
      <p className="recommendation__body">{recommendation.body}</p>

      {recommendation.ctaUrl && (
        <motion.a
          href={recommendation.ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="recommendation__cta"
          whileHover={{
            scale: 1.04,
            boxShadow: "0 0 36px rgba(244, 114, 182, 0.45)",
          }}
          whileTap={{ scale: 0.98 }}
        >
          {recommendation.ctaLabel}
        </motion.a>
      )}
    </GlassCard>
  );
}
