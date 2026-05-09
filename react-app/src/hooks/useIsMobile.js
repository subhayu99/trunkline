// Returns true when the viewport is ≤768px wide. Re-renders on resize
// and orientation change. SSR-safe (returns false until hydrated).

import { useEffect, useState } from "react";

const QUERY = "(max-width: 768px)";

export function useIsMobile() {
  const get = () =>
    typeof window !== "undefined" && window.matchMedia(QUERY).matches;
  const [isMobile, setIsMobile] = useState(get);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    // matchMedia.addEventListener exists in all modern browsers; older
    // Safari needs addListener as a fallback.
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return isMobile;
}
