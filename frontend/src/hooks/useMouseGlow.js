import { useCallback, useState } from "react";

/**
 * Tracks pointer position inside a section for a soft neon spotlight effect.
 */
export function useMouseGlow() {
  const [glow, setGlow] = useState({ x: 50, y: 40, active: false });

  const onMouseMove = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setGlow({ x, y, active: true });
  }, []);

  const onMouseLeave = useCallback(() => {
    setGlow((prev) => ({ ...prev, active: false }));
  }, []);

  return { glow, onMouseMove, onMouseLeave };
}
