// Returns true when the viewport behaves like a phone — either narrow
// (≤768px) OR a landscape touch device with a short height (covers
// phones in landscape, where width exceeds 768 but the experience is
// still phone-shaped). SSR-safe (returns false until hydrated).
//
// Also exports `MOBILE_MEDIA_QUERY` and `isMobileNow()` so non-component
// code (event handlers in Composer.jsx, App.jsx PWA shortcut handler)
// can branch on the same definition without re-hardcoding the string.

import { useEffect, useState } from "react";

export const MOBILE_MEDIA_QUERY =
  "(max-width: 768px), (hover: none) and (pointer: coarse) and (max-height: 600px) and (orientation: landscape)";

export function isMobileNow() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(isMobileNow);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return isMobile;
}
