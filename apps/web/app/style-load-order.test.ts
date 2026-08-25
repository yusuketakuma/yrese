import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalsSource = readFileSync(
  new URL("./globals.css", import.meta.url),
  "utf8",
);
const layoutSource = readFileSync(
  new URL("./layout.tsx", import.meta.url),
  "utf8",
);
const operatorSource = readFileSync(
  new URL("./operator-first.css", import.meta.url),
  "utf8",
);
const completionSource = readFileSync(
  new URL("./operator-completion-refinement.css", import.meta.url),
  "utf8",
);
const duplicateRefinementUrl = new URL(
  "./operator-first-refinement.css",
  import.meta.url,
);

describe("operator stylesheet load order", () => {
  it("keeps one explicit cascade and loads completion corrections last", () => {
    expect(globalsSource).toContain('@import "./legacy.css";');
    expect(globalsSource).not.toContain('@import "./operator.css";');

    const baselineIndex = layoutSource.indexOf('import "./globals.css";');
    const operatorIndex = layoutSource.indexOf(
      'import "./operator-first.css";',
    );
    const refinementIndex = layoutSource.indexOf(
      'import "./operator-ux-refinement.css";',
    );
    const navigationIndex = layoutSource.indexOf(
      'import "./operator-first-navigation.css";',
    );
    const adversarialIndex = layoutSource.indexOf(
      'import "./operator-adversarial-refinement.css";',
    );
    const completionIndex = layoutSource.indexOf(
      'import "./operator-completion-refinement.css";',
    );

    expect(baselineIndex).toBeGreaterThanOrEqual(0);
    expect(operatorIndex).toBeGreaterThan(baselineIndex);
    expect(refinementIndex).toBeGreaterThan(operatorIndex);
    expect(navigationIndex).toBeGreaterThan(refinementIndex);
    expect(adversarialIndex).toBeGreaterThan(navigationIndex);
    expect(completionIndex).toBeGreaterThan(adversarialIndex);
    expect(layoutSource).not.toContain('import "./operator.css";');
    expect(layoutSource).not.toContain(
      'import "./operator-first-refinement.css";',
    );
    expect(existsSync(duplicateRefinementUrl)).toBe(false);
  });

  it("lays out the desktop shell as a sidebar and workspace grid", () => {
    expect(operatorSource).toMatch(
      /\.app-shell\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:/s,
    );
    expect(completionSource).not.toMatch(
      /\.app-sidebar\s*\{[^}]*background:/s,
    );
  });
});
