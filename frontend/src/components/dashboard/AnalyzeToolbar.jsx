import { motion } from "framer-motion";
import GlassCard from "../shared/GlassCard";

export default function AnalyzeToolbar({ url, setUrl, loading, onSubmit }) {
  return (
    <GlassCard className="analyze-toolbar" delay={0.05} hover={false}>
      <form className="analyze-toolbar__form" onSubmit={onSubmit}>
        <div className="analyze-toolbar__labels">
          <span className="analyze-toolbar__eyebrow">Target acquisition</span>
          <h2 className="analyze-toolbar__title">URL threat scanner</h2>
        </div>

        <div className="analyze-toolbar__row">
          <input
            type="url"
            className="dash-input"
            placeholder="https://company.com/careers/internship"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={loading}
          />
          <motion.button
            type="submit"
            className="dash-btn dash-btn--primary"
            disabled={loading || !url.trim()}
            whileHover={!loading ? { scale: 1.03 } : undefined}
            whileTap={!loading ? { scale: 0.97 } : undefined}
          >
            {loading ? "Scanning…" : "Scan URL"}
          </motion.button>
        </div>
      </form>
    </GlassCard>
  );
}
