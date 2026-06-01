import { motion } from "framer-motion";
import { useAnimatedCounter } from "../hooks/useAnimatedCounter";

const RADIUS = 58;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const COLORS = {
  safe: { stroke: "#4ade80", glow: "rgba(74, 222, 128, 0.5)" },
  warning: { stroke: "#fbbf24", glow: "rgba(251, 191, 36, 0.45)" },
  danger: { stroke: "#fb7185", glow: "rgba(251, 113, 133, 0.55)" },
};

export default function TrustScoreRing({ score, severity, label }) {
  const animated = useAnimatedCounter(score);
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
  const colors = COLORS[severity] || COLORS.warning;

  return (
    <div className="trust-ring trust-ring--large" style={{ "--ring-glow": colors.glow }}>
      <svg viewBox="0 0 140 140" className="trust-ring__svg">
        <circle
          cx="70"
          cy="70"
          r={RADIUS}
          fill="none"
          strokeWidth="9"
          className="trust-ring__track"
        />
        <motion.circle
          cx="70"
          cy="70"
          r={RADIUS}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          stroke={colors.stroke}
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <motion.div
        className="trust-ring__center"
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 2.8, repeat: Infinity }}
      >
        <span className="trust-ring__value trust-ring__value--large">{animated}</span>
        <span className="trust-ring__max">/ 100</span>
        <span className={`trust-ring__caption trust-ring__caption--${severity}`}>
          {label}
        </span>
      </motion.div>
    </div>
  );
}
