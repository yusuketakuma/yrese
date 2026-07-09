#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "yrese-script-tests-"));
const failures = [];

function scriptPath(name) {
  return path.join(repoRoot, "scripts", name);
}

function runNode(script, args = [], options = {}) {
  return spawnSync(process.execPath, [scriptPath(script), ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
  });
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

async function writeText(filePath, source) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, source, "utf8");
}

function outputOf(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function ssotDoc(ssotId, status, title = ssotId) {
  return `# ${title}

\`\`\`yaml
ssot_id: ${ssotId}
title: ${title}
domain: fixture
status: ${status}
owner: fable5
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
\`\`\`

Fixture body.
`;
}

function ssotIndex(rows) {
  const rowsBySection = new Map();
  for (const row of rows) {
    const section = row.linkPath.split("/")[0];
    const sectionRows = rowsBySection.get(section) ?? [];
    sectionRows.push(row);
    rowsBySection.set(section, sectionRows);
  }

  const sections = [...rowsBySection.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([section, sectionRows]) => {
      const tableRows = sectionRows
        .sort((left, right) => left.linkPath.localeCompare(right.linkPath))
        .map((row) => `| ${row.ssotId} | [${path.basename(row.linkPath)}](${row.linkPath}) | ${row.status} |`)
        .join("\n");

      return `## docs/${section}/ (${sectionRows.length}件)

| ssot_id | 文書 | status |
|---|---|---|
${tableRows}`;
    })
    .join("\n\n");

  return `# ssot_index — SSOT文書索引

\`\`\`yaml
ssot_id: IDX-001
title: SSOT文書索引
domain: plan
status: APPROVED
owner: fable5
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
\`\`\`

総文書数: ${rows.length}(本索引を除く)

${sections}
`;
}

async function testBoundaryViolationDetection() {
  const root = path.join(tempRoot, "boundary-violation");
  await writeText(
    path.join(root, "packages", "example", "package.json"),
    JSON.stringify({ name: "@fixture/example", dependencies: {} }, null, 2),
  );
  await writeText(
    path.join(root, "packages", "example", "src", "index.ts"),
    "import { buildServer } from '@yrese/api';\nexport const server = buildServer;\n",
  );

  const result = runNode("check-boundaries.mjs", [root]);
  const output = outputOf(result);
  assert(result.status === 1, "check-boundaries should fail for packages importing @yrese/api");
  assert(output.includes("packages/** source must not import app code"), "boundary violation should explain packages -> app import");
}

async function testBoundaryCleanFixturePasses() {
  const root = path.join(tempRoot, "boundary-pass");
  await writeText(
    path.join(root, "packages", "shared-kernel", "package.json"),
    JSON.stringify({ name: "@fixture/shared-kernel", dependencies: {} }, null, 2),
  );
  await writeText(
    path.join(root, "packages", "shared-kernel", "src", "index.ts"),
    "export const SYSTEM_MODES = ['NORMAL'] as const;\n",
  );
  await writeText(
    path.join(root, "apps", "web", "package.json"),
    JSON.stringify({ name: "@fixture/web", dependencies: {} }, null, 2),
  );
  await writeText(path.join(root, "apps", "web", "src", "index.ts"), "export const app = 'web';\n");

  const result = runNode("check-boundaries.mjs", [root]);
  assert(result.status === 0, `check-boundaries should pass for clean fixture: ${outputOf(result)}`);
}

async function testDuplicateRegistryConstDetection() {
  const root = path.join(tempRoot, "duplicate-registry");
  await writeText(
    path.join(root, "packages", "shared-kernel", "package.json"),
    JSON.stringify({ name: "@fixture/shared-kernel", dependencies: {} }, null, 2),
  );
  await writeText(
    path.join(root, "packages", "shared-kernel", "src", "permissions.ts"),
    "export const PERMISSION_RESOURCES = ['patient'] as const;\n",
  );
  await writeText(
    path.join(root, "packages", "feature", "package.json"),
    JSON.stringify({ name: "@fixture/feature", dependencies: {} }, null, 2),
  );
  await writeText(
    path.join(root, "packages", "feature", "src", "permissions.ts"),
    "export const PERMISSION_RESOURCES = ['patient'] as const;\n",
  );

  const result = runNode("check-boundaries.mjs", [root]);
  const output = outputOf(result);
  assert(result.status === 1, "check-boundaries should fail for duplicate permission registry const arrays");
  assert(
    output.includes("duplicate shared-kernel const array 'PERMISSION_RESOURCES'"),
    "duplicate registry finding should name PERMISSION_RESOURCES",
  );
}

async function testSecretAllowlistAndDetection() {
  const allowRoot = path.join(tempRoot, "secrets-allow");
  await writeText(
    path.join(allowRoot, "README.md"),
    "Example only: api_key='Abcdefghijklmnop1' # secret-scan: allow\n",
  );
  const allowResult = runNode("check-secrets.mjs", [], { cwd: allowRoot });
  assert(allowResult.status === 0, `check-secrets should pass allowlisted examples: ${outputOf(allowResult)}`);

  const leakRoot = path.join(tempRoot, "secrets-leak");
  const syntheticOpenAiKey = ["sk", "proj", "abcdefghijklmnopqrstuvwxyzABCDEFGH123456"].join("-");
  await writeText(path.join(leakRoot, ".env"), `OPENAI_API_KEY=${syntheticOpenAiKey}\n`);
  const leakResult = runNode("check-secrets.mjs", [], { cwd: leakRoot });
  const leakOutput = outputOf(leakResult);
  assert(leakResult.status === 1, "check-secrets should fail when a fixture contains a synthetic OpenAI key");
  assert(leakOutput.includes("OpenAI API key"), "secret finding should name the detected pattern");
}

async function testCleanRemovesGeneratedArtifacts() {
  const root = path.join(tempRoot, "clean");
  const generatedPaths = [
    path.join(root, "dist", "index.js"),
    path.join(root, ".next", "BUILD_ID"),
    path.join(root, ".turbo", "cache"),
    path.join(root, "coverage", "coverage-final.json"),
    path.join(root, "apps", "api", "dist", "main.js"),
    path.join(root, "apps", "web", ".next", "BUILD_ID"),
    path.join(root, "packages", "money", "coverage", "coverage-final.json"),
    path.join(root, "packages", "trace", "src", "index.tsbuildinfo"),
  ];

  for (const generatedPath of generatedPaths) {
    await writeText(generatedPath, "generated\n");
  }

  const result = runNode("clean.mjs", [], { cwd: root });
  assert(result.status === 0, `clean should exit successfully: ${outputOf(result)}`);

  for (const generatedPath of generatedPaths) {
    assert(!existsSync(generatedPath), `clean should remove ${path.relative(root, generatedPath)}`);
  }
}

async function testDependencyAuditWrapper() {
  const root = path.join(tempRoot, "dependency-audit");
  const vulnerableReportPath = path.join(root, "audit-vulnerable.json");
  await writeText(
    vulnerableReportPath,
    JSON.stringify(
      {
        advisories: {
          "1": {
            module_name: "example-package",
            severity: "high",
            github_advisory_id: "GHSA-example",
          },
        },
        metadata: {
          vulnerabilities: {
            info: 0,
            low: 0,
            moderate: 0,
            high: 1,
            critical: 0,
          },
        },
      },
      null,
      2,
    ),
  );

  const vulnerableResult = runNode("check-deps.mjs", ["--from-audit-json", vulnerableReportPath]);
  assert(vulnerableResult.status === 1, "check-deps should fail for high severity vulnerabilities");
  assert(outputOf(vulnerableResult).includes("example-package"), "check-deps failure should include advisory summary");

  const registryErrorPath = path.join(root, "registry-error.txt");
  await writeText(registryErrorPath, "ERR_PNPM_META_FETCH_FAIL registry timeout\n");
  const registryResult = runNode("check-deps.mjs", ["--from-audit-error", registryErrorPath]);
  assert(registryResult.status === 0, "check-deps should warn-only for registry/network outages");
  assert(outputOf(registryResult).includes("non-blocking"), "registry outage should be reported as non-blocking");
}

async function testSbomGenerationFixture() {
  const root = path.join(tempRoot, "sbom");
  const listJsonPath = path.join(root, "pnpm-list.json");
  const outputPath = path.join(root, "sbom.json");
  await writeText(
    listJsonPath,
    JSON.stringify(
      [
        {
          name: "fixture-root",
          version: "0.0.1",
          path: root,
          dependencies: {
            "left-pad": {
              version: "1.3.0",
              path: path.join(root, "node_modules", "left-pad"),
            },
          },
          devDependencies: {
            "@fixture/internal": {
              version: "link:packages/internal",
              path: path.join(root, "packages", "internal"),
            },
          },
        },
        {
          name: "@fixture/internal",
          version: "0.0.2",
          path: path.join(root, "packages", "internal"),
        },
      ],
      null,
      2,
    ),
  );

  const result = runNode("check-sbom.mjs", ["--from-list-json", listJsonPath, "--output", outputPath]);
  assert(result.status === 0, `check-sbom should pass for a valid pnpm list fixture: ${outputOf(result)}`);
  const sbom = JSON.parse(await readFile(outputPath, "utf8"));
  assert(sbom.bomFormat === "CycloneDX", "check-sbom should emit CycloneDX metadata");
  assert(sbom.components.length >= 3, "check-sbom should emit workspace and dependency components");
  assert(
    sbom.components.some((component) => component.name === "@fixture/internal" && component.version === "0.0.2"),
    "check-sbom should resolve workspace link versions",
  );
}

async function testSsotIndexCleanFixturePasses() {
  const root = path.join(tempRoot, "ssot-index-pass");
  await writeText(path.join(root, "docs", "architecture", "system_context.md"), ssotDoc("ARC-001", "APPROVED"));
  await writeText(path.join(root, "docs", "product", "mvp_scope.md"), ssotDoc("PRD-001", "APPROVED"));
  await writeText(path.join(root, "docs", "product", "non_mvp_scope.md"), ssotDoc("PRD-002", "PROPOSED"));
  await writeText(
    path.join(root, "docs", "ssot_index.md"),
    ssotIndex([
      { ssotId: "ARC-001", linkPath: "architecture/system_context.md", status: "APPROVED" },
      { ssotId: "PRD-001", linkPath: "product/mvp_scope.md", status: "APPROVED" },
      { ssotId: "PRD-002", linkPath: "product/non_mvp_scope.md", status: "PROPOSED" },
    ]),
  );

  const result = runNode("check-ssot-index.mjs", [root]);
  assert(result.status === 0, `check-ssot-index should pass for a matching fixture: ${outputOf(result)}`);
}

async function testSsotIndexDetectsMissingDocumentRow() {
  const root = path.join(tempRoot, "ssot-index-missing-row");
  await writeText(path.join(root, "docs", "product", "mvp_scope.md"), ssotDoc("PRD-001", "APPROVED"));
  await writeText(path.join(root, "docs", "product", "non_mvp_scope.md"), ssotDoc("PRD-002", "PROPOSED"));
  await writeText(
    path.join(root, "docs", "ssot_index.md"),
    ssotIndex([{ ssotId: "PRD-001", linkPath: "product/mvp_scope.md", status: "APPROVED" }]),
  );

  const result = runNode("check-ssot-index.mjs", [root]);
  const output = outputOf(result);
  assert(result.status === 1, "check-ssot-index should fail when a document is missing from the index");
  assert(output.includes("missing from docs/ssot_index.md"), "missing row finding should name the index drift");
  assert(output.includes("regenerate the SSOT index"), "missing row finding should point to index regeneration");
}

async function testSsotIndexDetectsStatusMismatch() {
  const root = path.join(tempRoot, "ssot-index-status-mismatch");
  await writeText(path.join(root, "docs", "product", "mvp_scope.md"), ssotDoc("PRD-001", "APPROVED"));
  await writeText(
    path.join(root, "docs", "ssot_index.md"),
    ssotIndex([{ ssotId: "PRD-001", linkPath: "product/mvp_scope.md", status: "PROPOSED" }]),
  );

  const result = runNode("check-ssot-index.mjs", [root]);
  assert(result.status === 1, "check-ssot-index should fail for status drift");
  assert(outputOf(result).includes("status mismatch"), "status drift finding should explain the mismatch");
}

async function testSsotIndexDetectsDuplicateSsotId() {
  const root = path.join(tempRoot, "ssot-index-duplicate-id");
  await writeText(path.join(root, "docs", "product", "mvp_scope.md"), ssotDoc("PRD-001", "APPROVED"));
  await writeText(path.join(root, "docs", "quality", "quality_plan.md"), ssotDoc("PRD-001", "APPROVED"));
  await writeText(
    path.join(root, "docs", "ssot_index.md"),
    ssotIndex([
      { ssotId: "PRD-001", linkPath: "product/mvp_scope.md", status: "APPROVED" },
      { ssotId: "PRD-001", linkPath: "quality/quality_plan.md", status: "APPROVED" },
    ]),
  );

  const result = runNode("check-ssot-index.mjs", [root]);
  assert(result.status === 1, "check-ssot-index should fail for duplicate frontmatter ssot_id values");
  assert(outputOf(result).includes("duplicate PRD-001"), "duplicate finding should name the repeated ssot_id");
}

try {
  await testBoundaryViolationDetection();
  await testBoundaryCleanFixturePasses();
  await testDuplicateRegistryConstDetection();
  await testSecretAllowlistAndDetection();
  await testCleanRemovesGeneratedArtifacts();
  await testDependencyAuditWrapper();
  await testSbomGenerationFixture();
  await testSsotIndexCleanFixturePasses();
  await testSsotIndexDetectsMissingDocumentRow();
  await testSsotIndexDetectsStatusMismatch();
  await testSsotIndexDetectsDuplicateSsotId();
} finally {
  await rm(tempRoot, { force: true, recursive: true });
}

if (failures.length > 0) {
  console.error(`Script regression harness failed with ${failures.length} failure(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("Script regression harness passed.");
}
