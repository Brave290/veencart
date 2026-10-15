/**
 * solve-contrast.mjs — find the nearest compliant variant of a failing token.
 *
 * For each failing pairing, walk the colour toward black (preserving hue and
 * chroma ratios) until the WCAG threshold is met, and report the first passing
 * value. That gives a defensible replacement instead of an eyeballed guess.
 */

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const h = hex.replace("#", "");
  return (
    0.2126 * srgbToLinear(parseInt(h.slice(0, 2), 16)) +
    0.7152 * srgbToLinear(parseInt(h.slice(2, 4), 16)) +
    0.0722 * srgbToLinear(parseInt(h.slice(4, 6), 16))
  );
}
function ratio(a, b) {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
const toHex = (r, g, b) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const parse = (hex) => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Scale a colour toward black, keeping hue: multiply all channels by k. */
function darken(hex, k) {
  const [r, g, b] = parse(hex);
  return toHex(r * k, g * k, b * k);
}

const CASES = [
  { fg: "#F4773B", bg: "#FFFFFF", min: 4.5, need: "darken fg", note: "orange as text on white" },
  { fg: "#FFFFFF", bg: "#F4773B", min: 4.5, need: "darken bg", note: "white label on orange button" },
  { fg: "#66736F", bg: "#F1F4F1", min: 4.5, need: "darken fg", note: "secondary text on muted surface" },
  { fg: "#B8C3BD", bg: "#FFFFFF", min: 3.0, need: "darken fg", note: "strong border / control edge" },
];

console.log("Walking each colour toward black until the threshold is met:\n");
for (const c of CASES) {
  const target = c.need === "darken fg" ? c.fg : c.bg;
  const other = c.need === "darken fg" ? c.bg : c.fg;
  let found = null;
  for (let k = 1.0; k > 0.05; k -= 0.005) {
    const cand = darken(target, k);
    const r = c.need === "darken fg" ? ratio(cand, other) : ratio(other, cand);
    if (r >= c.min) { found = { cand, r }; break; }
  }
  if (!found) { console.log(`${c.note}: no solution by darkening`); continue; }
  const [r, g, b] = parse(found.cand);
  console.log(
    `${c.note}\n` +
      `  current : ${c.fg} / ${c.bg}  ->  ${ratio(c.fg, c.bg).toFixed(2)}:1 (need ${c.min}:1)\n` +
      `  use     : ${c.need === "darken fg" ? found.cand : c.fg} on ` +
      `${c.need === "darken fg" ? c.bg : found.cand}  ->  ${found.r.toFixed(2)}:1\n` +
      `  rgb(${r}, ${g}, ${b})  ·  ${(found.r - c.min).toFixed(2)}:1 of headroom\n`
  );
}