/**
 * check-contrast.mjs — WCAG 2.1 contrast verification for a token set.
 *
 * WHY THIS IS A SCRIPT AND NOT A DESIGNER'S EYE
 * The Veencart UI system specifies exact hex values. Each one has to clear a
 * numeric threshold, and eyeballing "does that look dark enough on that
 * background" fails intermittently — the failure is invisible until a user on a
 * cheap phone in daylight cannot read the status. A gate that runs in CI is
 * worth more than a reviewer's judgement.
 *
 * Thresholds (WCAG 2.1 AA):
 *   body text (< 18.66px bold / < 24px)  4.5:1
 *   large text and UI component edges   3.0:1
 *
 * Usage:  node scripts/check-contrast.mjs
 * Exit 1 if any pairing fails.
 */

const T = {
  brand900: "#0B4F4A",
  brand700: "#087E67",
  brand100: "#DCEFE8",
  accent600: "#F4773B", // brand orange — brand layer, ink text only
  accentInk: "#202927", // the ONLY text permitted on brand orange
  accent700: "#B2551F", // orange fill that DOES take white text
  accent100: "#FFF0E5",
  background: "#F7F8F5",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F4F1",
  textPrimary: "#202927",
  textSecondary: "#5F6C68", // corrected from #66736F (4.46:1 on muted -> 4.95:1)
  textInverse: "#FFFFFF",
  border: "#E5E9E5",
  borderStrong: "#808B87", // corrected from #B8C3BD (1.81:1 -> 3.52:1)
  focus: "#087E67",
  successText: "#166534",
  successBg: "#DCFCE7",
  warningText: "#92400E",
  warningBg: "#FEF3C7",
  dangerText: "#B91C1C",
  dangerBg: "#FEE2E2",
  infoText: "#1D4ED8",
  infoBg: "#DBEAFE",
};

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  );
}

function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground, background, requiredRatio, description] */
const PAIRS = [
  // Body text
  [T.textPrimary, T.background, 4.5, "primary text on page background"],
  [T.textPrimary, T.surface, 4.5, "primary text on card surface"],
  [T.textSecondary, T.background, 4.5, "secondary text on page background"],
  [T.textSecondary, T.surface, 4.5, "secondary text on card surface"],
  [T.textSecondary, T.surfaceMuted, 4.5, "secondary text on muted surface"],

  // Buttons
  [T.textInverse, T.brand700, 4.5, "button label on primary teal"],
  [T.brand700, T.surface, 4.5, "link / primary text on white"],
  [T.brand900, T.surface, 4.5, "heading deep teal on white"],
  [T.brand900, T.background, 4.5, "heading deep teal on page background"],

  // Accent — the pairings that failed in the original brief.
  // #FFFFFF on #F4773B is 2.78:1 and MUST NOT be used. Orange is a brand fill
  // that takes INK text (5.36:1); a white-text orange uses accent-700 (4.99:1).
  [T.accentInk, T.accent600, 4.5, "ink label on brand orange fill"],
  [T.textInverse, T.accent700, 4.5, "white label on dark orange fill"],
  [T.accent700, T.surface, 4.5, "orange text on white (dark variant only)"],

  // Status badges
  [T.successText, T.successBg, 4.5, "success badge text on success bg"],
  [T.warningText, T.warningBg, 4.5, "warning badge text on warning bg"],
  [T.dangerText, T.dangerBg, 4.5, "danger badge text on danger bg"],
  [T.infoText, T.infoBg, 4.5, "info badge text on info bg"],

  // Borders and focus rings need only 3:1 as UI components (1.4.11)
  [T.border, T.surface, 1.0, "hairline border on white (decorative — no minimum)"],
  [T.borderStrong, T.surface, 3.0, "strong border / control edge on white"],
  [T.focus, T.surface, 3.0, "focus ring on white"],
  [T.focus, T.background, 3.0, "focus ring on page background"],
  [T.brand700, T.brand100, 3.0, "brand edge on pale mint"],
];

let failures = 0;
const rows = [];

for (const [fg, bg, min, label] of PAIRS) {
  const r = ratio(fg, bg);
  const pass = r >= min;
  if (!pass && min > 1.0) failures++;
  rows.push({
    pair: `${fg} on ${bg}`,
    ratio: `${r.toFixed(2)}:1`,
    min: min === 1.0 ? "—" : `${min.toFixed(1)}:1`,
    result: min === 1.0 ? "info" : pass ? "PASS" : "FAIL",
    label,
  });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("PAIR", 24) + pad("RATIO", 10) + pad("MIN", 9) + pad("RESULT", 8) + "LABEL");
console.log("-".repeat(100));
for (const r of rows) {
  console.log(
    pad(r.pair, 24) +
      pad(r.ratio, 10) +
      pad(r.min, 9) +
      pad(r.result, 8) +
      r.label
  );
}

console.log(
  `\n${rows.length} pairings checked · ${failures} failing WCAG 2.1 AA text/component thresholds`
);
if (failures > 0) {
  console.log(
    "\nFailures must be resolved BEFORE these tokens are used for text. Either\n" +
      "darken the foreground or change the surface — do not ship 'close enough'."
  );
}
process.exit(failures > 0 ? 1 : 0);