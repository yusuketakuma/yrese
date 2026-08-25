import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../../.github/workflows/ui-browser.yml", import.meta.url),
  "utf8",
);
const ciWorkflow = readFileSync(
  new URL("../../../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);
const browserCheck = readFileSync(
  new URL("../../../scripts/ui-browser-check.mjs", import.meta.url),
  "utf8",
);
const fixtureApi = readFileSync(
  new URL("../../../scripts/ui-fixture-api.mjs", import.meta.url),
  "utf8",
);

describe("UI browser validation gate", () => {
  it("runs the normal and browser gates for prescription feature branches", () => {
    const branchSelector =
      'branches: [main, feat/operator-first-ui, "feat/prescription-*"]';
    expect(workflow).toContain(branchSelector);
    expect(ciWorkflow).toContain(branchSelector);
    expect(workflow).toContain("pnpm --filter @yrese/web build");
    expect(workflow).toContain("playwright@1.62.1");
    expect(workflow).toContain("axe-core@4.13.0");
    expect(workflow).toContain("yrese-ui-browser-evidence");
  });

  it("checks versioned draft persistence without hiding unrelated browser failures", () => {
    expect(browserCheck).toContain("checkReceptionDraftPersistence");
    expect(browserCheck).toContain("expectedDraftNotFoundResponses");
    expect(browserCheck).toContain("/prescription-drafts/by-reception/");
    expect(browserCheck).toContain("empty-prescription-draft");
    expect(browserCheck).toContain("reception-to-prescription-versioned-draft-persistence");
    expect(browserCheck).toContain("サーバー保存済み v1");
    expect(browserCheck).toContain("サーバー保存済み v2");
    expect(browserCheck).toContain("axe.run");
    expect(browserCheck).toContain("beforeunload");
    expect(browserCheck).toContain("reflow-200pct-equivalent");
    expect(browserCheck).toContain('forcedColors: "active"');
    expect(browserCheck).toContain('caret: "initial"');
    expect(browserCheck).toContain("findings.consoleErrors.length === 0");
  });

  it("uses only bounded synthetic fixture identities for draft create and update", () => {
    expect(fixtureApi).toContain("patient-e2e-001");
    expect(fixtureApi).toContain("reception-e2e-001");
    expect(fixtureApi).toContain("テスト患者 一");
    expect(fixtureApi).toContain("/prescription-drafts/by-reception/");
    expect(fixtureApi).toContain("expectedVersion");
    expect(fixtureApi).toContain("prescriptionDrafts");
    expect(fixtureApi).toContain("tenant-e2e");
    expect(fixtureApi).toContain("127.0.0.1");
    expect(fixtureApi).not.toContain("amazonaws.com");
  });
});
