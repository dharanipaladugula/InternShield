import { useEffect, useState } from "react";
import { animate } from "framer-motion";

/**
 * Smoothly counts from 0 up to `target` when analysis results appear.
 */
export function useAnimatedCounter(target, { duration = 1.4, enabled = true } = {}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setValue(0);
      return undefined;
    }

    const controls = animate(0, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setValue(Math.round(latest)),
    });

    return () => controls.stop();
  }, [target, duration, enabled]);

  return value;
}
