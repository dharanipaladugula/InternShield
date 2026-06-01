import { motion } from "framer-motion";

export default function LandingTagline() {
  return (
    <motion.div
      className="landing-tagline-wrap"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.58,
        duration: 0.75,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <p className="landing-tagline">
      <span className="landing-tagline__ditch">
  {"DITCH".split("").map((letter, i) => (
    <span
      key={i}
      className="floating-letter"
      style={{
        animationDelay: `${i * 0.08}s`,
      }}
    >
      {letter}
    </span>
  ))}
</span>
<span className="landing-tagline__redflags">
  {"REDFLAGS".split("").map((letter, i) => (
    <span
      key={i}
      className="floating-letter"
      style={{
        animationDelay: `${0.4 + i * 0.08}s`,
      }}
    >
      {letter}
    </span>
  ))}

  <motion.span
    className="landing-tagline__flag"
    animate={{
      y: [0, -2, 0],
      rotate: [0, 4, 0],
    }}
    transition={{
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  >
    🚩
  </motion.span>
</span>
</p>
    </motion.div>
  );
}