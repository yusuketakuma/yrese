import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalsSource = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("operator stylesheet load order", () => {
  it("loads the baseline once and keeps the active operator cascade explicit", () => {
    expect(globalsSource).toContain('@import "./legacy.css";');
    expect(globalsSource).not.toContain('@import "./operator.css";');

    const baselineIndex = layoutSource.indexOf('import "./globals.css";');
    const operatorIndex = layoutSource.indexOf('import "./operator-first.css";');
    const refinementIndex = layoutSource.indexOf('import "./operator-ux-refinement.css";');

    expect(baselineIndex).toBeGreaterThanOrEqual(0);
    expect(operatorIndex).toBeGreaterThan(baselineIndex);
    expect(refinementIndex).toBeGreaterThan(operatorIndex);
    expect(layoutSource).not.toContain('import "./operator.css";');
  });
});
