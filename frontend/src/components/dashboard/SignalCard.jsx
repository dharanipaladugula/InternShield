import { motion } from "framer-motion";
import GlassCard from "../shared/GlassCard";

const ICONS = {
  domain: "◷",
  lock: "⛨",
  redirect: "↻",
  shield: "◈",
  building: "▣",
};

export default function SignalCard({ signal, index }) {
  return (
    <GlassCard className={`signal-card signal-card--${signal.severity}`} delay={0.15 + index * 0.06}>
      <motion.div
        className="signal-card__icon"
        whileHover={{ scale: 1.12, rotate: 4 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        {ICONS[signal.icon] || "•"}
      </motion.div>
      <div className="signal-card__body">
        <span className="signal-card__title">{signal.title}</span>
        <span className={`signal-card__value signal-card__value--${signal.severity}`}>
          {signal.value}
        </span>
        <span className="signal-card__hint">{signal.hint}</span>
      </div>
      <span className={`signal-card__beam signal-card__beam--${signal.severity}`} />
    </GlassCard>
  );
}
