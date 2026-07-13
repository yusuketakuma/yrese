#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
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
    env: options.env ?? process.env,
  });
}

function runTsx(script, args = [], options = {}) {
  return spawnSync("pnpm", ["exec", "tsx", scriptPath(script), ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    timeout: options.timeout,
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
  await writeText(path.join(root, "apps", "web", "package.json"), JSON.stringify({ name: "@fixture/web" }));
  await writeText(path.join(root, "apps", "web", "src", "index.ts"), "export const app = 'web';\n");
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

async function testPureCoreRejectsAwsAndDynamoDbImports() {
  const root = path.join(tempRoot, "pure-core-aws-violation");
  await writeText(path.join(root, "apps", "web", "package.json"), JSON.stringify({ name: "@fixture/web" }));
  await writeText(path.join(root, "apps", "web", "src", "index.ts"), "export const app = 'web';\n");
  await writeText(
    path.join(root, "packages", "audit", "package.json"),
    JSON.stringify({ name: "@fixture/audit", dependencies: {} }, null, 2),
  );
  await writeText(
    path.join(root, "packages", "audit", "src", "index.ts"),
    [
      "import AWS from 'aws-sdk';",
      "import { DynamoDBClient } from '@aws-sdk/client-dynamodb';",
      "import { Table } from 'dynamodb-toolbox';",
      "export const sdk = { AWS, DynamoDBClient, Table };",
      "",
    ].join("\n"),
  );

  const result = runNode("check-boundaries.mjs", [root]);
  const output = outputOf(result);
  assert(result.status === 1, "check-boundaries should fail when pure core packages import AWS or DynamoDB modules");
  assert(
    output.includes("pure core package 'audit' must not import AWS SDK"),
    "pure core AWS SDK finding should name the package and AWS SDK",
  );
  assert(
    output.includes("pure core package 'audit' must not import DynamoDB module (dynamodb-toolbox)"),
    "pure core DynamoDB finding should name the DynamoDB module import",
  );
}

async function testPureCoreRejectsAwsAndDynamoDbImportsThroughNonStaticForms() {
  const root = path.join(tempRoot, "pure-core-aws-nonstatic-violation");
  await writeText(path.join(root, "apps", "web", "package.json"), JSON.stringify({ name: "@fixture/web" }));
  await writeText(path.join(root, "apps", "web", "src", "index.ts"), "export const app = 'web';\n");
  await writeText(
    path.join(root, "packages", "trace", "package.json"),
    JSON.stringify({ name: "@fixture/trace", dependencies: {} }, null, 2),
  );
  await writeText(
    path.join(root, "packages", "trace", "src", "index.ts"),
    [
      "const AWS = require('aws-sdk');",
      "const dynamoClient = import('@aws-sdk/client-dynamodb');",
      "export * from 'dynamodb-toolbox';",
      "export const refs = { AWS, dynamoClient };",
      "",
    ].join("\n"),
  );

  const result = runNode("check-boundaries.mjs", [root]);
  const output = outputOf(result);
  assert(result.status === 1, "check-boundaries should fail for pure core require/dynamic/export AWS imports");
  assert(output.includes("pure core package 'trace' must not import AWS SDK"), "non-static AWS SDK import should fail");
  assert(
    output.includes("pure core package 'trace' must not import DynamoDB module (dynamodb-toolbox)"),
    "non-static DynamoDB module export should fail",
  );
}

async function testAppAwsImportDoesNotTripPureCoreRule() {
  const root = path.join(tempRoot, "app-aws-import-pass");
  await writeText(
    path.join(root, "packages", "shared-kernel", "package.json"),
    JSON.stringify({ name: "@fixture/shared-kernel" }),
  );
  await writeText(
    path.join(root, "packages", "shared-kernel", "src", "index.ts"),
    "export const value = 'fixture';\n",
  );
  await writeText(
    path.join(root, "apps", "api", "package.json"),
    JSON.stringify({ name: "@fixture/api", dependencies: {} }, null, 2),
  );
  await writeText(
    path.join(root, "apps", "api", "src", "index.ts"),
    "import { DynamoDBClient } from '@aws-sdk/client-dynamodb';\nexport const client = DynamoDBClient;\n",
  );

  const result = runNode("check-boundaries.mjs", [root]);
  assert(result.status === 0, `check-boundaries should allow AWS imports outside pure core packages: ${outputOf(result)}`);
}

async function testDuplicateRegistryConstDetection() {
  const root = path.join(tempRoot, "duplicate-registry");
  await writeText(path.join(root, "apps", "web", "package.json"), JSON.stringify({ name: "@fixture/web" }));
  await writeText(path.join(root, "apps", "web", "src", "index.ts"), "export const app = 'web';\n");
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

async function testDuplicateContractAndKernelConstDetectionAcrossApps() {
  const root = path.join(tempRoot, "duplicate-contracts");
  await writeText(
    path.join(root, "packages", "shared-kernel", "package.json"),
    JSON.stringify({ name: "@fixture/shared-kernel", dependencies: {} }, null, 2),
  );
  await writeText(
    path.join(root, "packages", "shared-kernel", "src", "status.ts"),
    "export const ELIGIBILITY_STATUSES = ['VERIFIED'] as const;\n",
  );
  await writeText(
    path.join(root, "packages", "contracts", "package.json"),
    JSON.stringify({ name: "@fixture/contracts", dependencies: { "@fixture/shared-kernel": "workspace:*" } }, null, 2),
  );
  await writeText(
    path.join(root, "packages", "contracts", "src", "patient-search.ts"),
    [
      "export const ELIGIBILITY_STATUSES = ['VERIFIED'] as const;",
      "export const PATIENT_SEARCH_CURSOR_MAX_LENGTH = 512;",
      "",
    ].join("\n"),
  );
  await writeText(
    path.join(root, "apps", "web", "package.json"),
    JSON.stringify({ name: "@fixture/web", dependencies: { "@fixture/contracts": "workspace:*" } }, null, 2),
  );
  await writeText(
    path.join(root, "apps", "web", "app", "patient-search.tsx"),
    [
      "export const ELIGIBILITY_STATUSES = ['VERIFIED'] as const;",
      "const PATIENT_SEARCH_CURSOR_MAX_LENGTH = 100;",
      "export const value = PATIENT_SEARCH_CURSOR_MAX_LENGTH;",
      "",
    ].join("\n"),
  );

  const result = runNode("check-boundaries.mjs", [root]);
  const output = outputOf(result);
  assert(result.status === 1, "check-boundaries should fail for apps redefining contract/kernel const values");
  assert(
    output.includes("duplicate shared-kernel const array 'ELIGIBILITY_STATUSES'"),
    "contracts duplicate finding should name ELIGIBILITY_STATUSES",
  );
  assert(
    output.includes("duplicate contracts const 'PATIENT_SEARCH_CURSOR_MAX_LENGTH'"),
    "contracts duplicate finding should name PATIENT_SEARCH_CURSOR_MAX_LENGTH",
  );
}

async function testBoundaryScopeValidationFailsClosed() {
  const fixedMessage = "Boundary check could not validate the protected workspace scope.";
  const fixtures = [];

  fixtures.push({ label: "missing root", root: path.join(tempRoot, "boundary-missing-root") });

  const missingApps = path.join(tempRoot, "boundary-missing-apps");
  await writeText(path.join(missingApps, "packages", "core", "package.json"), JSON.stringify({ name: "@fixture/core" }));
  await writeText(path.join(missingApps, "packages", "core", "src", "index.ts"), "export const marker = 'do-not-echo';\n");
  fixtures.push({ label: "missing apps", root: missingApps });

  const emptyScopes = path.join(tempRoot, "boundary-empty-scopes");
  await mkdir(path.join(emptyScopes, "apps"), { recursive: true });
  await mkdir(path.join(emptyScopes, "packages"), { recursive: true });
  fixtures.push({ label: "empty scopes", root: emptyScopes });

  const missingManifest = path.join(tempRoot, "boundary-missing-manifest");
  await writeText(path.join(missingManifest, "apps", "web", "src", "index.ts"), "export const app = true;\n");
  await writeText(path.join(missingManifest, "packages", "core", "package.json"), JSON.stringify({ name: "@fixture/core" }));
  await writeText(path.join(missingManifest, "packages", "core", "src", "index.ts"), "export const core = true;\n");
  fixtures.push({ label: "missing manifest", root: missingManifest });

  const sourceEmpty = path.join(tempRoot, "boundary-source-empty");
  await writeText(path.join(sourceEmpty, "apps", "web", "package.json"), JSON.stringify({ name: "@fixture/web" }));
  await writeText(path.join(sourceEmpty, "packages", "core", "package.json"), JSON.stringify({ name: "@fixture/core" }));
  await writeText(path.join(sourceEmpty, "packages", "core", "src", "index.ts"), "export const core = true;\n");
  fixtures.push({ label: "source-empty app", root: sourceEmpty });

  const scopeFile = path.join(tempRoot, "boundary-scope-file");
  await writeText(path.join(scopeFile, "apps"), "do-not-echo\n");
  await writeText(path.join(scopeFile, "packages", "core", "package.json"), JSON.stringify({ name: "@fixture/core" }));
  await writeText(path.join(scopeFile, "packages", "core", "src", "index.ts"), "export const core = true;\n");
  fixtures.push({ label: "scope file", root: scopeFile });

  const malformedManifest = path.join(tempRoot, "boundary-malformed-manifest");
  await writeText(path.join(malformedManifest, "apps", "web", "package.json"), "{do-not-echo");
  await writeText(path.join(malformedManifest, "apps", "web", "src", "index.ts"), "export const app = true;\n");
  await writeText(
    path.join(malformedManifest, "packages", "core", "package.json"),
    JSON.stringify({ name: "@fixture/core" }),
  );
  await writeText(path.join(malformedManifest, "packages", "core", "src", "index.ts"), "export const core = true;\n");
  fixtures.push({ label: "malformed manifest", root: malformedManifest });

  const symlinkScope = path.join(tempRoot, "boundary-symlink-scope");
  const symlinkTarget = path.join(tempRoot, "boundary-symlink-target");
  await writeText(path.join(symlinkTarget, "web", "package.json"), JSON.stringify({ name: "@fixture/web" }));
  await writeText(path.join(symlinkTarget, "web", "src", "index.ts"), "export const app = true;\n");
  await mkdir(symlinkScope, { recursive: true });
  await symlink(symlinkTarget, path.join(symlinkScope, "apps"));
  await writeText(path.join(symlinkScope, "packages", "core", "package.json"), JSON.stringify({ name: "@fixture/core" }));
  await writeText(path.join(symlinkScope, "packages", "core", "src", "index.ts"), "export const core = true;\n");
  fixtures.push({ label: "scope symlink", root: symlinkScope });

  const nestedSymlink = path.join(tempRoot, "boundary-nested-symlink");
  await writeText(path.join(nestedSymlink, "apps", "web", "package.json"), JSON.stringify({ name: "@fixture/web" }));
  await writeText(path.join(nestedSymlink, "apps", "web", "src", "index.ts"), "export const app = true;\n");
  await writeText(path.join(nestedSymlink, "packages", "core", "package.json"), JSON.stringify({ name: "@fixture/core" }));
  await writeText(path.join(nestedSymlink, "packages", "core", "src", "index.ts"), "export const core = true;\n");
  await symlink(
    path.join(nestedSymlink, "packages", "core", "src", "index.ts"),
    path.join(nestedSymlink, "packages", "core", "src", "linked.ts"),
  );
  fixtures.push({ label: "nested source symlink", root: nestedSymlink });

  for (const [label, ignoredPath] of [
    ["workspace ignored-name file", ["apps", "dist"]],
    ["nested ignored-name file", ["apps", "web", "src", "node_modules"]],
  ]) {
    const ignoredFileRoot = path.join(tempRoot, `boundary-${label.replaceAll(" ", "-")}`);
    await writeText(path.join(ignoredFileRoot, "apps", "web", "package.json"), JSON.stringify({ name: "@fixture/web" }));
    await writeText(path.join(ignoredFileRoot, "apps", "web", "src", "index.ts"), "export const app = true;\n");
    await writeText(
      path.join(ignoredFileRoot, "packages", "core", "package.json"),
      JSON.stringify({ name: "@fixture/core" }),
    );
    await writeText(path.join(ignoredFileRoot, "packages", "core", "src", "index.ts"), "export const core = true;\n");
    await writeText(path.join(ignoredFileRoot, ...ignoredPath), "do-not-echo\n");
    fixtures.push({ label, root: ignoredFileRoot });
  }

  for (const fixture of fixtures) {
    const result = runNode("check-boundaries.mjs", [fixture.root]);
    const output = outputOf(result);
    assert(result.status === 1, `check-boundaries should fail for ${fixture.label}`);
    assert(output.includes(fixedMessage), `${fixture.label} should use the fixed scope error`);
    assert(!output.includes("Boundary check passed."), `${fixture.label} must not report PASS`);
    assert(!output.includes(fixture.root), `${fixture.label} must not echo the fixture path`);
    assert(!output.includes("do-not-echo"), `${fixture.label} must not echo source content`);
  }
}

async function testCalculationPurityCleanFixturePasses() {
  const root = path.join(tempRoot, "calculation-purity-pass");
  await writeText(
    path.join(root, "packages", "calculation", "src", "index.ts"),
    [
      "export function calculate(input: { readonly points: bigint }) {",
      "  // Date.now(), new Date(), Math.random(), parseFloat(), and Math.round() are mentioned only in comments.",
      "  return { points: input.points };",
      "}",
      "",
    ].join("\n"),
  );
  await writeText(
    path.join(root, "packages", "calculation", "src", "calculation.test.ts"),
    [
      "it('can use clocks in test-only fixtures', () => {",
      "  expect(Date.now()).toBeGreaterThan(0);",
      "  expect(new Date()).toBeInstanceOf(Date);",
      "});",
      "",
    ].join("\n"),
  );

  const result = runNode("check-calculation-purity.mjs", [root]);
  assert(result.status === 0, `check-calculation-purity should ignore comments and test files: ${outputOf(result)}`);
}

async function testCalculationPurityViolationDetection() {
  const root = path.join(tempRoot, "calculation-purity-violation");
  await writeText(
    path.join(root, "packages", "calculation", "src", "index.ts"),
    [
      "export function calculate(raw: string) {",
      "  const startedAt = Date.now();",
      "  const wallClock = new Date();",
      "  const jitter = Math.random();",
      "  const parsed = parseFloat(raw);",
      "  const rounded = Math.round(parsed);",
      "  return { startedAt, wallClock, jitter, rounded };",
      "}",
      "",
    ].join("\n"),
  );

  const result = runNode("check-calculation-purity.mjs", [root]);
  const output = outputOf(result);
  assert(result.status === 1, "check-calculation-purity should fail for CAL-010 forbidden patterns");
  for (const forbidden of ["Date.now()", "new Date()", "Math.random()", "parseFloat()", "Math.round()"]) {
    assert(output.includes(forbidden), `purity violation output should name ${forbidden}`);
  }
  assert(output.includes("comments are ignored"), "purity violation output should document comment handling");
  assert(output.includes("test/spec files are excluded"), "purity violation output should document test handling");
}

async function testCalculationPurityInvalidScopesFailClosed() {
  const fixedMessage =
    "Calculation purity check failed: protected source scope is unavailable or contains no production source files.";
  const fixtures = [];

  fixtures.push({ label: "missing root", root: path.join(tempRoot, "purity-missing-root") });

  const missingTargetRoot = path.join(tempRoot, "purity-missing-target");
  await mkdir(missingTargetRoot, { recursive: true });
  fixtures.push({ label: "missing target", root: missingTargetRoot });

  const targetFileRoot = path.join(tempRoot, "purity-target-file");
  await writeText(path.join(targetFileRoot, "packages", "calculation"), "not a directory\n");
  fixtures.push({ label: "target file", root: targetFileRoot });

  const emptyRoot = path.join(tempRoot, "purity-empty");
  await mkdir(path.join(emptyRoot, "packages", "calculation"), { recursive: true });
  fixtures.push({ label: "empty target", root: emptyRoot });

  const testsOnlyRoot = path.join(tempRoot, "purity-tests-only");
  await writeText(
    path.join(testsOnlyRoot, "packages", "calculation", "src", "only.test.ts"),
    "expect(Date.now()).toBeGreaterThan(0);\n",
  );
  fixtures.push({ label: "test-only target", root: testsOnlyRoot });

  const ignoredOnlyRoot = path.join(tempRoot, "purity-ignored-only");
  await writeText(
    path.join(ignoredOnlyRoot, "packages", "calculation", "dist", "generated.ts"),
    "export const marker = 'ignored';\n",
  );
  fixtures.push({ label: "ignored-only target", root: ignoredOnlyRoot });

  const targetSymlinkRoot = path.join(tempRoot, "purity-target-symlink");
  const targetSymlinkExternal = path.join(tempRoot, "purity-target-symlink-external");
  await writeText(path.join(targetSymlinkExternal, "index.ts"), "export const sensitiveMarker = 'do-not-echo';\n");
  await mkdir(path.join(targetSymlinkRoot, "packages"), { recursive: true });
  await symlink(targetSymlinkExternal, path.join(targetSymlinkRoot, "packages", "calculation"));
  fixtures.push({ label: "target symlink", root: targetSymlinkRoot });

  const nestedSymlinkRoot = path.join(tempRoot, "purity-nested-symlink");
  const nestedSymlinkExternal = path.join(tempRoot, "purity-nested-symlink-external");
  await writeText(path.join(nestedSymlinkRoot, "packages", "calculation", "src", "index.ts"), "export const value = 1;\n");
  await writeText(path.join(nestedSymlinkExternal, "secret.ts"), "export const sensitiveMarker = 'do-not-echo';\n");
  await symlink(
    nestedSymlinkExternal,
    path.join(nestedSymlinkRoot, "packages", "calculation", "linked-source"),
  );
  fixtures.push({ label: "nested symlink", root: nestedSymlinkRoot });

  for (const fixture of fixtures) {
    const result = runNode("check-calculation-purity.mjs", [fixture.root]);
    const output = outputOf(result);
    assert(result.status === 1, `check-calculation-purity should fail for ${fixture.label}`);
    assert(output.includes(fixedMessage), `${fixture.label} should use the fixed scope error`);
    assert(!output.includes("Calculation purity check passed."), `${fixture.label} must not report PASS`);
    assert(!output.includes(fixture.root), `${fixture.label} must not echo the absolute fixture path`);
    assert(!output.includes("do-not-echo"), `${fixture.label} must not echo nested source content`);
  }
}

async function testSecretAllowlistAndDetection() {
  const fixedScopeMessage = "Secret scan could not validate the protected repository scope.";
  const invalidScopes = [];
  const emptyRoot = path.join(tempRoot, "secrets-empty");
  await mkdir(emptyRoot, { recursive: true });
  invalidScopes.push({ label: "empty root", root: emptyRoot });
  const noneligibleRoot = path.join(tempRoot, "secrets-noneligible");
  await writeText(path.join(noneligibleRoot, "fixture.bin"), "do-not-echo");
  invalidScopes.push({ label: "noneligible-only root", root: noneligibleRoot });
  const symlinkRoot = path.join(tempRoot, "secrets-symlink");
  const externalSecret = path.join(tempRoot, "secrets-external.ts");
  const externalCredential = ["Synthetic", "External", "Credential", "1234"].join("_");
  await writeText(externalSecret, `api_key='${externalCredential}'\n`);
  await mkdir(symlinkRoot, { recursive: true });
  await symlink(externalSecret, path.join(symlinkRoot, "linked.ts"));
  invalidScopes.push({ label: "eligible symlink", root: symlinkRoot });
  const ignoredWrongKind = path.join(tempRoot, "secrets-ignored-wrong-kind");
  await writeText(path.join(ignoredWrongKind, "README.md"), "clean eligible text\n");
  await writeText(path.join(ignoredWrongKind, "node_modules"), "do-not-echo");
  invalidScopes.push({ label: "ignored directory name as file", root: ignoredWrongKind });
  for (const fixture of invalidScopes) {
    const result = runNode("check-secrets.mjs", [], { cwd: fixture.root });
    const output = outputOf(result);
    assert(result.status === 1, `check-secrets should fail for ${fixture.label}`);
    assert(output.includes(fixedScopeMessage), `${fixture.label} should use the fixed scope error`);
    assert(!output.includes("Secret scan passed."), `${fixture.label} must not report PASS`);
    assert(!output.includes(fixture.root), `${fixture.label} must not echo the root path`);
    assert(!output.includes(externalCredential), `${fixture.label} must not echo target content`);
    assert(!output.includes("do-not-echo"), `${fixture.label} must not echo skipped content`);
  }

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

  const cleanSqlRoot = path.join(tempRoot, "secrets-sql-clean");
  await writeText(
    path.join(cleanSqlRoot, "migrations", "000004_clean_fixture.sql"),
    "CREATE TABLE synthetic_fixture (fixture_id TEXT PRIMARY KEY);\n",
  );
  const cleanSqlResult = runNode("check-secrets.mjs", [], { cwd: cleanSqlRoot });
  assert(cleanSqlResult.status === 0, `check-secrets should pass clean SQL: ${outputOf(cleanSqlResult)}`);

  const syntheticSqlSecret = ["Synthetic", "Sql", "Credential", "1234"].join("_");
  const sqlLeakRoot = path.join(tempRoot, "secrets-sql-leak");
  const sqlLeakRelativePath = path.join("migrations", "000004_secret_fixture.sql");
  await writeText(
    path.join(sqlLeakRoot, sqlLeakRelativePath),
    `-- Synthetic scanner fixture; not a real credential.\nUPDATE synthetic_fixture SET api_key = '${syntheticSqlSecret}';\n`,
  );
  const sqlLeakResult = runNode("check-secrets.mjs", [], { cwd: sqlLeakRoot });
  const sqlLeakOutput = outputOf(sqlLeakResult);
  assert(sqlLeakResult.status === 1, "check-secrets should fail for a synthetic SQL API-key assignment");
  assert(
    sqlLeakOutput.includes("migrations/000004_secret_fixture.sql:2: Generic secret assignment"),
    "SQL secret finding should include the relative path, line, and pattern name",
  );
  assert(!sqlLeakOutput.includes(syntheticSqlSecret), "SQL secret finding must not expose the raw synthetic value");

  const allowedSqlRoot = path.join(tempRoot, "secrets-sql-allow");
  await writeText(
    path.join(allowedSqlRoot, "migrations", "000004_allowed_fixture.sql"),
    `UPDATE synthetic_fixture SET api_key = '${syntheticSqlSecret}'; -- secret-scan: allow\n`,
  );
  const allowedSqlResult = runNode("check-secrets.mjs", [], { cwd: allowedSqlRoot });
  assert(
    allowedSqlResult.status === 0,
    `check-secrets should honor a same-line SQL allow marker: ${outputOf(allowedSqlResult)}`,
  );

  const syntheticShellSecret = ["Synthetic", "Shell", "Credential", "1234"].join("_");
  for (const extension of [".sh", ".bash", ".zsh"]) {
    const shellRoot = path.join(tempRoot, `secrets-shell-${extension.slice(1)}`);
    const relativePath = `fixture${extension}`;
    await writeText(path.join(shellRoot, relativePath), `api_key='${syntheticShellSecret}'\n`);
    const result = runNode("check-secrets.mjs", [], { cwd: shellRoot });
    const output = outputOf(result);
    assert(result.status === 1, `check-secrets should scan ${extension} generic assignments`);
    assert(
      output.includes(`${relativePath}:1: Generic secret assignment`),
      `${extension} finding should include relative path, line, and pattern name`,
    );
    assert(!output.includes(syntheticShellSecret), `${extension} finding must not expose the raw synthetic value`);

    const allowRoot = path.join(tempRoot, `secrets-shell-allow-${extension.slice(1)}`);
    await writeText(
      path.join(allowRoot, relativePath),
      `api_key='${syntheticShellSecret}' # secret-scan: allow\n`,
    );
    const allowResult = runNode("check-secrets.mjs", [], { cwd: allowRoot });
    assert(allowResult.status === 0, `check-secrets should honor ${extension} same-line allow markers`);
  }

  const privateKeyHeader = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  for (const extension of [".pem", ".key"]) {
    const keyRoot = path.join(tempRoot, `secrets-key-${extension.slice(1)}`);
    const relativePath = `fixture${extension}`;
    await writeText(path.join(keyRoot, relativePath), `${privateKeyHeader}\nsynthetic fixture only\n`);
    const result = runNode("check-secrets.mjs", [], { cwd: keyRoot });
    const output = outputOf(result);
    assert(result.status === 1, `check-secrets should scan ${extension} private-key headers`);
    assert(
      output.includes(`${relativePath}:1: Private key block`),
      `${extension} finding should include relative path, line, and pattern name`,
    );
    assert(!output.includes("synthetic fixture only"), `${extension} finding must not expose fixture content`);

    const allowRoot = path.join(tempRoot, `secrets-key-allow-${extension.slice(1)}`);
    await writeText(path.join(allowRoot, relativePath), `${privateKeyHeader} # secret-scan: allow\n`);
    const allowResult = runNode("check-secrets.mjs", [], { cwd: allowRoot });
    assert(allowResult.status === 0, `check-secrets should honor ${extension} same-line allow markers`);
  }

  const cleanShellRoot = path.join(tempRoot, "secrets-shell-clean");
  await writeText(path.join(cleanShellRoot, "fixture.sh"), "echo 'synthetic fixture'\n");
  await writeText(path.join(cleanShellRoot, "certificate.pem"), "-----BEGIN CERTIFICATE-----\nfixture\n");
  await writeText(path.join(cleanShellRoot, "public.key"), "-----BEGIN PUBLIC KEY-----\nfixture\n");
  const cleanShellResult = runNode("check-secrets.mjs", [], { cwd: cleanShellRoot });
  assert(
    cleanShellResult.status === 0,
    `check-secrets should preserve clean shell/certificate/public-key boundaries: ${outputOf(cleanShellResult)}`,
  );
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
  const cleanCounts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  const auditReport = (counts = cleanCounts, advisories = {}) => ({
    advisories,
    metadata: { vulnerabilities: counts },
  });
  const writeAuditReport = async (name, report) => {
    const reportPath = path.join(root, name);
    await writeText(reportPath, JSON.stringify(report, null, 2));
    return reportPath;
  };

  const cleanReportPath = await writeAuditReport("audit-clean.json", auditReport());
  const cleanResult = runNode("check-deps.mjs", ["--from-audit-json", cleanReportPath]);
  assert(cleanResult.status === 0, `check-deps should pass for a valid clean report: ${outputOf(cleanResult)}`);

  const vulnerableReportPath = await writeAuditReport(
    "audit-vulnerable.json",
    auditReport(
      { ...cleanCounts, high: 1 },
      {
        "1": {
          module_name: "example-package",
          severity: "high",
          github_advisory_id: "GHSA-example",
        },
      },
    ),
  );

  const vulnerableResult = runNode("check-deps.mjs", ["--from-audit-json", vulnerableReportPath]);
  assert(vulnerableResult.status === 1, "check-deps should fail for high severity vulnerabilities");
  assert(outputOf(vulnerableResult).includes("example-package"), "check-deps failure should include advisory summary");

  const criticalReportPath = await writeAuditReport(
    "audit-critical.json",
    auditReport({ ...cleanCounts, critical: 1 }),
  );
  const criticalResult = runNode("check-deps.mjs", ["--from-audit-json", criticalReportPath]);
  assert(criticalResult.status === 1, "check-deps should fail for critical severity vulnerabilities");

  const invalidReports = [
    ["audit-empty.json", {}],
    ["audit-error-only.json", { error: "audit unavailable" }],
    ["audit-metadata-missing.json", { advisories: {} }],
    ["audit-vulnerabilities-missing.json", { advisories: {}, metadata: {} }],
    ["audit-vulnerabilities-array.json", { advisories: {}, metadata: { vulnerabilities: [] } }],
    ["audit-string-count.json", auditReport({ ...cleanCounts, moderate: "0" })],
    ["audit-negative-count.json", auditReport({ ...cleanCounts, low: -1 })],
    ["audit-missing-count.json", auditReport({ info: 0, low: 0, moderate: 0, high: 0 })],
    ["audit-fractional-count.json", auditReport({ ...cleanCounts, info: 0.5 })],
    ["audit-unsafe-count.json", auditReport({ ...cleanCounts, critical: Number.MAX_SAFE_INTEGER + 1 })],
  ];
  for (const [name, report] of invalidReports) {
    const reportPath = await writeAuditReport(name, report);
    const result = runNode("check-deps.mjs", ["--from-audit-json", reportPath]);
    assert(result.status === 1, `check-deps should fail closed for invalid report ${name}`);
  }

  const registryErrorPath = path.join(root, "registry-error.txt");
  await writeText(registryErrorPath, "ERR_PNPM_META_FETCH_FAIL registry timeout\n");
  const registryResult = runNode("check-deps.mjs", ["--from-audit-error", registryErrorPath]);
  assert(registryResult.status === 0, "check-deps should warn-only for registry/network outages");
  assert(outputOf(registryResult).includes("non-blocking"), "registry outage should be reported as non-blocking");

  const genericErrorPath = path.join(root, "generic-error.txt");
  await writeText(genericErrorPath, "registry network socket timeout while validating policy\n");
  const genericErrorResult = runNode("check-deps.mjs", ["--from-audit-error", genericErrorPath]);
  assert(genericErrorResult.status === 1, "check-deps should not treat generic network-like words as an outage");

  const fakeBin = path.join(root, "bin");
  const fakePnpmPath = path.join(fakeBin, "pnpm");
  await writeText(fakePnpmPath, `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify(auditReport())}'\nexit 23\n`);
  await chmod(fakePnpmPath, 0o755);
  const parseableNonzeroResult = runNode("check-deps.mjs", [], {
    env: { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}` },
  });
  assert(
    parseableNonzeroResult.status === 1,
    "check-deps should fail when pnpm returns parseable clean JSON with a nonzero status",
  );
  assert(
    outputOf(parseableNonzeroResult).includes("nonzero exit status"),
    "parseable nonzero failure should explain that the audit command failed",
  );
}

async function testSbomGenerationFixture() {
  const root = path.join(tempRoot, "sbom");
  const internalPath = path.join(root, "packages", "internal");
  const validFixture = () => [
    {
      name: "fixture-root",
      version: "0.0.0",
      path: root,
      private: true,
      dependencies: {
        "left-pad": {
          from: "left-pad",
          version: "0.0.0",
          resolved: "https://registry.example.invalid/left-pad.tgz",
          path: path.join(root, "node_modules", "left-pad"),
          deduped: true,
        },
        "spaced-version": {
          version: " 1.2.3 ",
          path: path.join(root, "node_modules", "spaced-version"),
        },
      },
      devDependencies: {
        "@fixture/internal": {
          version: "link:display-only-suffix-not-used-for-resolution",
          path: internalPath,
        },
      },
      unsavedDependencies: "malformed but explicitly ignored",
    },
    {
      name: "@fixture/internal",
      version: "0.0.0",
      path: internalPath,
      optionalDependencies: {
        "left-pad": {
          version: "0.0.0",
          path: path.join(root, "node_modules", "left-pad"),
        },
      },
    },
  ];
  const mutateFixture = (mutate) => {
    const fixture = validFixture();
    mutate(fixture);
    return fixture;
  };
  const listJsonPath = path.join(root, "pnpm-list.json");
  const outputPath = path.join(root, "sbom.json");
  await writeText(listJsonPath, JSON.stringify(validFixture(), null, 2));

  const result = runNode("check-sbom.mjs", ["--from-list-json", listJsonPath, "--output", outputPath]);
  assert(result.status === 0, `check-sbom should pass for a valid pnpm list fixture: ${outputOf(result)}`);
  const sbom = JSON.parse(await readFile(outputPath, "utf8"));
  assert(sbom.bomFormat === "CycloneDX", "check-sbom should emit CycloneDX metadata");
  assert(sbom.components.length === 4, "check-sbom should deduplicate repeated name/version components");
  assert(
    sbom.components.filter((component) => component.name === "left-pad" && component.version === "0.0.0").length === 1,
    "check-sbom should allow and deduplicate an explicitly declared dependency version 0.0.0",
  );
  assert(
    sbom.components.some((component) => component.name === "fixture-root" && component.version === "0.0.0"),
    "check-sbom should allow an explicitly declared root version 0.0.0",
  );
  assert(
    sbom.components.some(
      (component) => component.name === "@fixture/internal" && component.version === "0.0.0" && component.type === "application",
    ),
    "check-sbom should use canonical node.path despite a non-authoritative link suffix and retain workspace application type",
  );
  assert(
    sbom.components.some((component) => component.name === "spaced-version" && component.version === " 1.2.3 "),
    "check-sbom should preserve a non-blank version without trim normalization",
  );

  const reversedListJsonPath = path.join(root, "pnpm-list-reversed.json");
  const reversedOutputPath = path.join(root, "sbom-reversed.json");
  await writeText(reversedListJsonPath, JSON.stringify(validFixture().reverse(), null, 2));
  const reversedResult = runNode("check-sbom.mjs", [
    "--from-list-json",
    reversedListJsonPath,
    "--output",
    reversedOutputPath,
  ]);
  assert(reversedResult.status === 0, `check-sbom should pass with reversed workspace root order: ${outputOf(reversedResult)}`);
  const reversedSbom = JSON.parse(await readFile(reversedOutputPath, "utf8"));
  assert(
    reversedSbom.components.some(
      (component) => component.name === "@fixture/internal" && component.version === "0.0.0" && component.type === "application",
    ),
    "check-sbom workspace component type should remain application regardless of root traversal order",
  );

  const invalidCases = [
    ["null-root", () => [null]],
    ["array-root", () => [[]]],
    ["missing-root-name", () => mutateFixture((fixture) => delete fixture[0].name)],
    ["blank-root-name", () => mutateFixture((fixture) => (fixture[0].name = "   "))],
    ["scoped-name-missing-package", () => mutateFixture((fixture) => (fixture[0].name = "@fixture"))],
    ["scoped-name-missing-scope", () => mutateFixture((fixture) => (fixture[0].name = "@/root"))],
    ["scoped-name-empty-package", () => mutateFixture((fixture) => (fixture[0].name = "@fixture/   "))],
    ["scoped-name-extra-slash", () => mutateFixture((fixture) => (fixture[0].name = "@fixture/root/extra"))],
    ["unscoped-name-slash", () => mutateFixture((fixture) => (fixture[0].name = "fixture/root"))],
    ["unscoped-name-at", () => mutateFixture((fixture) => (fixture[0].name = "fixture@root"))],
    ["unscoped-name-whitespace", () => mutateFixture((fixture) => (fixture[0].name = "fixture root"))],
    ["scoped-name-inner-at", () => mutateFixture((fixture) => (fixture[0].name = "@fixture/ro@ot"))],
    ["scoped-name-whitespace", () => mutateFixture((fixture) => (fixture[0].name = "@fixture scope/root"))],
    ["missing-root-version", () => mutateFixture((fixture) => delete fixture[0].version)],
    ["blank-root-version", () => mutateFixture((fixture) => (fixture[0].version = "   "))],
    ["missing-root-path", () => mutateFixture((fixture) => delete fixture[0].path)],
    ["blank-root-path", () => mutateFixture((fixture) => (fixture[0].path = "   "))],
    ["relative-root-path", () => mutateFixture((fixture) => (fixture[0].path = "relative/root"))],
    ["null-dependency-container", () => mutateFixture((fixture) => (fixture[0].dependencies = null))],
    ["array-dependency-container", () => mutateFixture((fixture) => (fixture[0].dependencies = []))],
    ["string-dependency-container", () => mutateFixture((fixture) => (fixture[0].dependencies = "invalid"))],
    [
      "null-dependency-node",
      () => mutateFixture((fixture) => (fixture[0].dependencies["left-pad"] = null)),
    ],
    [
      "array-dependency-node",
      () => mutateFixture((fixture) => (fixture[0].dependencies["left-pad"] = [])),
    ],
    [
      "string-dependency-node",
      () => mutateFixture((fixture) => (fixture[0].dependencies["left-pad"] = "invalid")),
    ],
    [
      "blank-dependency-name",
      () =>
        mutateFixture((fixture) => {
          fixture[0].dependencies["   "] = fixture[0].dependencies["left-pad"];
          delete fixture[0].dependencies["left-pad"];
        }),
    ],
    [
      "missing-dependency-version",
      () => mutateFixture((fixture) => delete fixture[0].dependencies["left-pad"].version),
    ],
    [
      "blank-dependency-version",
      () => mutateFixture((fixture) => (fixture[0].dependencies["left-pad"].version = "   ")),
    ],
    [
      "missing-dependency-path",
      () => mutateFixture((fixture) => delete fixture[0].dependencies["left-pad"].path),
    ],
    [
      "blank-dependency-path",
      () => mutateFixture((fixture) => (fixture[0].dependencies["left-pad"].path = "   ")),
    ],
    [
      "empty-link-suffix",
      () => mutateFixture((fixture) => (fixture[0].devDependencies["@fixture/internal"].version = "link:   ")),
    ],
    [
      "unresolved-link-target",
      () =>
        mutateFixture(
          (fixture) => (fixture[0].devDependencies["@fixture/internal"].path = path.join(root, "packages", "unknown")),
        ),
    ],
    [
      "pathless-link",
      () => mutateFixture((fixture) => delete fixture[0].devDependencies["@fixture/internal"].path),
    ],
    [
      "relative-link-path",
      () => mutateFixture((fixture) => (fixture[0].devDependencies["@fixture/internal"].path = "packages/internal")),
    ],
    [
      "link-target-name-mismatch",
      () =>
        mutateFixture((fixture) => {
          fixture[0].devDependencies["@fixture/wrong-name"] = fixture[0].devDependencies["@fixture/internal"];
          delete fixture[0].devDependencies["@fixture/internal"];
        }),
    ],
    ["link-target-link-version", () => mutateFixture((fixture) => (fixture[1].version = "link:other"))],
    [
      "workspace-external-identity-conflict",
      () =>
        mutateFixture((fixture) => {
          fixture[0].devDependencies["@fixture/internal"] = {
            version: "0.0.0",
            path: path.join(root, "node_modules", "workspace-impersonator"),
          };
        }),
    ],
    [
      "duplicate-workspace-path",
      () =>
        mutateFixture((fixture) =>
          fixture.push({ name: "@fixture/duplicate-path", version: "1.0.0", path: internalPath }),
        ),
    ],
    [
      "workspace-name-conflict",
      () =>
        mutateFixture((fixture) =>
          fixture.push({
            name: "@fixture/internal",
            version: "2.0.0",
            path: path.join(root, "packages", "conflicting-internal"),
          }),
        ),
    ],
    [
      "nested-malformed-container",
      () => mutateFixture((fixture) => (fixture[0].dependencies["left-pad"].dependencies = [])),
    ],
    [
      "nested-malformed-node",
      () =>
        mutateFixture(
          (fixture) => (fixture[0].dependencies["left-pad"].dependencies = { nested: { version: "1.0.0" } }),
        ),
    ],
  ];

  const outputSentinel = "existing-output-must-remain-unchanged\n";
  for (const [name, fixtureFactory] of invalidCases) {
    const invalidListPath = path.join(root, `${name}.json`);
    const invalidOutputPath = path.join(root, `${name}-sbom.json`);
    await writeText(invalidListPath, JSON.stringify(fixtureFactory(), null, 2));
    await writeText(invalidOutputPath, outputSentinel);
    const invalidResult = runNode("check-sbom.mjs", [
      "--from-list-json",
      invalidListPath,
      "--output",
      invalidOutputPath,
    ]);
    assert(invalidResult.status === 1, `check-sbom should fail closed for ${name}`);
    assert(
      (await readFile(invalidOutputPath, "utf8")) === outputSentinel,
      `check-sbom should not overwrite output before full validation for ${name}`,
    );
  }

  const absentOutputPath = path.join(root, "invalid-output-must-not-exist.json");
  const absentOutputListPath = path.join(root, "invalid-output-list.json");
  await writeText(absentOutputListPath, JSON.stringify([{ name: "invalid", path: root }], null, 2));
  const absentOutputResult = runNode("check-sbom.mjs", [
    "--from-list-json",
    absentOutputListPath,
    "--output",
    absentOutputPath,
  ]);
  assert(absentOutputResult.status === 1, "check-sbom should reject invalid input before creating output");
  assert(!existsSync(absentOutputPath), "check-sbom should not create output before full validation");

  const publishFailureTarget = path.join(root, "publish-failure-target");
  const publishFailureSentinelPath = path.join(publishFailureTarget, "sentinel.txt");
  await writeText(publishFailureSentinelPath, "publish-target-sentinel\n");
  const publishFailureResult = runNode("check-sbom.mjs", [
    "--from-list-json",
    listJsonPath,
    "--output",
    publishFailureTarget,
  ]);
  assert(publishFailureResult.status === 1, "check-sbom should fail when atomic output publication cannot rename");
  assert(
    (await readFile(publishFailureSentinelPath, "utf8")) === "publish-target-sentinel\n",
    "check-sbom atomic publish failure should preserve the prior target contents",
  );
  assert(
    (await readdir(root)).every((entry) => !entry.startsWith(".yrese-sbom-")),
    "check-sbom atomic publish failure should remove its temporary artifact",
  );

  const leakVersion = "link:LEAK_VERSION_SENTINEL";
  const leakPath = path.join(root, "LEAK_PATH_SENTINEL");
  const leakResolved = "https://LEAK_RESOLVED_SENTINEL.invalid/package.tgz";
  const nonLeakFixture = mutateFixture((fixture) => {
    fixture[0].devDependencies["@fixture/internal"] = {
      version: leakVersion,
      path: leakPath,
      resolved: leakResolved,
    };
  });
  const nonLeakListPath = path.join(root, "non-leak.json");
  await writeText(nonLeakListPath, JSON.stringify(nonLeakFixture, null, 2));
  const nonLeakResult = runNode("check-sbom.mjs", ["--from-list-json", nonLeakListPath]);
  const nonLeakOutput = outputOf(nonLeakResult);
  assert(nonLeakResult.status === 1, "check-sbom should reject a workspace link with an unknown target");
  for (const sentinel of [leakVersion, leakPath, leakResolved]) {
    assert(!nonLeakOutput.includes(sentinel), "check-sbom errors must not expose raw version, link, path, or resolved URL values");
  }

  const invalidName = "INVALID_NAME_SENTINEL/extra";
  const invalidNameFixture = mutateFixture((fixture) => {
    fixture[0].name = invalidName;
  });
  const invalidNameListPath = path.join(root, "non-leak-name.json");
  await writeText(invalidNameListPath, JSON.stringify(invalidNameFixture, null, 2));
  const invalidNameResult = runNode("check-sbom.mjs", ["--from-list-json", invalidNameListPath]);
  assert(invalidNameResult.status === 1, "check-sbom should reject structurally invalid package names");
  assert(!outputOf(invalidNameResult).includes(invalidName), "check-sbom errors must not expose raw invalid package names");

  const boundaryCollisionName = "foo@1";
  const boundaryCollisionFixture = [
    { name: boundaryCollisionName, version: "2", path: path.join(root, "collision-one") },
    { name: "foo", version: "1@2", path: path.join(root, "collision-two") },
  ];
  const boundaryCollisionListPath = path.join(root, "bom-ref-boundary-collision.json");
  const boundaryCollisionOutputPath = path.join(root, "bom-ref-boundary-collision-sbom.json");
  await writeText(boundaryCollisionListPath, JSON.stringify(boundaryCollisionFixture, null, 2));
  await writeText(boundaryCollisionOutputPath, outputSentinel);
  const boundaryCollisionResult = runNode("check-sbom.mjs", [
    "--from-list-json",
    boundaryCollisionListPath,
    "--output",
    boundaryCollisionOutputPath,
  ]);
  assert(boundaryCollisionResult.status === 1, "check-sbom should reject package names that can cross bom-ref boundaries");
  assert(
    (await readFile(boundaryCollisionOutputPath, "utf8")) === outputSentinel,
    "check-sbom bom-ref boundary rejection should preserve the prior output",
  );
  assert(
    !outputOf(boundaryCollisionResult).includes(boundaryCollisionName),
    "check-sbom bom-ref boundary errors must not expose the raw invalid package name",
  );
}

async function testSsotIndexCleanFixturePasses() {
  const root = path.join(tempRoot, "ssot-index-pass");
  await writeText(path.join(root, "docs", "architecture", "system_context.md"), ssotDoc("ARC-001", "APPROVED"));
  await writeText(path.join(root, "docs", "product", "mvp_scope.md"), ssotDoc("PRD-001", "APPROVED"));
  await writeText(path.join(root, "docs", "product", "non_mvp_scope.md"), ssotDoc("PRD-002", "PROPOSED"));
  await writeText(path.join(root, "docs", "api", "openapi.yaml"), "openapi: 3.1.0\n");
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

async function testSsotIndexPreservesZeroRowSemanticDiagnostics() {
  const root = path.join(tempRoot, "ssot-index-zero-rows");
  await writeText(path.join(root, "docs", "product", "mvp_scope.md"), ssotDoc("PRD-001", "APPROVED"));
  await writeText(path.join(root, "docs", "ssot_index.md"), ssotIndex([]));

  const result = runNode("check-ssot-index.mjs", [root]);
  const output = outputOf(result);
  assert(result.status === 1, "check-ssot-index should reject an index with zero recognized rows");
  assert(output.includes("missing from docs/ssot_index.md"), "zero-row index should preserve missing-row diagnostics");
  assert(output.includes("regenerate the SSOT index"), "zero-row index should preserve regeneration guidance");
  assert(
    !output.includes("could not validate the protected documentation scope"),
    "zero-row semantic drift should not be misclassified as a protected-scope failure",
  );
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

async function testSsotIndexInvalidScopesFailClosed() {
  const fixedMessage = "SSOT index check could not validate the protected documentation scope.";
  const externalMarker = "DO_NOT_ECHO_EXTERNAL_SSOT_TARGET";
  const externalDirectory = path.join(tempRoot, "ssot-index-external-directory");

  async function createValidFixture(root) {
    await writeText(path.join(root, "docs", "product", "mvp_scope.md"), ssotDoc("PRD-001", "APPROVED"));
    await writeText(
      path.join(root, "docs", "ssot_index.md"),
      ssotIndex([{ ssotId: "PRD-001", linkPath: "product/mvp_scope.md", status: "APPROVED" }]),
    );
  }

  async function assertScopeFailure(label, root) {
    const result = runNode("check-ssot-index.mjs", [root]);
    const output = outputOf(result);
    assert(result.status === 1, `check-ssot-index should reject ${label}`);
    assert(output.includes(fixedMessage), `check-ssot-index ${label} should use the fixed scope error`);
    assert(!output.includes("SSOT index check passed"), `check-ssot-index ${label} should not report PASS`);
    assert(!output.includes(root), `check-ssot-index ${label} should not expose the supplied root path`);
    assert(!output.includes(externalDirectory), `check-ssot-index ${label} should not expose an external target path`);
    assert(!output.includes(externalMarker), `check-ssot-index ${label} should not expose external target content`);
  }

  await assertScopeFailure("a missing root", path.join(tempRoot, "ssot-index-missing-root"));

  const rootFile = path.join(tempRoot, "ssot-index-root-file");
  await writeText(rootFile, "not a directory\n");
  await assertScopeFailure("a root that is not a directory", rootFile);

  const missingDocs = path.join(tempRoot, "ssot-index-missing-docs");
  await mkdir(missingDocs, { recursive: true });
  await assertScopeFailure("a missing docs directory", missingDocs);

  const docsFile = path.join(tempRoot, "ssot-index-docs-file");
  await writeText(path.join(docsFile, "docs"), "not a directory\n");
  await assertScopeFailure("docs that is not a directory", docsFile);

  const missingIndex = path.join(tempRoot, "ssot-index-missing-index");
  await writeText(path.join(missingIndex, "docs", "product", "mvp_scope.md"), ssotDoc("PRD-001", "APPROVED"));
  await assertScopeFailure("a missing index", missingIndex);

  const indexDirectory = path.join(tempRoot, "ssot-index-index-directory");
  await writeText(path.join(indexDirectory, "docs", "product", "mvp_scope.md"), ssotDoc("PRD-001", "APPROVED"));
  await mkdir(path.join(indexDirectory, "docs", "ssot_index.md"), { recursive: true });
  await assertScopeFailure("an index that is not a regular file", indexDirectory);

  const indexOnly = path.join(tempRoot, "ssot-index-index-only");
  await writeText(path.join(indexOnly, "docs", "ssot_index.md"), ssotIndex([]));
  await assertScopeFailure("an index-only corpus", indexOnly);

  const excludedOnly = path.join(tempRoot, "ssot-index-excluded-only");
  await writeText(path.join(excludedOnly, "docs", "research", "notes.md"), "# Non-SSOT research\n");
  await writeText(path.join(excludedOnly, "docs", "ssot_index.md"), ssotIndex([]));
  await assertScopeFailure("a corpus with only excluded documents", excludedOnly);

  await writeText(path.join(externalDirectory, "target.md"), externalMarker);

  const rootSymlink = path.join(tempRoot, "ssot-index-root-symlink");
  await symlink(externalDirectory, rootSymlink, "dir");
  await assertScopeFailure("a symlinked root", rootSymlink);

  const docsSymlink = path.join(tempRoot, "ssot-index-docs-symlink");
  await mkdir(docsSymlink, { recursive: true });
  await symlink(externalDirectory, path.join(docsSymlink, "docs"), "dir");
  await assertScopeFailure("a symlinked docs directory", docsSymlink);

  const indexSymlink = path.join(tempRoot, "ssot-index-index-symlink");
  await writeText(path.join(indexSymlink, "docs", "product", "mvp_scope.md"), ssotDoc("PRD-001", "APPROVED"));
  await symlink(path.join(externalDirectory, "target.md"), path.join(indexSymlink, "docs", "ssot_index.md"), "file");
  await assertScopeFailure("a symlinked index", indexSymlink);

  const nestedFileSymlink = path.join(tempRoot, "ssot-index-nested-file-symlink");
  await createValidFixture(nestedFileSymlink);
  await symlink(
    path.join(externalDirectory, "target.md"),
    path.join(nestedFileSymlink, "docs", "product", "linked.md"),
    "file",
  );
  await assertScopeFailure("a nested file symlink", nestedFileSymlink);

  const excludedDirectorySymlink = path.join(tempRoot, "ssot-index-excluded-directory-symlink");
  await createValidFixture(excludedDirectorySymlink);
  await mkdir(path.join(excludedDirectorySymlink, "docs", "research"), { recursive: true });
  await symlink(externalDirectory, path.join(excludedDirectorySymlink, "docs", "research", "linked"), "dir");
  await assertScopeFailure("a directory symlink in an excluded subtree", excludedDirectorySymlink);
}

async function testOpenApiDriftDetection() {
  const root = path.join(tempRoot, "openapi-drift");
  const driftPath = path.join(root, "openapi.yaml");
  await writeText(driftPath, "# deliberately stale generated artifact\n");

  const result = runTsx("check-openapi.mjs", ["--openapi-file", driftPath]);
  const output = outputOf(result);
  assert(result.status === 1, "check-openapi should fail when the generated OpenAPI artifact drifts");
  assert(output.includes("GENERATED_CODE_DRIFT_BLOCKED"), "OpenAPI drift failure should use the blocker code");
  assert(output.includes("Run `pnpm generate:openapi`"), "OpenAPI drift failure should preserve regeneration guidance");
  assert(
    !output.includes("artifact target must be a readable real regular file"),
    "regular OpenAPI drift should not be misclassified as an artifact target failure",
  );
}

async function testOpenApiArtifactTargetFailsClosed() {
  const fixedMessage =
    "GENERATED_CODE_DRIFT_BLOCKED: OpenAPI generated artifact target must be a readable real regular file.";
  const expectedSource = await readFile(path.join(repoRoot, "docs", "api", "openapi.yaml"), "utf8");
  const externalRoot = path.join(tempRoot, "openapi-check-external");
  const externalCoherentPath = path.join(externalRoot, "coherent.yaml");
  const externalMarkerPath = path.join(externalRoot, "marker.yaml");
  const externalMarker = "DO_NOT_ECHO_OPENAPI_TARGET_CONTENT";
  await writeText(externalCoherentPath, expectedSource);
  await writeText(externalMarkerPath, externalMarker);

  function assertScopeFailure(label, artifactPath, options = {}) {
    const result = runTsx("check-openapi.mjs", ["--openapi-file", artifactPath], options);
    const output = outputOf(result);
    assert(result.error?.code !== "ETIMEDOUT", `check-openapi ${label} should not time out`);
    assert(result.status === 1, `check-openapi should reject ${label}`);
    assert(output.includes(fixedMessage), `check-openapi ${label} should use the fixed target error`);
    assert(!output.includes("OpenAPI drift check passed"), `check-openapi ${label} should not report PASS`);
    assert(!output.includes(artifactPath), `check-openapi ${label} should not expose the supplied path`);
    assert(!output.includes(externalRoot), `check-openapi ${label} should not expose an external target path`);
    assert(!output.includes(externalMarker), `check-openapi ${label} should not expose external target content`);
  }

  const matchingPath = path.join(tempRoot, "openapi-check-matching", "openapi.yaml");
  await writeText(matchingPath, expectedSource);
  const matchingResult = runTsx("check-openapi.mjs", ["--openapi-file", matchingPath]);
  assert(matchingResult.status === 0, `check-openapi should pass a matching real file: ${outputOf(matchingResult)}`);
  assert(outputOf(matchingResult).includes("OpenAPI drift check passed"), "matching real file should report PASS");

  assertScopeFailure("a missing artifact", path.join(tempRoot, "openapi-check-missing", "openapi.yaml"));

  const directoryPath = path.join(tempRoot, "openapi-check-directory", "openapi.yaml");
  await mkdir(directoryPath, { recursive: true });
  assertScopeFailure("a directory artifact", directoryPath);

  const coherentSymlinkPath = path.join(tempRoot, "openapi-check-coherent-symlink", "openapi.yaml");
  await mkdir(path.dirname(coherentSymlinkPath), { recursive: true });
  await symlink(externalCoherentPath, coherentSymlinkPath, "file");
  assertScopeFailure("a coherent symlink artifact", coherentSymlinkPath);

  const markerSymlinkPath = path.join(tempRoot, "openapi-check-marker-symlink", "openapi.yaml");
  await mkdir(path.dirname(markerSymlinkPath), { recursive: true });
  await symlink(externalMarkerPath, markerSymlinkPath, "file");
  assertScopeFailure("a marker symlink artifact", markerSymlinkPath);

  const danglingSymlinkPath = path.join(tempRoot, "openapi-check-dangling-symlink", "openapi.yaml");
  await mkdir(path.dirname(danglingSymlinkPath), { recursive: true });
  await symlink(path.join(externalRoot, "missing.yaml"), danglingSymlinkPath, "file");
  assertScopeFailure("a dangling symlink artifact", danglingSymlinkPath);

  const fifoPath = path.join(tempRoot, "openapi-check-fifo", "openapi.yaml");
  await mkdir(path.dirname(fifoPath), { recursive: true });
  const fifoResult = spawnSync("mkfifo", [fifoPath], { encoding: "utf8" });
  assert(fifoResult.status === 0, "script harness requires mkfifo on the supported macOS/Linux runtime");
  if (fifoResult.status === 0) {
    assertScopeFailure("a FIFO artifact", fifoPath, { timeout: 5_000 });
  }
}

async function testOpenApiGenerationPublishesAtomically() {
  const root = path.join(tempRoot, "openapi-generation");
  const expectedSource = await readFile(path.join(repoRoot, "docs", "api", "openapi.yaml"), "utf8");
  const temporaryPrefix = ".yrese-openapi-";

  async function assertNoTemporaryArtifacts(directory, label) {
    const entries = await readdir(directory);
    assert(
      entries.every((entry) => !entry.startsWith(temporaryPrefix)),
      `generate-openapi ${label} should not leave a temporary artifact`,
    );
  }

  const absentOutput = path.join(root, "absent", "nested", "openapi.yaml");
  const absentResult = runTsx("generate-openapi.mjs", ["--output", absentOutput]);
  assert(absentResult.status === 0, `generate-openapi should create an absent nested output: ${outputOf(absentResult)}`);
  assert((await readFile(absentOutput, "utf8")) === expectedSource, "absent output should contain exact generated bytes");
  assert((await lstat(absentOutput)).isFile(), "absent output should be published as a regular file");
  await assertNoTemporaryArtifacts(path.dirname(absentOutput), "absent-output success");

  const regularOutput = path.join(root, "regular", "openapi.yaml");
  await writeText(regularOutput, "REGULAR_OUTPUT_SENTINEL\n");
  const regularResult = runTsx("generate-openapi.mjs", ["--output", regularOutput]);
  assert(regularResult.status === 0, `generate-openapi should replace a regular output: ${outputOf(regularResult)}`);
  assert((await readFile(regularOutput, "utf8")) === expectedSource, "regular output should be atomically replaced");
  assert(((await lstat(regularOutput)).mode & 0o111) === 0, "generated output should not be executable");
  const regularCheck = runTsx("check-openapi.mjs", ["--openapi-file", regularOutput]);
  assert(regularCheck.status === 0, "atomically replaced regular output should pass the OpenAPI drift checker");
  await assertNoTemporaryArtifacts(path.dirname(regularOutput), "regular-output success");

  const symlinkDirectory = path.join(root, "symlink");
  const symlinkTarget = path.join(root, "external-target.yaml");
  const symlinkOutput = path.join(symlinkDirectory, "openapi.yaml");
  const externalSentinel = "EXTERNAL_TARGET_SENTINEL\n";
  await writeText(symlinkTarget, externalSentinel);
  await mkdir(symlinkDirectory, { recursive: true });
  await symlink(symlinkTarget, symlinkOutput, "file");
  const symlinkResult = runTsx("generate-openapi.mjs", ["--output", symlinkOutput]);
  assert(symlinkResult.status === 0, `generate-openapi should replace a final symlink safely: ${outputOf(symlinkResult)}`);
  assert((await readFile(symlinkTarget, "utf8")) === externalSentinel, "generation must preserve symlink target bytes");
  const symlinkOutputStats = await lstat(symlinkOutput);
  assert(symlinkOutputStats.isFile() && !symlinkOutputStats.isSymbolicLink(), "output symlink should become a regular file");
  assert((await readFile(symlinkOutput, "utf8")) === expectedSource, "replaced symlink path should contain generated bytes");
  await assertNoTemporaryArtifacts(symlinkDirectory, "symlink-output success");

  const failureDirectory = path.join(root, "publish-failure", "openapi.yaml");
  const failureSentinelPath = path.join(failureDirectory, "sentinel.txt");
  const failureSentinel = "PUBLISH_FAILURE_SENTINEL\n";
  await writeText(failureSentinelPath, failureSentinel);
  const failureResult = runTsx("generate-openapi.mjs", ["--output", failureDirectory]);
  const failureOutput = outputOf(failureResult);
  assert(failureResult.status === 1, "generate-openapi should fail when publication cannot replace a directory");
  assert(
    failureOutput.includes("OpenAPI generation could not publish the generated artifact."),
    "publication failure should use the fixed error",
  );
  assert(!failureOutput.includes("Generated OpenAPI document"), "publication failure should not report success");
  assert(!failureOutput.includes(failureDirectory), "publication failure should not expose the output path");
  assert(!failureOutput.includes(failureSentinel), "publication failure should not expose target content");
  assert((await readFile(failureSentinelPath, "utf8")) === failureSentinel, "publication failure should preserve target content");
  await assertNoTemporaryArtifacts(path.dirname(failureDirectory), "publication failure");
}

try {
  await testBoundaryViolationDetection();
  await testBoundaryCleanFixturePasses();
  await testPureCoreRejectsAwsAndDynamoDbImports();
  await testPureCoreRejectsAwsAndDynamoDbImportsThroughNonStaticForms();
  await testAppAwsImportDoesNotTripPureCoreRule();
  await testDuplicateRegistryConstDetection();
  await testDuplicateContractAndKernelConstDetectionAcrossApps();
  await testBoundaryScopeValidationFailsClosed();
  await testCalculationPurityCleanFixturePasses();
  await testCalculationPurityViolationDetection();
  await testCalculationPurityInvalidScopesFailClosed();
  await testSecretAllowlistAndDetection();
  await testCleanRemovesGeneratedArtifacts();
  await testDependencyAuditWrapper();
  await testSbomGenerationFixture();
  await testSsotIndexCleanFixturePasses();
  await testSsotIndexDetectsMissingDocumentRow();
  await testSsotIndexPreservesZeroRowSemanticDiagnostics();
  await testSsotIndexDetectsStatusMismatch();
  await testSsotIndexDetectsDuplicateSsotId();
  await testSsotIndexInvalidScopesFailClosed();
  await testOpenApiDriftDetection();
  await testOpenApiArtifactTargetFailsClosed();
  await testOpenApiGenerationPublishesAtomically();
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
