import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(import.meta.dirname, "..", "..", "app", "globals.css"), "utf8");

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(left: string, right: string) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

it("keeps the exact approved action token while using readable ink on paper for action states", () => {
  expect(css).toContain("--action: #335bce;");
  expect(css).toMatch(/\.next-action a\s*{[\s\S]*?color:\s*var\(--ink\);[\s\S]*?background:\s*var\(--paper\);[\s\S]*?border:[^;}]*var\(--action\)/);
  expect(css).toMatch(/\[role="alert"\]\s*{[\s\S]*?color:\s*var\(--ink\);[\s\S]*?background:\s*var\(--paper\);[\s\S]*?border-left:[^;}]*var\(--action\)/);
  const token = (name: string) => css.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))![1];
  expect(contrast(token("ink"), token("paper"))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(token("action"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
});
