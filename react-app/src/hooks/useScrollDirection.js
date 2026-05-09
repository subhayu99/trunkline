// Tracks the direction of the most recent scroll.
// - Returns "up" or "down".
// - Threshold: 8px deltaY before changing direction (avoids flicker).
// - When the user stops scrolling for `idleMs`, direction reverts to "up"
//   so the FAB always reappears when content settles.

import { useEffect, useRef, useState } from "react";

export function useScrollDirection({ threshold = 8, idleMs = 220 } = {}) {
  const [dir, setDir] = useState("up");
  const lastY = useRef(typeof window !== "undefined" ? window.scrollY : 0);
  const lastDir = useRef("up");
  const idleTimer = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScroll = (e) => {
      const target = e.target;
      const y = target === document || target === window
        ? window.scrollY
        : target.scrollTop;
      const delta = y - lastY.current;
      if (Math.abs(delta) < threshold) return;
      const next = delta > 0 ? "down" : "up";
      lastY.current = y;
      if (next !== lastDir.current) {
        lastDir.current = next;
        setDir(next);
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        lastDir.current = "up";
        setDir("up");
      }, idleMs);
    };

    // Listen on window AND on any element with [data-scroll-host]
    // (we mark .ledger and .more-tab as hosts so scrolling inside them
    // also drives the FAB).
    window.addEventListener("scroll", onScroll, { passive: true });
    const hosts = document.querySelectorAll("[data-scroll-host]");
    hosts.forEach(h => h.addEventListener("scroll", onScroll, { passive: true }));

    // Re-bind hosts when the DOM changes (e.g., switching tabs adds/removes them).
    const obs = new MutationObserver(() => {
      const next = document.querySelectorAll("[data-scroll-host]");
      next.forEach(h => h.addEventListener("scroll", onScroll, { passive: true }));
    });
    obs.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      hosts.forEach(h => h.removeEventListener("scroll", onScroll));
      obs.disconnect();
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [threshold, idleMs]);

  return dir;
}
