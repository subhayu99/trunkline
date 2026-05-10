// Indian-lakh / Western number formatting + short date utilities.

export function fmtINR(n, locale, symbol = "₹") {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (locale === "lakh") {
    const s = abs.toFixed(0);
    const lastThree = s.slice(-3);
    const rest = s.slice(0, -3);
    const formatted = rest
      ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
      : lastThree;
    return (n < 0 ? "-" : "") + symbol + formatted;
  }
  return (n < 0 ? "-" : "") + symbol + abs.toLocaleString("en-US");
}

export function fmtCompact(n, symbol = "₹") {
  const abs = Math.abs(n);
  if (abs >= 1e7) return symbol + (n / 1e7).toFixed(1) + "Cr";
  if (abs >= 1e5) return symbol + (n / 1e5).toFixed(1) + "L";
  if (abs >= 1e3) return symbol + (n / 1e3).toFixed(1) + "k";
  // Sub-thousand: round to integer. Compact format is at-a-glance, so the
  // raw float (e.g. -239.7165384615431 from a daily-net calc) reads as noise.
  return symbol + Math.round(n);
}

export const MONTH_NAMES = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

export function fmtDateShort(d) {
  return String(d.getDate()).padStart(2, "0") + " " + MONTH_NAMES[d.getMonth()];
}

export function fmtDateTime(d) {
  return fmtDateShort(d) + " · " +
    String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0");
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// local YYYY-MM-DDTHH:mm for <input type="datetime-local">
export function isoLocal(d) {
  const pad = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
         "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

export function branchLabel(kind, intensity, branchLabels) {
  return branchLabels[kind]
    ? (branchLabels[kind][intensity] || branchLabels[kind].medium)
    : kind;
}
