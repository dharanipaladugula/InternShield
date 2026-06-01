import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import LandingAtmosphere from "../components/landing/LandingAtmosphere";
import InternShieldLogo from "../components/landing/InternShieldLogo";
import LandingTagline from "../components/landing/LandingTagline";
import { useMouseGlow } from "../hooks/useMouseGlow";

export default function LandingPage() {
  const navigate = useNavigate();
  return (
<div className="landing-page">
      <LandingAtmosphere />
      <div className="landing-page__ambient"></div>
      <div className="cursor-neural-grid"></div>
      <div className="cyber-energy"></div>
<div className="cyber-stars"></div>
      <motion.div
        className="landing-hero"
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          y: [0, -4, 0],
        }}
        transition={{
          opacity: {
            duration: 0.5,
          },
        
          y: {
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
      >
        <InternShieldLogo />
        <LandingTagline />

        <motion.p
          className="landing-sub"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.78, duration: 0.55 }}
        >
          Internship URL intelligence for the post-application era
        </motion.p>

        <motion.button
          type="button"
          className="landing-cta"
          onClick={() => navigate("/dashboard")}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.92, duration: 0.5 }}
          whileHover={{
            scale: 1.04,
            transition: { duration: 0.25, ease: "easeOut" },
          }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="landing-cta__border" />
          <span className="landing-cta__text">Analyze Now</span>
          <span className="landing-cta__shimmer" />
        </motion.button>
      </motion.div>

      <motion.footer
        className="landing-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 1.15 }}
      >
        InternShield · Cyber trust layer
      </motion.footer>
    </div>
  );
}
