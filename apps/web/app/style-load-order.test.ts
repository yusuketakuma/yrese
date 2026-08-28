import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appDirectory = new URL(".", import.meta.url);
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
const legacySource = readFileSync(
  new URL("./legacy.css", import.meta.url),
  "utf8",
);
const removedStyleUrls = [
  "./operator-ux-refinement.css",
  "./operator-first-navigation.css",
  "./operator-adversarial-refinement.css",
  "./operator-completion-refinement.css",
].map((path) => new URL(path, import.meta.url));
const directColorLiteral = /#[0-9a-f]{3,8}\b|rgba?\(/i;

describe("operator stylesheet authority", () => {
  it("loads exactly one three-file cascade", () => {
    expect(
      readdirSync(appDirectory)
        .filter((entry) => entry.endsWith(".css"))
        .sort(),
    ).toEqual(["globals.css", "legacy.css", "operator-first.css"]);
    expect(removedStyleUrls.every((url) => !existsSync(url))).toBe(true);

    expect(globalsSource).toContain('@import "./legacy.css";');
    expect(globalsSource).not.toContain('@import "./operator.css";');
    expect(layoutSource.match(/import "\.\/[^\"]+\.css";/g)).toEqual([
      'import "./globals.css";',
      'import "./operator-first.css";',
    ]);

    const cascadeMarkers = [
      ".app-shell {",
      ".skip-link {",
      ".app-nav-group + .app-nav-group {",
      '.table-scroll[tabindex="0"]:focus-visible {',
      '.operator-rail[data-sticky="false"] {',
    ].map((marker) => operatorSource.indexOf(marker));

    expect(cascadeMarkers.every((index) => index >= 0)).toBe(true);
    expect(cascadeMarkers).toEqual(
      [...cascadeMarkers].sort((left, right) => left - right),
    );
  });

  it("keeps globals as the only token and literal-color authority", () => {
    expect(globalsSource).toContain("--color-bg: #f4f7fb;");
    expect(globalsSource).toContain("--color-focus: #6b4eff;");
    expect(globalsSource).toContain("--shadow-card:");
    expect(globalsSource).toContain("--ux-font-body: 0.9375rem;");
    expect(legacySource).not.toContain(":root");
    expect(operatorSource).not.toContain(":root");
    expect(legacySource).not.toMatch(directColorLiteral);
    expect(operatorSource).not.toMatch(directColorLiteral);
  });

  it("does not retain the unused route error digest selector", () => {
    expect(legacySource).not.toContain(".route-error-digest");
  });

  it("keeps keyboard focus visible on light controls and the dark sidebar", () => {
    expect(globalsSource).toContain(
      "--focus-ring: 3px solid var(--color-focus);",
    );
    expect(operatorSource).toMatch(
      /\.app-sidebar\s*\{[^}]*--color-focus:\s*var\(--[^)]+\);[^}]*--focus-ring:\s*3px solid var\(--color-focus\);/s,
    );
    expect(operatorSource).not.toMatch(
      /\.operator-command-row input:focus-visible\s*\{[^}]*outline:\s*0;/s,
    );
  });

  it("keeps only the six reviewed nowrap exceptions", () => {
    expect(operatorSource.match(/white-space:\s*nowrap/g)).toHaveLength(6);
    expect(operatorSource).toMatch(
      /\.visually-hidden\s*\{[^}]*white-space:\s*nowrap/s,
    );
    expect(operatorSource).toMatch(
      /\.operator-command-label\s*\{[^}]*white-space:\s*nowrap/s,
    );
    expect(operatorSource).toMatch(
      /\.operator-command-shortcut\s*\{[^}]*white-space:\s*nowrap/s,
    );
    expect(operatorSource).toMatch(
      /\.app-nav-label\s*\{[^}]*white-space:\s*nowrap/s,
    );
    expect(operatorSource).toMatch(
      /\.app-nav-group-label\s*\{[^}]*white-space:\s*nowrap/s,
    );
    expect(operatorSource).toMatch(
      /\.app-nav \.app-nav-link\s*\{[^}]*white-space:\s*nowrap/s,
    );

    expect(operatorSource).not.toMatch(
      /\.operator-profile strong,\s*\.operator-profile small\s*\{[^}]*white-space:\s*nowrap/s,
    );
    expect(operatorSource).not.toMatch(
      /\.operator-command-suggestions a\s*\{[^}]*white-space:\s*nowrap/s,
    );
    expect(operatorSource).not.toMatch(
      /\.operator-command-shortcut-hint\s*\{[^}]*white-space:\s*nowrap/s,
    );
    expect(operatorSource).not.toMatch(
      /\.unsaved-work-status (?:strong|small|a)\s*\{[^}]*white-space:\s*nowrap/s,
    );
  });

  it("preserves the desktop shell and final disabled-action correction", () => {
    expect(operatorSource).toMatch(
      /\.app-shell\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:/s,
    );
    expect(operatorSource).toContain(
      '.integration-chip[data-state="partial"]',
    );
    expect(operatorSource).toContain(
      '.prototype-action-shell > .operator-button[data-kind="primary"]:disabled',
    );
    expect(operatorSource).toMatch(
      /\.prototype-action-shell > \.operator-button\[data-kind="primary"\]:disabled\s*\{[^}]*border-style:\s*dashed;[^}]*background:\s*var\(--[^)]+\);[^}]*opacity:\s*1;/s,
    );
  });

  it("resets the current reception registration heading margin", () => {
    expect(legacySource).toContain(".reception-registration-form h4,");
    expect(legacySource).not.toContain(".reception-registration-form h3,");
  });

  it("keeps partial UI connectivity truthful", () => {
    expect(layoutSource).toContain('data-state="partial"');
    expect(layoutSource).toContain("段階接続");
    expect(layoutSource).not.toContain('data-state="prototype"');
  });
});
