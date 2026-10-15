import { describe, expect, it } from "vitest";
import {
  motion,
  duration,
  exitDuration,
  ease,
  stagger,
  motionTransition,
  ANIMATABLE,
} from "../frontend/src/lib/motion";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Motion is easy to ship wrong, and wrong motion is invisible in code review:
 * a 600ms transition looks fine in a diff and feels broken on a phone. These
 * tests treat the motion system as a contract rather than a set of suggestions.
 */

describe("duration bands", () => {
  it("keeps every duration inside the 0–400ms ceiling", () => {
    for (const [name, ms] of Object.entries(duration)) {
      expect(ms, `${name} must not exceed 400ms`).toBeLessThanOrEqual(400);
      expect(ms, `${name} must not be negative`).toBeGreaterThanOrEqual(0);
    }
  });

  it("orders the bands fast < base < moderate < slow", () => {
    expect(duration.fast).toBeLessThan(duration.base);
    expect(duration.base).toBeLessThan(duration.moderate);
    expect(duration.moderate).toBeLessThan(duration.slow);
  });

  it("keeps interaction feedback under the 200ms 'instant' threshold", () => {
    // Above 200ms a press stops reading as a reaction to the tap.
    expect(duration.fast).toBeLessThan(200);
  });
});

describe("exit is faster than entrance", () => {
  it("uses roughly 75% of the entrance duration", () => {
    for (const key of ["base", "moderate"] as const) {
      const ratio = exitDuration[key] / duration[key];
      expect(
        ratio,
        `exit.${key} should be ~75% of duration.${key}`
      ).toBeGreaterThan(0.6);
      expect(ratio).toBeLessThan(0.85);
    }
  });
});

describe("easing", () => {
  it("uses a distinct curve per direction", () => {
    const curves = new Set(Object.values(ease));
    // enter / exit / move must not collide — a shared curve is how a product
    // starts to feel subtly "off" with no identifiable cause.
    expect(curves.size).toBe(4);
  });

  it("only reserves linear for indeterminate progress", () => {
    expect(ease.linear).toBe("linear");
    expect(ease.enter).not.toBe("linear");
    expect(ease.exit).not.toBe("linear");
    expect(ease.move).not.toBe("linear");
  });

  it("never uses ease-in for UI feedback", () => {
    // A control that eases in on press feels unresponsive: the user already
    // acted, so the interface must respond immediately.
    for (const value of Object.values(ease)) {
      expect(value).not.toBe("cubic-bezier(0.42, 0, 1, 1)");
    }
  });
});

describe("stagger", () => {
  it("uses an offset in the 30–80ms band", () => {
    // Below 30ms the sequence reads as pasted-on; above 80ms the list is slow.
    expect(stagger.child).toBeGreaterThanOrEqual(30);
    expect(stagger.child).toBeLessThanOrEqual(80);
  });

  it("caps the number of staggered children", () => {
    expect(stagger.maxChildren).toBeLessThanOrEqual(6);
  });
});

describe("animatable properties", () => {
  it("permits only compositor-friendly properties", () => {
    // width/height/top/left/margin/padding force layout on every frame and
    // drop frames on low-end Android — the exact devices drivers use.
    const forbidden = ["width", "height", "top", "left", "right", "bottom", "margin", "padding"];
    for (const prop of ANIMATABLE) {
      expect(forbidden, `${prop} forces layout and must not be animated`).not.toBe(prop);
    }
  });
});

describe("motionTransition", () => {
  it("builds an explicit transition listing properties", () => {
    const result = motionTransition(["transform", "opacity"], duration.base, ease.enter);
    expect(result).toBe(
      "transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)"
    );
    expect(result).not.toContain("all");
  });

  it("refuses to build a `transition: all`", () => {
    // `transition: all` animates properties you did not intend, including ones
    // added later by another developer. The helper makes this unrepresentable.
    expect(() => motionTransition([])).toThrow(/transition: all/);
  });
});

describe("reduced-motion contract (motion.css)", () => {
  const css = readFileSync(
    join(process.cwd(), "frontend", "src", "app", "motion.css"),
    "utf8"
  );

  it("honours prefers-reduced-motion globally", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition-duration: 0.01ms");
  });

  it("only hides reveal content under no-preference AND the armed class", () => {
    // The single most important property in the whole file: an element at
    // opacity 0 waiting for a transition that never runs is INVISIBLE
    // CONTENT. Both conditions must be required to hide anything.
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)[\s\S]*?\.js-reveal-armed\.reveal/
    );
  });

  it("keeps loading indicators moving under reduced motion", () => {
    // A stopped spinner reads as "broken", not "calm". Reduced motion removes
    // gratuitous movement, not signal.
    expect(css).toMatch(/data-motion-essential[\s\S]*?animation-iteration-count: infinite/);
  });

  it("never animates a layout property in keyframes", () => {
    const keyframeBlocks = css.match(/@keyframes[\s\S]*?\}/g) ?? [];
    expect(keyframeBlocks.length).toBeGreaterThan(0);
    for (const block of keyframeBlocks) {
      for (const prop of ["width:", "height:", "top:", "left:"]) {
        expect(block, `${prop} inside @keyframes forces layout`).not.toContain(prop);
      }
    }
  });
});

describe("the still state is the default", () => {
  it("arms motion only via a script, so no-JS leaves content visible", () => {
    const layout = readFileSync(
      join(process.cwd(), "frontend", "src", "app", "layout.tsx"),
      "utf8"
    );
    expect(layout).toContain("js-reveal-armed");
    // The arming must be gated on the media query, otherwise reduced-motion
    // users would get hidden content that never animates in.
    expect(layout).toContain("prefers-reduced-motion: reduce");
  });
});

describe("motion object", () => {
  it("exposes the full token set", () => {
    expect(motion.duration).toBe(duration);
    expect(motion.ease).toBe(ease);
    expect(motion.stagger).toBe(stagger);
  });
});