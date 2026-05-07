import { useEffect, useState } from "react";

// Loads /config.json and /data.json from the public folder so users can edit
// them without rebuilding. Returns { config, data, error } once both arrive.
export function useConfigAndData() {
  const [state, setState] = useState({ config: null, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("config.json", { cache: "no-cache" }).then(r => {
        if (!r.ok) throw new Error("config.json: " + r.status);
        return r.json();
      }),
      fetch("data.json", { cache: "no-cache" }).then(r => {
        if (!r.ok) throw new Error("data.json: " + r.status);
        return r.json();
      }),
    ])
      .then(([config, data]) => {
        if (cancelled) return;
        setState({ config, data, error: null });
      })
      .catch(err => {
        if (cancelled) return;
        setState({ config: null, data: null, error: err.message || String(err) });
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}
