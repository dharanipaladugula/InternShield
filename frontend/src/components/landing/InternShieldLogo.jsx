import { motion } from "framer-motion";

export default function InternShieldLogo() {
  return (
    <motion.div
      className="brand-logo"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      <h1 className="brand-logo__wordmark">
        <motion.span
          className="brand-logo__intern cyber-streak-wrap"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
        >
          <span className="cyber-streaks"></span>
          Intern
        </motion.span>

        <motion.span
          className="brand-logo__shield"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
        >
          Shield
        </motion.span>
      </h1>
    </motion.div>
  );
}