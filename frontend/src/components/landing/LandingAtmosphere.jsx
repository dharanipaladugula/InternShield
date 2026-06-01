import { motion } from "framer-motion";

/** Landing-only depth: grid, corner lights, fine particles, neon accents */
export default function LandingAtmosphere() {
  const fineParticles = Array.from({ length: 36 }, (_, i) => i);

  return (
    <div className="landing-atmosphere" aria-hidden="true">
      <div className="landing-atmosphere__corners">
        <div className="landing-atmosphere__corner landing-atmosphere__corner--tl" />
        <div className="landing-atmosphere__corner landing-atmosphere__corner--br" />
        <div className="landing-atmosphere__corner landing-atmosphere__corner--center" />
      </div>

      <div className="landing-atmosphere__grid" />
      <div className="landing-atmosphere__noise" />

      <div className="landing-atmosphere__lines">
        <span className="landing-atmosphere__line landing-atmosphere__line--a" />
        <span className="landing-atmosphere__line landing-atmosphere__line--b" />
      </div>

      {fineParticles.map((id) => (
        <motion.span
          key={id}
          className="landing-atmosphere__particle"
          style={{
            left: `${(id * 11.3) % 100}%`,
            top: `${(id * 17.1) % 100}%`,
          }}
          animate={{
            opacity: [0.08, 0.45, 0.1],
            y: [0, -12 - (id % 5) * 2, 0],
          }}
          transition={{
            duration: 4 + (id % 4),
            repeat: Infinity,
            delay: (id % 8) * 0.35,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
