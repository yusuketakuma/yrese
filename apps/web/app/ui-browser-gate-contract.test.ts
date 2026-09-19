import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { KERNEL_ERROR_CODES } from "@yrese/shared-kernel";

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

  it("covers keyboard, accessibility, reflow, reception identity, and unsaved-draft safety", () => {
    expect(browserCheck).toContain("axe.run");
    expect(browserCheck).toContain('waitUntil: "domcontentloaded"');
    expect(browserCheck).toContain("const routeHeadings = new Map");
    expect(browserCheck).toContain("const routeViewports = [");
    expect(browserCheck).toContain("header-boundary");
    expect(browserCheck).toContain('waitForLoadState("networkidle")');
    expect(browserCheck).toContain("window.scrollTo(0, 0)");
    expect(browserCheck).toContain("mobile safety context");
    expect(browserCheck).toContain("admin tabs");
    expect(browserCheck.match(/caret: "initial"/g)).toHaveLength(5);
    expect(browserCheck).toContain("reception-to-prescription-handoff");
    expect(browserCheck).toContain("受付との関連を確認しました");
    expect(browserCheck).toContain("waitForPersistedDraft");
    expect(browserCheck).toContain("data-server-draft-version");
    expect(browserCheck).toContain("data-unsaved-draft");
    expect(browserCheck).toContain("extractLinkedBusinessDate");
    expect(browserCheck).toContain("linkedBusinessDate");
    expect(browserCheck).toContain(
      'getByLabel("受付の業務日").fill(linkedBusinessDate)',
    );
    expect(browserCheck).not.toContain(
      'getByLabel("受付の業務日").fill("2026-08-25")',
    );
    expect(browserCheck).toContain("beforeunload");
    expect(browserCheck).toContain("reflow-200pct-equivalent");
    expect(browserCheck).toContain("未保存下書き 1件");
    expect(browserCheck).toContain("dialog.dismiss");
    expect(browserCheck).toContain("dialog.accept");
    expect(browserCheck).toContain('forcedColors: "active"');
    // WP-7104/WP-7405: North Star 全行程 journey(検索→受付登録→対応開始→
    // 引継ぎ→master 解決下書き保存→薬剤師確認→確定→調剤記録→outbox evidence)。
    expect(browserCheck).toContain("checkNorthStarJourney");
    expect(browserCheck).toContain(
      "north-star-full-journey-reception-to-dispensing(fixture-dispensing)",
    );
    expect(browserCheck).toContain("この患者を受付登録");
    expect(browserCheck).toContain("/対応開始: /u");
    expect(browserCheck).toContain("薬剤師確認へ進む");
    expect(browserCheck).toContain("処方を確定する");
  });

  it("uses synthetic fixture patients and receptions with no production endpoint", () => {
    expect(fixtureApi).toContain("patient-e2e-001");
    expect(fixtureApi).toContain("reception-e2e-001");
    expect(fixtureApi).toContain("テスト患者 一");
    expect(fixtureApi).toContain('url.pathname === "/whoami"');
    expect(fixtureApi).toContain('url.pathname === "/reception/queue"');
    expect(fixtureApi).toContain('url.pathname === "/reception"');
    expect(fixtureApi).toContain("idempotencyKey");
    // fixture のエラー応答は KERNEL_ERROR_CODES に登録済みの実 wire コードだけを
    // 使う(架空コード禁止)。UI-FIXTURE-404 は登録外 route の fixture 固有
    // catch-all で、wire 契約を装わない名前空間付きの例外としてだけ許容する。
    const registeredErrorCodes = new Set<string>(
      KERNEL_ERROR_CODES.map((entry) => entry.code),
    );
    const fixtureOnlyErrorCodes = new Set(["UI-FIXTURE-404"]);
    const usedErrorCodes = [
      ...fixtureApi.matchAll(/errorCode:\s*"([^"]+)"/g),
    ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
    expect(usedErrorCodes.length).toBeGreaterThan(0);
    for (const code of usedErrorCodes) {
      expect(
        registeredErrorCodes.has(code) || fixtureOnlyErrorCodes.has(code),
        `fixture errorCode ${code} must be a registered wire code`,
      ).toBe(true);
    }
    expect(usedErrorCodes).toContain("RCV-0001");
    expect(usedErrorCodes).toContain("RCV-0003");
    expect(usedErrorCodes).toContain("PAT-0002");
    expect(fixtureApi).toContain("/prescription-drafts/by-reception/");
    expect(fixtureApi).toContain("expectedVersion");
    expect(fixtureApi).toContain('request.headers["if-match"]');
    expect(fixtureApi).toContain("response.writeHead(204");
    expect(fixtureApi).not.toContain('saveDisposition: "replayed"');
    expect(browserCheck).not.toContain("isExpectedDraftNotFoundResponse");
    expect(fixtureApi).toContain("tenant-e2e");
    expect(fixtureApi).toContain('service: "api"');
    expect(fixtureApi).toContain("127.0.0.1");
    expect(fixtureApi).not.toContain("amazonaws.com");
    expect(fixtureApi).not.toContain("production");
  });
});
