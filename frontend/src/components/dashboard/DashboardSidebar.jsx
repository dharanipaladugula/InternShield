import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";

const NAV = [
  { to: "/dashboard", label: "Scanner", icon: "◎" },
  { to: "/", label: "Home", icon: "⌂" },
];

export default function DashboardSidebar() {
  return (
    <motion.aside
      className="dash-sidebar"
      initial={{ x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.55 }}
    >
      <div className="dash-sidebar__brand">
        <span className="dash-sidebar__mark">◆</span>
        <div>
          <span className="dash-sidebar__intern">Intern</span>
          <span className="dash-sidebar__shield">Shield</span>
        </div>
      </div>

      <nav className="dash-sidebar__nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `dash-sidebar__link ${isActive ? "dash-sidebar__link--active" : ""}`
            }
            end={item.to === "/dashboard"}
          >
            <span className="dash-sidebar__icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <p className="dash-sidebar__meta">Threat intel · v1</p>
    </motion.aside>
  );
}
