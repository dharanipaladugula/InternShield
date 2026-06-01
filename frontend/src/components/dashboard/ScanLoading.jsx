import { motion } from "framer-motion";
import GlassCard from "../shared/GlassCard";

export default function ScanLoading() {
  return (
    <GlassCard className="scan-loading" delay={0.1} hover={false}>
      <div className="scan-loading__inner">
        <motion.div
          className="scan-loading__ring"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
        <div>
          <p className="scan-loading__title">Running threat analysis</p>
          <p className="scan-loading__sub">
            HTTPS · redirects · WHOIS · Safe Browsing · company signals
          </p>
        </div>
      </div>
      <motion.div
        className="scan-loading__bar"
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
      />
    </GlassCard>
  );
}
