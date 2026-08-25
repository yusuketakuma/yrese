import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");

const BASE_URL = process.env.UI_BASE_URL ?? "http://127.0.0.1:3000";
const ARTIFACT_DIR = path.resolve(
  process.env.UI_ARTIFACT_DIR ?? "artifacts/ui-browser",
);
const routes = [
  "/",
  "/patients",
  "/prescriptions",
  "/checkout",
  "/claim-check",
  "/monthly-closing",
  "/masters",
  "/sync-status",
  "/admin",
];
const routeHeadings = new Map([
  ["/", "受付ダッシュボード"],
  ["/patients", "患者検索・患者管理"],
  ["/prescriptions", "処方入力ワークスペース"],
  ["/checkout", "会計・一部負担金"],
  ["/claim-check", "請求前点検"],
  ["/monthly-closing", "月次締め・返戻管理"],
  ["/masters", "マスター管理"],
  ["/sync-status", "同期状態・外部連携"],
  ["/admin", "yrese 管理設定ダッシュボード"],
]);
const routeViewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "header-boundary", width: 821, height: 768 },
  { name: "mobile", width: 390, height: 844 },
];

await mkdir(ARTIFACT_DIR, { recursive: true });

const findings = {
  baseUrl: BASE_URL,
  checkedAt: new Date().toISOString(),
  routeChecks: [],
  accessibilityViolations: [],
  consoleErrors: [],
  interactionChecks: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function routeName(route) {
  return route === "/" ? "reception" : route.slice(1).replaceAll("/", "-");
}

async function attachErrorCollection(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      findings.consoleErrors.push({
        label,
        kind: "console",
        text: message.text(),
      });
    }
  });
  page.on("pageerror", (error) => {
    findings.consoleErrors.push({
      label,
      kind: "pageerror",
      text: error.message,
    });
  });
}

async function assertNoPageOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    headerMetaRight:
      document.querySelector(".app-header-meta")?.getBoundingClientRect().right ?? 0,
  }));
  assert(
    dimensions.document <= dimensions.viewport + 1,
    `${label}: page-level horizontal overflow (${dimensions.document} > ${dimensions.viewport})`,
  );
  assert(
    dimensions.headerMetaRight <= dimensions.viewport + 1,
    `${label}: header content is clipped (${dimensions.headerMetaRight} > ${dimensions.viewport})`,
  );
}

async function assertMobileSafetyContext(page, label) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const positions = await page.evaluate(() => {
    const mode = document.querySelector(".system-mode-badge")?.getBoundingClientRect();
    const patient = document.querySelector(".patient-context-bar")?.getBoundingClientRect();
    const unsaved = document.querySelector(".unsaved-work-status")?.getBoundingClientRect();
    return {
      viewportHeight: window.innerHeight,
      mode: mode === undefined ? null : { top: mode.top, bottom: mode.bottom },
      patient:
        patient === undefined ? null : { top: patient.top, bottom: patient.bottom },
      unsaved:
        unsaved === undefined ? null : { top: unsaved.top, bottom: unsaved.bottom },
    };
  });
  assert(positions.mode !== null, `${label}: system mode badge is missing`);
  assert(positions.patient !== null, `${label}: patient context is missing`);
  assert(
    positions.mode.top >= 0 && positions.mode.bottom <= positions.viewportHeight,
    `${label}: system mode left the viewport (${positions.mode.top}..${positions.mode.bottom} / ${positions.viewportHeight})`,
  );
  assert(
    positions.patient.top >= positions.mode.bottom &&
      positions.patient.bottom <= positions.viewportHeight,
    `${label}: mobile safety context overlaps or left the viewport (${positions.patient.top}..${positions.patient.bottom} after ${positions.mode.bottom} / ${positions.viewportHeight})`,
  );
  if (positions.unsaved !== null) {
    assert(
      positions.unsaved.bottom <= positions.mode.top ||
        positions.unsaved.top >= positions.mode.bottom,
      `${label}: system mode overlaps unsaved-work status`,
    );
  }
}

async function assertDesktopShellLayout(page, label) {
  const geometry = await page.locator(".app-shell").evaluate((shell) => {
    const sidebar = shell.querySelector(".app-sidebar");
    const workspace = shell.querySelector(".app-workspace");
    if (!(sidebar instanceof HTMLElement) || !(workspace instanceof HTMLElement)) {
      return null;
    }
    const sidebarRect = sidebar.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    return {
      display: getComputedStyle(shell).display,
      sidebarWidth: sidebarRect.width,
      sidebarRight: sidebarRect.right,
      workspaceLeft: workspaceRect.left,
      workspaceWidth: workspaceRect.width,
    };
  });
  assert(geometry !== null, `${label}: app shell children are missing`);
  assert(geometry.display === "grid", `${label}: app shell is not a CSS grid`);
  assert(
    geometry.sidebarWidth >= 140 && geometry.sidebarWidth <= 220,
    `${label}: sidebar width is outside the operator-shell range (${geometry.sidebarWidth})`,
  );
  assert(
    Math.abs(geometry.workspaceLeft - geometry.sidebarRight) <= 1,
    `${label}: workspace is not adjacent to the sidebar`,
  );
  assert(
    geometry.workspaceWidth > geometry.sidebarWidth * 2,
    `${label}: workspace did not receive the primary desktop column`,
  );
}

async function runAxe(page, label) {
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () =>
    globalThis.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    }),
  );
  const blocking = result.violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious",
  );
  for (const violation of blocking) {
    findings.accessibilityViolations.push({
      label,
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.flatMap((node) => node.target),
    });
  }
  assert(
    blocking.length === 0,
    `${label}: axe critical/serious violations: ${blocking
      .map((violation) => violation.id)
      .join(", ")}`,
  );
}

async function waitForRoute(page, route) {
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("heading", { name: routeHeadings.get(route), level: 2 })
    .last()
    .waitFor();
}

async function checkRoute(page, route, viewport) {
  const label = `${routeName(route)}-${viewport.width}x${viewport.height}`;
  await page.setViewportSize(viewport);
  const response = await page.goto(`${BASE_URL}${route}`, {
    waitUntil: "domcontentloaded",
  });
  assert(response?.ok() === true, `${label}: route did not return 2xx`);
  await waitForRoute(page, route);
  await page.locator("main#main-content").waitFor();
  assert(
    (await page.locator("main#main-content").count()) === 1,
    `${label}: main landmark missing or duplicated`,
  );
  if (viewport.width > 820) {
    await assertDesktopShellLayout(page, label);
  }
  await assertNoPageOverflow(page, label);
  await runAxe(page, label);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `${label}.png`),
    fullPage: true,
    caret: "initial",
  });
  findings.routeChecks.push({ route, viewport, status: response.status() });
}

async function checkKeyboardLandmarks(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  assert(
    await page.locator(".skip-link").evaluate(
      (element) => document.activeElement === element,
    ),
    "keyboard: first tab stop is not the skip link",
  );
  await page.keyboard.press("Enter");
  assert(
    await page.locator("#main-content").evaluate(
      (element) => document.activeElement === element,
    ),
    "keyboard: skip link did not focus main content",
  );
  await page.keyboard.press("/");
  assert(
    await page.locator("#operator-command-input").evaluate(
      (element) => document.activeElement === element,
    ),
    "keyboard: slash shortcut did not focus command search",
  );

  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  const adminTabs = page.getByRole("tab");
  assert((await adminTabs.count()) === 7, "admin tabs: expected seven tabs");
  await adminTabs.first().focus();
  for (let index = 1; index < 7; index += 1) {
    await page.keyboard.press("ArrowRight");
    const tab = adminTabs.nth(index);
    assert(
      (await tab.getAttribute("aria-selected")) === "true" &&
        (await tab.evaluate((element) => document.activeElement === element)),
      `admin tabs: tab ${index + 1} was not selected and focused`,
    );
    const controls = await tab.getAttribute("aria-controls");
    assert(
      controls !== null &&
        (await page.locator(`#${controls}`).count()) === 1,
      `admin tabs: tab ${index + 1} does not control the rendered panel`,
    );
  }
  await page.keyboard.press("ArrowRight");
  assert(
    (await adminTabs.first().getAttribute("aria-selected")) === "true",
    "admin tabs: ArrowRight did not wrap to the first tab",
  );
  await page.keyboard.press("ArrowLeft");
  assert(
    (await adminTabs.last().getAttribute("aria-selected")) === "true",
    "admin tabs: ArrowLeft did not wrap to the last tab",
  );
  await page.keyboard.press("Home");
  assert(
    (await adminTabs.first().getAttribute("aria-selected")) === "true",
    "admin tabs: Home did not select the first tab",
  );
  await page.keyboard.press("End");
  assert(
    (await adminTabs.last().getAttribute("aria-selected")) === "true",
    "admin tabs: End did not select the last tab",
  );
  assert(
    (await page
      .getByRole("complementary", { name: "環境・管理補助情報" })
      .evaluate((element) => getComputedStyle(element).position)) !== "sticky",
    "admin tabs: secondary column can stick beneath the global header",
  );
  findings.interactionChecks.push({
    name: "keyboard-landmarks-and-command-shortcut",
    status: "pass",
  });
}

async function checkReceptionHandoff(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  const handoff = page.getByRole("link", {
    name: "この受付を処方入力へ引き継ぐ",
  }).first();
  await handoff.waitFor();
  await handoff.click();
  await page.waitForURL(`${BASE_URL}/prescriptions`);
  await page.getByText("受付との関連を確認しました").waitFor();
  await page.locator(".patient-context-bar").getByText("テスト患者 一").waitFor();
  assert(
    (await page.locator('[data-reception-linked="true"]').count()) === 1,
    "reception handoff: verified linked workspace was not rendered",
  );
  assert(
    await page.getByText("処方保存API・監査証跡が未接続です").isVisible(),
    "reception handoff: unsupported persistence was not kept fail-closed",
  );
  await runAxe(page, "reception-to-prescription-handoff");
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "reception-to-prescription-handoff.png"),
    fullPage: true,
    caret: "initial",
  });
  findings.interactionChecks.push({
    name: "reception-to-prescription-fresh-patient-verification",
    status: "pass",
  });

  await page.locator('.app-nav-link[href="/"]').click();
  await waitForRoute(page, "/");
  const launchRegion = page.getByRole("region", {
    name: "処方入力への受付引き継ぎ",
  });
  await launchRegion.getByLabel("受付の業務日").fill("2026-08-25");
  await launchRegion
    .getByRole("button", { name: "対象受付を確認" })
    .click();
  const searchedHandoff = launchRegion.getByRole("link", {
    name: /受付ID reception-e2e-001/u,
  });
  await searchedHandoff.waitFor();
  assert(
    (await searchedHandoff.getAttribute("href")) === "/prescriptions",
    "reception search launch: result bypassed the guarded handoff route",
  );
  await searchedHandoff.click();
  await page.waitForURL(`${BASE_URL}/prescriptions`);
  await page.getByText("受付との関連を確認しました").waitFor();
  findings.interactionChecks.push({
    name: "reception-search-to-guarded-handoff",
    status: "pass",
  });
}

async function searchPatients(page) {
  await page.locator("#patient-search-q").fill("テスト患者");
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await page
    .getByRole("button", { name: "この患者を選択", exact: true })
    .first()
    .waitFor();
}

async function selectPatient(page, index, dialogAction) {
  const button = page
    .getByRole("button", { name: "この患者を選択", exact: true })
    .nth(index);
  if (dialogAction !== undefined) {
    page.once("dialog", async (dialog) => {
      assert(
        dialog.message().includes("未保存の処方下書き"),
        "patient switch: confirmation did not describe unsaved draft",
      );
      if (dialogAction === "accept") await dialog.accept();
      else await dialog.dismiss();
    });
  }
  await button.click();
}

async function checkDraftRecoveryAndPatientGuard(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${BASE_URL}/patients`, { waitUntil: "networkidle" });
  await searchPatients(page);
  await selectPatient(page, 0);
  await page.locator(".patient-context-bar").getByText("テスト患者 一").waitFor();

  await page.locator('.app-nav-link[href="/prescriptions"]').click();
  await waitForRoute(page, "/prescriptions");
  const drugInput = page.getByLabel("RP1 薬剤名");
  await drugInput.fill("E2E合成薬10mg");
  await page.getByLabel("RP1 用法用量").fill("1日1回 朝");
  await page.getByLabel("メモ（薬剤師メモ・特記事項）").fill("E2E下書き");
  await page.getByText("未保存の変更（このタブ内）").waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const mobileHeader = await page.evaluate(() => {
    const mode = document.querySelector(".system-mode-badge")?.getBoundingClientRect();
    const unsaved = document.querySelector(".unsaved-work-status")?.getBoundingClientRect();
    return mode === undefined || unsaved === undefined
      ? null
      : { modeBottom: mode.bottom, unsavedTop: unsaved.top };
  });
  assert(
    mobileHeader !== null && mobileHeader.modeBottom <= mobileHeader.unsavedTop,
    "mobile safety context: system mode overlaps unsaved-work status",
  );
  await page.setViewportSize({ width: 1366, height: 768 });

  await page.locator('.app-nav-link[href="/checkout"]').click();
  await waitForRoute(page, "/checkout");
  await page.getByText("未保存下書き 1件").waitFor();
  await page.getByRole("link", { name: "処方下書きへ戻る" }).click();
  await waitForRoute(page, "/prescriptions");
  const restoredDrugInput = page.getByLabel("RP1 薬剤名");
  await restoredDrugInput.waitFor();
  await page.waitForFunction(() => {
    const element = document.querySelector('input[aria-label="RP1 薬剤名"]');
    return element instanceof HTMLInputElement && element.value === "E2E合成薬10mg";
  });
  const restoredNoticeVisible = await page
    .getByText("タブ内下書きを復元しました")
    .isVisible()
    .catch(() => false);
  assert(
    (await restoredDrugInput.inputValue()) === "E2E合成薬10mg",
    "draft recovery: drug input was not restored after in-app route change",
  );
  findings.interactionChecks.push({
    name: "draft-recovery-after-in-app-route-change",
    status: "pass",
    mode: restoredNoticeVisible ? "snapshot-remount" : "router-cache-retention",
  });

  const unloadResult = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    const dispatchResult = window.dispatchEvent(event);
    return {
      dispatchResult,
      defaultPrevented: event.defaultPrevented,
    };
  });
  assert(
    unloadResult.defaultPrevented && !unloadResult.dispatchResult,
    "beforeunload: dirty draft did not register a document unload guard",
  );

  await page.locator('.app-nav-link[href="/patients"]').click();
  await waitForRoute(page, "/patients");
  await searchPatients(page);
  await selectPatient(page, 1, "dismiss");
  await page.locator(".patient-context-bar").getByText("テスト患者 一").waitFor();
  assert(
    await page.getByText("未保存下書き 1件").isVisible(),
    "patient switch cancel: draft status disappeared",
  );

  await selectPatient(page, 1, "accept");
  await page.locator(".patient-context-bar").getByText("テスト患者 二").waitFor();
  assert(
    (await page.getByText("未保存下書き 1件").count()) === 0,
    "patient switch accept: old patient draft was not discarded",
  );

  await page.locator('.app-nav-link[href="/prescriptions"]').click();
  await waitForRoute(page, "/prescriptions");
  assert(
    (await page.getByLabel("RP1 薬剤名").inputValue()) === "",
    "patient switch accept: old patient draft leaked into new patient",
  );

  findings.interactionChecks.push({
    name: "beforeunload-and-patient-switch",
    status: "pass",
  });

  const reflowViewports = [
    { name: "desktop", width: 1366, height: 768 },
    { name: "tablet", width: 1024, height: 768 },
    { name: "breakpoint", width: 820, height: 900 },
    { name: "reflow-200pct-equivalent", width: 683, height: 768 },
    { name: "mobile", width: 390, height: 844 },
  ];

  for (const viewport of reflowViewports) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    if (viewport.width <= 820) {
      await assertMobileSafetyContext(page, `prescription-${viewport.name}`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await assertNoPageOverflow(page, `prescription-${viewport.name}`);
    await runAxe(page, `prescription-${viewport.name}`);
    await page.screenshot({
      path: path.join(
        ARTIFACT_DIR,
        `prescription-${viewport.name}-${viewport.width}x${viewport.height}.png`,
      ),
      fullPage: true,
      caret: "initial",
    });
  }

  await page.emulateMedia({ forcedColors: "active" });
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "prescription-forced-colors.png"),
    fullPage: true,
    caret: "initial",
  });
  await page.emulateMedia({ forcedColors: "none" });
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    locale: "ja-JP",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await attachErrorCollection(page, "browser-gate");

  for (const route of routes) {
    for (const viewport of routeViewports) {
      await checkRoute(page, route, viewport);
    }
  }
  await checkKeyboardLandmarks(page);
  await checkReceptionHandoff(page);
  await checkDraftRecoveryAndPatientGuard(page);

  assert(
    findings.consoleErrors.length === 0,
    `browser console/page errors: ${findings.consoleErrors
      .map((entry) => entry.text)
      .join(" | ")}`,
  );

  await context.close();
} finally {
  await writeFile(
    path.join(ARTIFACT_DIR, "results.json"),
    JSON.stringify(findings, null, 2),
    "utf8",
  );
  await browser.close();
}

console.log(
  `UI browser gate passed: ${findings.routeChecks.length} routes, ` +
    `${findings.interactionChecks.length} interaction suites`,
);
