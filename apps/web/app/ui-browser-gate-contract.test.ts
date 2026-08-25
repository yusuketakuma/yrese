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
  it("runs for main and the operator branch against the development proxy", () => {
    expect(workflow).toContain("branches: [main, feat/operator-first-ui]");
    expect(workflow).toContain("pnpm --filter @yrese/web build");
    expect(workflow).toContain("pnpm --filter @yrese/web dev");
    expect(workflow).toContain("playwright@1.62.1");
    expect(workflow).toContain("axe-core@4.13.0");
    expect(workflow).toContain(
      "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    );
    expect(workflow).toContain("yrese-ui-browser-evidence");
    expect(ciWorkflow).toContain(
      "branches: [main, feat/operator-first-ui]",
    );
  });

  it("covers keyboard, accessibility, reflow, and unsaved-draft safety", () => {
    expect(browserCheck).toContain("axe.run");
    expect(browserCheck).toContain("beforeunload");
    expect(browserCheck).toContain("reflow-200pct-equivalent");
    expect(browserCheck).toContain("未保存下書き 1件");
    expect(browserCheck).toContain("dialog.dismiss");
    expect(browserCheck).toContain("dialog.accept");
    expect(browserCheck).toContain('forcedColors: "active"');
  });

  it("uses synthetic fixture patients and no production endpoint", () => {
    expect(fixtureApi).toContain("patient-e2e-001");
    expect(fixtureApi).toContain("テスト患者 一");
    expect(fixtureApi).toContain("127.0.0.1");
    expect(fixtureApi).not.toContain("amazonaws.com");
    expect(fixtureApi).not.toContain("production");
  });
});
