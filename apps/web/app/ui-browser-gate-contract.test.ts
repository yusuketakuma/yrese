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

  it("covers keyboard, accessibility, reflow, reception handoff, and unsaved-draft safety", () => {
    expect(browserCheck).toContain("axe.run");
    expect(browserCheck).toContain('waitUntil: "domcontentloaded"');
    expect(browserCheck).toContain("const routeHeadings = new Map");
    expect(browserCheck).toContain("const routeViewports = [");
    expect(browserCheck).toContain("header-boundary");
    expect(browserCheck).toContain('waitForLoadState("networkidle")');
    expect(browserCheck).toContain("window.scrollTo(0, 0)");
    expect(browserCheck).toContain("mobile safety context");
    expect(browserCheck).toContain("admin tabs");
    expect(browserCheck.match(/caret: "initial"/g)).toHaveLength(4);
    expect(browserCheck).toContain("reception-to-prescription-handoff");
    expect(browserCheck).toContain("受付との関連を確認しました");
    expect(browserCheck).toContain("waitForPersistedDraft");
    expect(browserCheck).toContain("data-server-draft-version");
    expect(browserCheck).toContain("data-unsaved-draft");
    expect(browserCheck).toContain("isExpectedDraftNotFoundResponse");
    expect(browserCheck).toContain("beforeunload");
    expect(browserCheck).toContain("reflow-200pct-equivalent");
    expect(browserCheck).toContain("未保存下書き 1件");
    expect(browserCheck).toContain("dialog.dismiss");
    expect(browserCheck).toContain("dialog.accept");
    expect(browserCheck).toContain('forcedColors: "active"');
  });

  it("uses synthetic fixture patients and receptions with no production endpoint", () => {
    expect(fixtureApi).toContain("patient-e2e-001");
    expect(fixtureApi).toContain("reception-e2e-001");
    expect(fixtureApi).toContain("テスト患者 一");
    expect(fixtureApi).toContain('url.pathname === "/whoami"');
    expect(fixtureApi).toContain('url.pathname === "/reception/queue"');
    expect(fixtureApi).toContain("/prescription-drafts/by-reception/");
    expect(fixtureApi).toContain("expectedVersion");
    expect(fixtureApi).toContain("tenant-e2e");
    expect(fixtureApi).toContain('service: "api"');
    expect(fixtureApi).toContain("127.0.0.1");
    expect(fixtureApi).not.toContain("amazonaws.com");
    expect(fixtureApi).not.toContain("production");
  });
});
