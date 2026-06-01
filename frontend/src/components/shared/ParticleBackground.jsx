import { motion } from "framer-motion";

export default function ParticleBackground({ variant = "full" }) {
  const count = variant === "dense" ? 48 : 32;
  const particles = Array.from({ length: count }, (_, i) => i);

  return (
    <div className={`particle-field particle-field--${variant}`} aria-hidden="true">
      <div className="particle-field__orb particle-field__orb--violet" />
      <div className="particle-field__orb particle-field__orb--rose" />
      <div className="particle-field__orb particle-field__orb--cyan" />
      {particles.map((id) => (
        <motion.span
          key={id}
          className="particle-field__star"
          style={{
            left: `${(id * 13.7) % 100}%`,
            top: `${(id * 19.3) % 100}%`,
          }}
          animate={{
            opacity: [0.1, 0.7, 0.15],
            scale: [0.8, 1.2, 0.9],
          }}
          transition={{
            duration: 3 + (id % 6),
            repeat: Infinity,
            delay: (id % 10) * 0.2,
          }}
        />
      ))}
    </div>
  );
}
