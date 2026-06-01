import { motion } from "framer-motion";
import GlassCard from "../shared/GlassCard";
import { getRiskItemSeverity } from "../../utils/analysisHelpers";

const ICONS = { safe: "✓", warning: "!", danger: "✕" };

export default function RiskIndicatorList({ indicators }) {
  return (
    <GlassCard className="risk-panel" delay={0.35}>
      <h3 className="panel-heading">Risk indicators</h3>
      <p className="panel-sub">{indicators.length} intelligence signal(s)</p>

      <ul className="risk-rows">
        {indicators.map((text, i) => {
          const severity = getRiskItemSeverity(text);
          return (
            <motion.li
              key={i}
              className={`risk-row risk-row--${severity}`}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.04, duration: 0.35 }}
              whileHover={{ x: 4 }}
            >
              <span className={`risk-row__icon risk-row__icon--${severity}`}>
                {ICONS[severity]}
              </span>
              <span className="risk-row__text">{text}</span>
            </motion.li>
          );
        })}
      </ul>
    </GlassCard>
  );
}
