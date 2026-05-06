"use client";

import { useEffect, useState } from "react";

// Desktop-only animated background. Pink streaking lines fly across
// the black, occasionally interrupted by a quick camera-shake every
// 5–15s. Hidden on mobile (md:block) and disabled when the user
// prefers reduced motion.
export default function StreakBackground() {
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const queue = () => {
      const delay = 5000 + Math.random() * 10000;
      timer = setTimeout(() => {
        setShake(true);
        setTimeout(() => setShake(false), 650);
        queue();
      }, delay);
    };
    queue();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-0 hidden overflow-hidden md:block ${
        shake ? "icl-camera-shake" : ""
      }`}
    >
      <div className="icl-streak-field absolute inset-0">
        {STREAKS.map((s, i) => (
          <span
            key={i}
            className={`icl-streak ${s.thick ? "icl-streak-thick" : ""}`}
            style={{
              top: `${s.top}%`,
              width: `${s.width}vw`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
              opacity: s.opacity,
            }}
          />
        ))}
      </div>
      <div className="icl-vignette absolute inset-0" />
    </div>
  );
}

const STREAKS = [
  { top: 4,  width: 22, delay: 0.0, duration: 3.4, opacity: 0.55, thick: false },
  { top: 11, width: 28, delay: 1.2, duration: 4.1, opacity: 0.85, thick: true  },
  { top: 18, width: 14, delay: 2.7, duration: 2.8, opacity: 0.45, thick: false },
  { top: 24, width: 36, delay: 0.6, duration: 5.0, opacity: 0.7,  thick: false },
  { top: 31, width: 20, delay: 3.4, duration: 3.6, opacity: 0.5,  thick: false },
  { top: 38, width: 30, delay: 1.9, duration: 4.6, opacity: 0.95, thick: true  },
  { top: 45, width: 12, delay: 4.5, duration: 2.4, opacity: 0.4,  thick: false },
  { top: 52, width: 26, delay: 0.3, duration: 3.9, opacity: 0.7,  thick: false },
  { top: 59, width: 34, delay: 2.4, duration: 5.2, opacity: 0.85, thick: true  },
  { top: 66, width: 16, delay: 3.8, duration: 2.9, opacity: 0.5,  thick: false },
  { top: 73, width: 22, delay: 1.5, duration: 3.7, opacity: 0.65, thick: false },
  { top: 80, width: 28, delay: 0.9, duration: 4.3, opacity: 0.9,  thick: true  },
  { top: 87, width: 14, delay: 4.1, duration: 2.6, opacity: 0.45, thick: false },
  { top: 94, width: 24, delay: 2.0, duration: 4.0, opacity: 0.7,  thick: false },
];
