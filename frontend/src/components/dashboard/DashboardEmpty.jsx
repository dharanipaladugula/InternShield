import { motion } from "framer-motion";
import GlassCard from "../shared/GlassCard";

export default function DashboardEmpty() {
  return (
    <GlassCard className="dash-empty" delay={0.15} hover={false}>
      <motion.div
        className="dash-empty__orb"
        animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <h3 className="dash-empty__title">Ready for acquisition</h3>
      <p className="dash-empty__text">
        Paste an internship posting URL above to launch multi-vector threat analysis.
      </p>
    </GlassCard>
  );
}
