#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "yrese-script-tests-"));
const failures = [];
const expectedPnpmVersion = "11.13.1";

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

function validateCiWorkflowTrustBoundary(workflowSource) {
  const findings = [];
  const check = (condition, message) => {
    if (!condition) findings.push(message);
  };
  const expectedActions = new Map([
    ["actions/checkout", { ref: "34e114876b0b11c390a56381ad16ebd13914f8d5", version: "v4.3.1" }],
    ["pnpm/action-setup", { ref: "fc06bc1257f339d1d5d8b3a19a8cae5388b55320", version: "v4.4.0" }],
    ["actions/setup-node", { ref: "49933ea5288caeca8642d1e84afbd3f7d6820020", version: "v4.4.0" }],
  ]);
  const isRecord = (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  let workflow;
  try {
    const document = parseDocument(workflowSource, { uniqueKeys: true });
    check(document.errors.length === 0, "CI workflow should be valid YAML with unique keys");
    workflow = document.toJS();
  } catch {
    check(false, "CI workflow should be parseable as YAML");
  }
  if (!isRecord(workflow)) {
    check(false, "CI workflow root should be a mapping");
    return findings;
  }

  const permissions = workflow.permissions;
  check(
    isRecord(permissions) &&
      Object.keys(permissions).length === 1 &&
      permissions.contents === "read",
    "CI token permissions should be exactly contents: read",
  );

  const jobs = workflow.jobs;
  check(isRecord(jobs), "CI jobs should be a mapping");
  const actionUses = [];
  if (isRecord(jobs)) {
    for (const [jobName, job] of Object.entries(jobs)) {
      check(isRecord(job), `CI job ${jobName} should be a mapping`);
      if (!isRecord(job)) continue;
      check(!Object.hasOwn(job, "permissions"), `CI job ${jobName} should not override token permissions`);
      if (Object.hasOwn(job, "uses")) actionUses.push({ value: job.uses, step: job });
      if (Object.hasOwn(job, "steps")) {
        check(Array.isArray(job.steps), `CI job ${jobName} steps should be a sequence`);
        if (Array.isArray(job.steps)) {
          for (const step of job.steps) {
            if (isRecord(step) && Object.hasOwn(step, "uses")) actionUses.push({ value: step.uses, step });
          }
        }
      }
    }
  }

  check(actionUses.length === expectedActions.size, "CI should use only the three reviewed external actions");
  const seenActions = new Set();
  for (const use of actionUses) {
    check(typeof use.value === "string", "CI action reference should be a string");
    if (typeof use.value !== "string") continue;
    const separator = use.value.lastIndexOf("@");
    const action = use.value.slice(0, separator);
    const ref = separator >= 0 ? use.value.slice(separator + 1) : "";
    const expected = expectedActions.get(action);
    check(Boolean(expected), `CI action ${action} should be explicitly reviewed`);
    check(!seenActions.has(action), `CI action ${action} should occur exactly once`);
    seenActions.add(action);
    check(/^[0-9a-f]{40}$/.test(ref ?? ""), `CI action ${action} should use a full-length commit SHA`);
    check(ref === expected?.ref, `CI action ${action} should use its reviewed commit SHA`);
    const reviewedLine = expected
      ? new RegExp(
          `^[ \\t]*(?:-[ \\t]+)?uses:[ \\t]+${escapeRegex(`${action}@${expected.ref}`)}[ \\t]+#[ \\t]+${escapeRegex(expected.version)}[ \\t]*$`,
          "m",
        )
      : undefined;
    check(Boolean(reviewedLine?.test(workflowSource)), `CI action ${action} should retain its reviewed version comment`);
  }
  for (const action of expectedActions.keys()) {
    check(seenActions.has(action), `CI should retain reviewed action ${action}`);
  }

  const checkoutStep = actionUses.find((use) => use.value === `actions/checkout@${expectedActions.get("actions/checkout").ref}`)?.step;
  check(
    isRecord(checkoutStep?.with) && checkoutStep.with["persist-credentials"] === false,
    "CI checkout should not persist GitHub credentials",
  );
  return findings;
}

function validatePnpmToolchainAuthority(packageSource, workspaceSource, workflowSource) {
  const findings = [];
  const check = (condition, message) => {
    if (!condition) findings.push(message);
  };
  const isRecord = (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
  const parseMapping = (source, label) => {
    try {
      const document = parseDocument(source, { uniqueKeys: true });
      check(document.errors.length === 0, `${label} should be valid with unique keys`);
      const value = document.toJS();
      check(isRecord(value), `${label} root should be a mapping`);
      return isRecord(value) ? value : undefined;
    } catch {
      check(false, `${label} should be parseable`);
      return undefined;
    }
  };

  const manifest = parseMapping(packageSource, "package.json");
  const workspace = parseMapping(workspaceSource, "pnpm-workspace.yaml");
  const workflow = parseMapping(workflowSource, "CI workflow");

  check(
    isRecord(manifest?.engines) && manifest.engines.pnpm === expectedPnpmVersion,
    `engines.pnpm should be exactly ${expectedPnpmVersion}`,
  );
  check(
    manifest?.packageManager === `pnpm@${expectedPnpmVersion}`,
    `packageManager should be exactly pnpm@${expectedPnpmVersion}`,
  );
  check(workspace?.pmOnFail === "error", "pnpm version mismatch policy should be exactly pmOnFail: error");
  check(
    isRecord(workspace?.allowBuilds) &&
      Object.keys(workspace.allowBuilds).sort().join(",") === "esbuild,sharp" &&
      workspace.allowBuilds.esbuild === true &&
      workspace.allowBuilds.sharp === true,
    "pnpm build allow-list should remain exactly esbuild and sharp",
  );
  check(
    workspace?.dangerouslyAllowAllBuilds !== true,
    "pnpm should not allow all dependency build scripts",
  );
  check(
    workspace?.strictDepBuilds !== false,
    "pnpm should fail rather than warn for unreviewed dependency build scripts",
  );

  const setupSteps = [];
  if (isRecord(workflow?.jobs)) {
    for (const job of Object.values(workflow.jobs)) {
      if (!isRecord(job) || !Array.isArray(job.steps)) continue;
      for (const step of job.steps) {
        if (isRecord(step) && typeof step.uses === "string" && step.uses.startsWith("pnpm/action-setup@")) {
          setupSteps.push(step);
        }
      }
    }
  }
  check(setupSteps.length === 1, "CI should contain exactly one pnpm/action-setup step");
  check(
    setupSteps.length === 1 && isRecord(setupSteps[0].with) && setupSteps[0].with.version === expectedPnpmVersion,
    `CI pnpm/action-setup version should be exactly ${expectedPnpmVersion}`,
  );

  return findings;
}

async function testCiWorkflowTrustBoundary() {
  const workflowSource = await readFile(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
  for (const finding of validateCiWorkflowTrustBoundary(workflowSource)) {
    assert(false, finding);
  }

  const duplicateAction = workflowSource.replace(
    /pnpm\/action-setup@[0-9a-f]{40} # v4\.4\.0/,
    "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1",
  );
  assert(
    validateCiWorkflowTrustBoundary(duplicateAction).length > 0,
    "CI trust check should reject duplicate reviewed actions and a missing expected action",
  );

  const checkoutPinWithVersion =
    "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1";
  const relocatedVersionComment = `${workflowSource.replace(
    checkoutPinWithVersion,
    "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
  )}\n# ${checkoutPinWithVersion}\n`;
  assert(
    validateCiWorkflowTrustBoundary(relocatedVersionComment).length > 0,
    "CI trust check should reject version comments detached from their action line",
  );

  const mutableJobAction = workflowSource.replace(
    "jobs:\n",
    "jobs:\n  reused:\n    uses: example/reusable/.github/workflows/check.yml@v1\n",
  );
  assert(
    validateCiWorkflowTrustBoundary(mutableJobAction).length > 0,
    "CI trust check should reject mutable job-level reusable workflows",
  );

  const flowStyleAction = workflowSource.replace(
    "steps:\n",
    "steps:\n      - { uses: example/unreviewed-action@v1 }\n",
  );
  assert(
    validateCiWorkflowTrustBoundary(flowStyleAction).length > 0,
    "CI trust check should reject flow-style unreviewed actions",
  );

  const widenedJobPermission = workflowSource.replace(
    "jobs:\n",
    "jobs:\n  widened:\n    permissions:\n      contents: write\n",
  );
  assert(
    validateCiWorkflowTrustBoundary(widenedJobPermission).length > 0,
    "CI trust check should reject job-level permission overrides",
  );

  const scalarJobPermission = workflowSource.replace(
    "jobs:\n",
    "jobs:\n  widened-scalar:\n    permissions: write-all\n",
  );
  assert(
    validateCiWorkflowTrustBoundary(scalarJobPermission).length > 0,
    "CI trust check should reject scalar job-level permissions",
  );

  const flowJobPermission = workflowSource.replace(
    "jobs:\n",
    "jobs:\n  widened-flow: { permissions: write-all, runs-on: ubuntu-latest, steps: [{ run: 'echo ok' }] }\n",
  );
  assert(
    validateCiWorkflowTrustBoundary(flowJobPermission).length > 0,
    "CI trust check should reject flow-style job-level permissions",
  );
}

async function testPnpmToolchainAuthority() {
  const packageSource = await readFile(path.join(repoRoot, "package.json"), "utf8");
  const workspaceSource = await readFile(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");
  const workflowSource = await readFile(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
  for (const finding of validatePnpmToolchainAuthority(packageSource, workspaceSource, workflowSource)) {
    assert(false, finding);
  }

  const permissiveEngine = packageSource.replace('"pnpm": "11.13.1"', '"pnpm": ">=11"');
  assert(
    validatePnpmToolchainAuthority(permissiveEngine, workspaceSource, workflowSource).length > 0,
    "pnpm toolchain check should reject a permissive engine range",
  );

  const mismatchedPackageManager = packageSource.replace("pnpm@11.13.1", "pnpm@11.13.0");
  assert(
    validatePnpmToolchainAuthority(mismatchedPackageManager, workspaceSource, workflowSource).length > 0,
    "pnpm toolchain check should reject a mismatched packageManager pin",
  );

  const missingMismatchPolicy = workspaceSource.replace("pmOnFail: error\n", "");
  assert(
    validatePnpmToolchainAuthority(packageSource, missingMismatchPolicy, workflowSource).length > 0,
    "pnpm toolchain check should reject a missing mismatch policy",
  );

  const nonFailingMismatchPolicy = workspaceSource.replace("pmOnFail: error", "pmOnFail: warn");
  assert(
    validatePnpmToolchainAuthority(packageSource, nonFailingMismatchPolicy, workflowSource).length > 0,
    "pnpm toolchain check should reject a non-failing mismatch policy",
  );

  const widenedBuildAllowList = workspaceSource.replace(
    "  sharp: true\n",
    "  sharp: true\n  unreviewed-build: true\n",
  );
  assert(
    validatePnpmToolchainAuthority(packageSource, widenedBuildAllowList, workflowSource).length > 0,
    "pnpm toolchain check should reject a widened build allow-list",
  );

  for (const [label, weakening] of [
    ["allow-all dependency builds", "dangerouslyAllowAllBuilds: true\n"],
    ["non-strict dependency builds", "strictDepBuilds: false\n"],
  ]) {
    assert(
      validatePnpmToolchainAuthority(packageSource, `${workspaceSource}${weakening}`, workflowSource).length > 0,
      `pnpm toolchain check should reject ${label}`,
    );
  }

  const mismatchedCiVersion = workflowSource.replace("version: 11.13.1", "version: 11.13.0");
  assert(
    validatePnpmToolchainAuthority(packageSource, workspaceSource, mismatchedCiVersion).length > 0,
    "pnpm toolchain check should reject a mismatched CI setup version",
  );

  const coordinatedPackageDrift = packageSource
    .replace('"pnpm": "11.13.1"', '"pnpm": "11.13.0"')
    .replace("pnpm@11.13.1", "pnpm@11.13.0");
  assert(
    validatePnpmToolchainAuthority(coordinatedPackageDrift, workspaceSource, mismatchedCiVersion).length > 0,
    "pnpm toolchain check should reject coordinated manifest and CI version drift",
  );

  const malformedPackage = packageSource.replace('"pnpm": "11.13.1"', '"pnpm": [}');
  const duplicatePackageKey = packageSource.replace(
    '"pnpm": "11.13.1"',
    '"pnpm": "11.13.1", "pnpm": "11.13.1"',
  );
  const duplicateWorkspaceKey = `${workspaceSource}pmOnFail: error\n`;
  const malformedWorkflow = workflowSource.replace("jobs:\n", "jobs: [}\n");
  for (const [label, candidatePackage, candidateWorkspace, candidateWorkflow] of [
    ["malformed package JSON", malformedPackage, workspaceSource, workflowSource],
    ["duplicate package key", duplicatePackageKey, workspaceSource, workflowSource],
    ["duplicate workspace key", packageSource, duplicateWorkspaceKey, workflowSource],
    ["malformed CI YAML", packageSource, workspaceSource, malformedWorkflow],
  ]) {
    assert(
      validatePnpmToolchainAuthority(candidatePackage, candidateWorkspace, candidateWorkflow).length > 0,
      `pnpm toolchain check should reject ${label}`,
    );
  }

  const setupStepBlock = workflowSource.match(
    /      - uses: pnpm\/action-setup@[^\n]+\n        with:\n          version: 11\.13\.1\n/,
  )?.[0];
  assert(setupStepBlock !== undefined, "pnpm toolchain fixture should find the reviewed CI setup step");
  if (setupStepBlock !== undefined) {
    const missingSetupStep = workflowSource.replace(setupStepBlock, "");
    const duplicateSetupStep = workflowSource.replace(setupStepBlock, `${setupStepBlock}${setupStepBlock}`);
    assert(
      validatePnpmToolchainAuthority(packageSource, workspaceSource, missingSetupStep).length > 0,
      "pnpm toolchain check should reject a missing CI setup step",
    );
    assert(
      validatePnpmToolchainAuthority(packageSource, workspaceSource, duplicateSetupStep).length > 0,
      "pnpm toolchain check should reject duplicate CI setup steps",
    );
  }
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

async function testBoundaryWorkspaceAliasPasses() {
  const root = path.join(tempRoot, "boundary-workspace-alias-pass");
  await writeText(
    path.join(root, "packages", "core", "package.json"),
    JSON.stringify({ name: "@fixture/core", dependencies: {} }, null, 2),
  );
  await writeText(
    path.join(root, "packages", "core", "src", "index.ts"),
    "export const core = true;\n",
  );
  await writeText(
    path.join(root, "apps", "web", "package.json"),
    JSON.stringify(
      {
        name: "@fixture/web",
        dependencies: { "@fixture/core-alias": "workspace:@fixture/core@*" },
      },
      null,
      2,
    ),
  );
  await writeText(path.join(root, "apps", "web", "src", "index.ts"), "export const app = true;\n");

  const result = runNode("check-boundaries.mjs", [root]);
  const output = outputOf(result);
  assert(result.status === 0, `check-boundaries should allow a legal workspace alias: ${output}`);
  assert(output.trim() === "Boundary check passed.", "legal workspace alias should return only the standard PASS output");
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

async function testBoundarySyntaxAwareImportExtraction() {
  const positiveRoot = path.join(tempRoot, "boundary-syntax-aware-imports");
  await writeText(
    path.join(positiveRoot, "apps", "web", "package.json"),
    JSON.stringify({ name: "@fixture/web", dependencies: {} }, null, 2),
  );
  await writeText(path.join(positiveRoot, "apps", "web", "src", "index.ts"), "export const app = 'web';\n");
  await writeText(
    path.join(positiveRoot, "packages", "trace", "package.json"),
    JSON.stringify({ name: "@fixture/trace", dependencies: {} }, null, 2),
  );
  await writeText(
    path.join(positiveRoot, "packages", "trace", "src", "index.ts"),
    [
      'import api = require("@yrese/api/import-equals");',
      'type ApiContract = import("@yrese/api/import-type").ApiContract;',
      'const withOptions = import("@yrese/api/options", { with: { type: "json" } });',
      "const templateImport = import(`@yrese/web/template`);",
      'const bareRequire = require("@yrese/api/bare");',
      "const moduleRequire = module.require(`@yrese/web/module`);",
      "const aws = import(`@aws-sdk/client-dynamodb`);",
      "export const refs = { api, withOptions, templateImport, bareRequire, moduleRequire, aws } satisfies Record<string, unknown>;",
      "",
    ].join("\n"),
  );

  const positiveResult = runNode("check-boundaries.mjs", [positiveRoot]);
  const positiveOutput = outputOf(positiveResult);
  assert(positiveResult.status === 1, "syntax-aware boundary scan should detect static module-loading forms");
  for (const specifier of [
    "@yrese/api/import-equals",
    "@yrese/api/import-type",
    "@yrese/api/options",
    "@yrese/web/template",
    "@yrese/api/bare",
    "@yrese/web/module",
  ]) {
    assert(positiveOutput.includes(`(${specifier})`), `boundary output should retain static specifier ${specifier}`);
  }
  assert(
    positiveOutput.includes("pure core package 'trace' must not import AWS SDK (@aws-sdk/client-dynamodb)"),
    "no-substitution template import should retain the pure-core AWS boundary",
  );
  assert(positiveOutput.includes("failed with 7 violation(s)"), "syntax-aware import fixture should retain its exact count");

  const lexicalRoot = path.join(tempRoot, "boundary-lexical-content-pass");
  await writeText(
    path.join(lexicalRoot, "apps", "web", "package.json"),
    JSON.stringify({ name: "@fixture/web", dependencies: {} }, null, 2),
  );
  await writeText(path.join(lexicalRoot, "apps", "web", "src", "index.ts"), "export const app = 'web';\n");
  await writeText(
    path.join(lexicalRoot, "packages", "feature", "package.json"),
    JSON.stringify({ name: "@fixture/feature", dependencies: {} }, null, 2),
  );
  await writeText(
    path.join(lexicalRoot, "packages", "feature", "src", "index.tsx"),
    [
      "// import '@yrese/api'; require('@yrese/api');",
      "/* export * from '@yrese/api'; import('@yrese/api'); */",
      'export const docs = "import \'@yrese/api\'; require(\'@yrese/api\')";',
      "export const templateDocs = `import('@yrese/api')`;",
      "export const matcher = /require\\('@yrese\\/api'\\)/;",
      'export const Copy = () => <div>import("@yrese/api") require("@yrese/api")</div>;',
      'const appName = "api";',
      "export const dynamicLoad = () => import(`@yrese/${appName}`);",
      "const load = require;",
      'export const aliasLoad = () => load("@yrese/api");',
      "const importMethod = { import: (_value: string) => undefined };",
      'importMethod.import("@yrese/api");',
      "const requireMethod = { require: (_value: string) => undefined };",
      'requireMethod.require("@yrese/api");',
      "",
    ].join("\n"),
  );

  const lexicalResult = runNode("check-boundaries.mjs", [lexicalRoot]);
  assert(
    lexicalResult.status === 0,
    `boundary scan should ignore non-code lexical content and dynamic/alias forms: ${outputOf(lexicalResult)}`,
  );

  const extensionRoot = path.join(tempRoot, "boundary-source-extensions");
  await writeText(
    path.join(extensionRoot, "apps", "web", "package.json"),
    JSON.stringify({ name: "@fixture/web", dependencies: {} }, null, 2),
  );
  await writeText(path.join(extensionRoot, "apps", "web", "src", "index.ts"), "export const app = 'web';\n");
  await writeText(
    path.join(extensionRoot, "packages", "feature", "package.json"),
    JSON.stringify({ name: "@fixture/feature", dependencies: {} }, null, 2),
  );
  const extensionSources = new Map([
    [".js", 'import("@yrese/api/js");\n'],
    [".jsx", 'export const View = () => <span>{import("@yrese/api/jsx") && null}</span>;\n'],
    [".mjs", 'import("@yrese/api/mjs");\n'],
    [".cjs", 'import("@yrese/api/cjs");\n'],
    [".ts", 'import("@yrese/api/ts");\n'],
    [".tsx", 'export const View = () => <span>{import("@yrese/api/tsx") && null}</span>;\n'],
    [".mts", 'import("@yrese/api/mts");\n'],
    [".cts", 'import("@yrese/api/cts");\n'],
  ]);
  for (const [extension, source] of extensionSources) {
    await writeText(path.join(extensionRoot, "packages", "feature", "src", `source${extension}`), source);
  }

  const extensionResult = runNode("check-boundaries.mjs", [extensionRoot]);
  const extensionOutput = outputOf(extensionResult);
  assert(extensionResult.status === 1, "all supported source extensions should use an explicit syntax kind");
  assert(extensionOutput.includes("failed with 8 violation(s)"), "extension fixture should report exactly eight imports");
  for (const extension of extensionSources.keys()) {
    const label = extension.slice(1);
    assert(
      extensionOutput.includes(`packages/feature/src/source${extension}: packages/** source must not import app code (@yrese/api/${label})`),
      `boundary scan should parse and report ${extension} source`,
    );
  }
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

async function testDuplicateConstSyntaxBoundaries() {
  const root = path.join(tempRoot, "duplicate-const-syntax");
  await writeText(
    path.join(root, "apps", "web", "package.json"),
    JSON.stringify({ name: "@fixture/web", dependencies: {} }, null, 2),
  );
  await writeText(path.join(root, "apps", "web", "src", "index.ts"), "export const app = 'web';\n");
  await writeText(
    path.join(root, "packages", "feature", "package.json"),
    JSON.stringify({ name: "@fixture/feature", dependencies: {} }, null, 2),
  );
  await writeText(
    path.join(root, "packages", "feature", "src", "registries.ts"),
    [
      'export const SYSTEM_MODES = <const>["NORMAL"];',
      'export const PROVISIONAL_STATUSES: readonly string[] = ((["PENDING"] as const) satisfies readonly string[]);',
      "export const PATIENT_SEARCH_CURSOR_MAX_LENGTH: number = 100;",
      "// const BLOCKER_TYPES = [] as const;",
      'export const docs = "const PERMISSION_ACTIONS = [] as const";',
      "export const registry = { PERMISSION_RESOURCES: [] as const, ROLE_NAMES: [] as const };",
      "const { ROLE_NAMES } = registry;",
      "let ERROR_SEVERITIES = [] as const;",
      "var ERROR_DOMAINS = [] as const;",
      "declare const KERNEL_ERROR_CODES: readonly string[];",
      'const ELIGIBILITY_STATUSES = ["VERIFIED"];',
      "export const values = { ROLE_NAMES, ERROR_SEVERITIES, ERROR_DOMAINS, KERNEL_ERROR_CODES, ELIGIBILITY_STATUSES };",
      "",
    ].join("\n"),
  );

  const result = runNode("check-boundaries.mjs", [root]);
  const output = outputOf(result);
  assert(result.status === 1, "duplicate const scan should detect syntax-equivalent canonical const assertions");
  const expectedFindings = [
    "duplicate shared-kernel const array 'SYSTEM_MODES'",
    "duplicate shared-kernel const array 'PROVISIONAL_STATUSES'",
    "duplicate contracts const 'PATIENT_SEARCH_CURSOR_MAX_LENGTH'",
  ];
  let previousFindingIndex = -1;
  for (const expectedFinding of expectedFindings) {
    const findingIndex = output.indexOf(expectedFinding);
    assert(findingIndex > previousFindingIndex, `duplicate const finding should retain rule order: ${expectedFinding}`);
    previousFindingIndex = findingIndex;
  }
  assert(output.includes("failed with 3 violation(s)"), "duplicate const syntax fixture should retain its exact count");
  for (const excludedName of [
    "BLOCKER_TYPES",
    "PERMISSION_ACTIONS",
    "PERMISSION_RESOURCES",
    "ROLE_NAMES",
    "ERROR_SEVERITIES",
    "ERROR_DOMAINS",
    "KERNEL_ERROR_CODES",
    "ELIGIBILITY_STATUSES",
  ]) {
    assert(!output.includes(`'${excludedName}'`), `${excludedName} non-declaration form should remain excluded`);
  }
}

async function testBoundaryScopeValidationFailsClosed() {
  const fixedMessage = "Boundary check could not validate the protected workspace scope.";
  const fixtures = [];

  const createSemanticFixture = async (label, appManifest, packageManifests = [{ name: "@fixture/core" }]) => {
    const root = path.join(tempRoot, `boundary-${label}`);
    await writeText(path.join(root, "apps", "web", "package.json"), JSON.stringify(appManifest));
    await writeText(path.join(root, "apps", "web", "src", "index.ts"), "export const app = true;\n");
    for (const [index, manifest] of packageManifests.entries()) {
      const packageDir = index === 0 ? "core" : `core-${index + 1}`;
      await writeText(path.join(root, "packages", packageDir, "package.json"), JSON.stringify(manifest));
      await writeText(path.join(root, "packages", packageDir, "src", "index.ts"), "export const core = true;\n");
    }
    fixtures.push({ label, root, exactOutput: true });
  };

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

  await createSemanticFixture("missing-manifest-name", {}, [{ name: "@fixture/core" }]);
  await createSemanticFixture("array-manifest", [], [{ name: "@fixture/core" }]);
  await createSemanticFixture("blank-manifest-name", { name: "   " });
  await createSemanticFixture("padded-manifest-name", { name: " @fixture/web " });
  await createSemanticFixture(
    "duplicate-manifest-name",
    { name: "@fixture/duplicate" },
    [{ name: "@fixture/duplicate" }],
  );
  await createSemanticFixture("null-dependency-section", {
    name: "@fixture/web",
    dependencies: null,
  });
  await createSemanticFixture("array-dependency-section", {
    name: "@fixture/web",
    devDependencies: [],
  });
  await createSemanticFixture("string-dependency-section", {
    name: "@fixture/web",
    dependencies: "do-not-echo",
  });
  await createSemanticFixture("number-dependency-section", {
    name: "@fixture/web",
    dependencies: 1,
  });
  await createSemanticFixture("boolean-dependency-section", {
    name: "@fixture/web",
    dependencies: false,
  });
  await createSemanticFixture("blank-dependency-name", {
    name: "@fixture/web",
    dependencies: { "   ": "workspace:*" },
  });
  await createSemanticFixture("padded-dependency-name", {
    name: "@fixture/web",
    dependencies: { " @fixture/core ": "workspace:*" },
  });
  await createSemanticFixture("non-string-dependency-specifier", {
    name: "@fixture/web",
    dependencies: { "@fixture/core": 1 },
  });
  await createSemanticFixture("blank-dependency-specifier", {
    name: "@fixture/web",
    dependencies: { "@fixture/core": "   " },
  });
  await createSemanticFixture("padded-dependency-specifier", {
    name: "@fixture/web",
    dependencies: { "@fixture/core": " workspace:* " },
  });
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

  const malformedSource = path.join(tempRoot, "boundary-malformed-source");
  await writeText(
    path.join(malformedSource, "apps", "web", "package.json"),
    JSON.stringify({ name: "@fixture/web" }),
  );
  await writeText(path.join(malformedSource, "apps", "web", "src", "index.ts"), "export const app = true;\n");
  await writeText(
    path.join(malformedSource, "packages", "core", "package.json"),
    JSON.stringify({ name: "@fixture/core" }),
  );
  await writeText(
    path.join(malformedSource, "packages", "core", "src", "index.ts"),
    'export const sensitiveMarker = "do-not-echo";\nconst broken = (\n',
  );
  fixtures.push({ label: "malformed source", root: malformedSource, exactOutput: true });

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
    if (fixture.exactOutput) {
      assert(output.trim() === fixedMessage, `${fixture.label} should expose only the fixed scope error`);
    }
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
      "/* Date.now(); new Date(); Math.random(); parseFloat(); Math.round(); */",
      'export const endpoint = "https://example.invalid/Date.now()";',
      "export const quoted = 'new Date() Math.random() parseFloat() Math.round() /* //';",
      "export const template = `Date.now() new Date() Math.random() parseFloat() Math.round() /* //`;",
      "export const matcher = /Date\\.now\\(\\)|new Date\\(\\)|Math\\.random\\(\\)|parseFloat\\(\\)|Math\\.round\\(\\)/;",
      "",
    ].join("\n"),
  );
  await writeText(
    path.join(root, "packages", "calculation", "src", "copy.tsx"),
    "export const Copy = () => <div>Date.now() new Date() Math.random() parseFloat() Math.round()</div>;\n",
  );
  await writeText(
    path.join(root, "packages", "calculation", "src", "dynamic.ts"),
    [
      'const dateMember = "now";',
      'const randomMember = "random";',
      "export const dynamicNow = Date[dateMember]();",
      "export const dynamicRandom = Math[randomMember]();",
      'export const numberParsed = Number.parseFloat("1.25");',
      "export const truncated = Math.trunc(1.25);",
      "const dateNowAlias = Date.now;",
      "const dateConstructorAlias = Date;",
      "const randomAlias = Math.random;",
      "const parseAlias = parseFloat;",
      "const roundAlias = Math.round;",
      'export const aliasValues = [dateNowAlias(), new dateConstructorAlias(), randomAlias(), parseAlias("1.25"), roundAlias(1.25)];',
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
  assert(
    result.status === 0,
    `check-calculation-purity should ignore non-code lexical content, dynamic members, and test files: ${outputOf(result)}`,
  );
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
  const expectedFindings = [
    "- packages/calculation/src/index.ts:2: Date.now() is forbidden. CAL-010 forbids implicit current time in calculation code.",
    "- packages/calculation/src/index.ts:3: new Date() is forbidden. CAL-010 requires dates to be explicit inputs.",
    "- packages/calculation/src/index.ts:4: Math.random() is forbidden. CAL-010 requires deterministic calculation output.",
    "- packages/calculation/src/index.ts:5: parseFloat() is forbidden. CAL-010 forbids floating-point parsing in calculation code.",
    "- packages/calculation/src/index.ts:6: Math.round() is forbidden. CAL-010 requires rounding to go through approved money/point helpers.",
  ];
  let previousFindingIndex = -1;
  for (const expectedFinding of expectedFindings) {
    const findingIndex = output.indexOf(expectedFinding);
    assert(findingIndex > previousFindingIndex, `purity finding should preserve full metadata and rule order: ${expectedFinding}`);
    previousFindingIndex = findingIndex;
  }
  assert(output.includes("failed with 5 violation(s)"), "purity output should retain the exact finding count");
  assert(output.includes("comments are ignored"), "purity violation output should document comment handling");
  assert(output.includes("test/spec files are excluded"), "purity violation output should document test handling");
}

async function testCalculationPuritySyntaxAwareDetection() {
  const lexicalRoot = path.join(tempRoot, "calculation-purity-syntax-aware");
  await writeText(
    path.join(lexicalRoot, "packages", "calculation", "src", "masked.ts"),
    [
      'export const endpoint = "https://example.invalid"; Date.now();',
      'export const marker = "/*"; Math.random();',
      "new Date();",
      'parseFloat("1.25"); Math.round(1.25);',
      "",
    ].join("\n"),
  );
  await writeText(
    path.join(lexicalRoot, "packages", "calculation", "src", "embedded.tsx"),
    [
      "export const Template = () => `${Date.now()}-${new Date().toISOString()}`;",
      'export const View = () => <span>{Math.random() + Math.round(parseFloat("1.25"))}</span>;',
      "",
    ].join("\n"),
  );
  await writeText(
    path.join(lexicalRoot, "packages", "calculation", "src", "equivalents.ts"),
    [
      "export function syntaxOnly(Date: { now(): number }, Math: { random(): number; round(value: number): number }, parseFloat: (value: string) => number) {",
      "  const optionalNow = Date?.now();",
      '  const computedNow = Date["now"]();',
      "  const optionalRandom = Math?.random();",
      "  const computedRound = Math[`round`]();",
      '  const parsed = (parseFloat)("1.25");',
      "  return optionalNow + computedNow + optionalRandom + computedRound + parsed;",
      "}",
      "",
    ].join("\n"),
  );
  await writeText(
    path.join(lexicalRoot, "packages", "calculation", "src", "non-equivalents.ts"),
    [
      'const dateMember = "now";',
      'const globalDateName = "Date";',
      'const globalMathName = "Math";',
      'export const dynamicNow = Date[dateMember]();',
      'export const dynamicQualifiedNow = globalThis[globalDateName].now();',
      'export const dynamicQualifiedRandom = globalThis[globalMathName].random();',
      'export const numberParsed = Number.parseFloat("1.25");',
      "export const truncated = Math.trunc(1.25);",
      "",
    ].join("\n"),
  );
  await writeText(
    path.join(lexicalRoot, "packages", "calculation", "src", "qualified.ts"),
    [
      "globalThis.Date.now();",
      'globalThis["Date"]["now"]();',
      "globalThis.Math.random();",
      'globalThis["Math"]["round"](1.25);',
      "new globalThis.Date();",
      'new globalThis["Date"]();',
      "",
    ].join("\n"),
  );

  const lexicalResult = runNode("check-calculation-purity.mjs", [lexicalRoot]);
  const lexicalOutput = outputOf(lexicalResult);
  assert(lexicalResult.status === 1, "syntax-aware purity scan should detect executable forbidden calls");
  for (const forbidden of ["Date.now()", "new Date()", "Math.random()", "parseFloat()", "Math.round()"]) {
    assert(lexicalOutput.includes(forbidden), `syntax-aware purity output should name ${forbidden}`);
  }
  assert(
    lexicalOutput.includes("packages/calculation/src/masked.ts:1: Date.now()"),
    "URL text must not hide a same-line Date.now call",
  );
  assert(
    lexicalOutput.includes("packages/calculation/src/masked.ts:2: Math.random()"),
    "block-comment text must not hide a same-line Math.random call",
  );
  assert(
    lexicalOutput.includes("packages/calculation/src/masked.ts:4: parseFloat()") &&
      lexicalOutput.includes("packages/calculation/src/masked.ts:4: Math.round()"),
    "multiple forbidden calls on one line should retain the same 1-based line",
  );
  assert(
    lexicalOutput.includes("packages/calculation/src/embedded.tsx:1: Date.now()") &&
      lexicalOutput.includes("packages/calculation/src/embedded.tsx:2: Math.random()"),
    "template and JSX expressions should remain executable scan scope",
  );
  assert(
    lexicalOutput.includes("packages/calculation/src/equivalents.ts:2: Date.now()") &&
      lexicalOutput.includes("packages/calculation/src/equivalents.ts:3: Date.now()") &&
      lexicalOutput.includes("packages/calculation/src/equivalents.ts:4: Math.random()") &&
      lexicalOutput.includes("packages/calculation/src/equivalents.ts:5: Math.round()") &&
      lexicalOutput.includes("packages/calculation/src/equivalents.ts:6: parseFloat()"),
    "optional, static-computed, parenthesized, and shadowed forms should be detected syntactically",
  );
  assert(
    !lexicalOutput.includes("packages/calculation/src/non-equivalents.ts"),
    "dynamic members, Number.parseFloat, and unrelated Math calls should remain outside the five rule families",
  );
  const expectedQualifiedFindings = [
    "- packages/calculation/src/qualified.ts:1: Date.now() is forbidden. CAL-010 forbids implicit current time in calculation code.",
    "- packages/calculation/src/qualified.ts:2: Date.now() is forbidden. CAL-010 forbids implicit current time in calculation code.",
    "- packages/calculation/src/qualified.ts:5: new Date() is forbidden. CAL-010 requires dates to be explicit inputs.",
    "- packages/calculation/src/qualified.ts:6: new Date() is forbidden. CAL-010 requires dates to be explicit inputs.",
    "- packages/calculation/src/qualified.ts:3: Math.random() is forbidden. CAL-010 requires deterministic calculation output.",
    "- packages/calculation/src/qualified.ts:4: Math.round() is forbidden. CAL-010 requires rounding to go through approved money/point helpers.",
  ];
  for (const expectedFinding of expectedQualifiedFindings) {
    assert(
      lexicalOutput.includes(expectedFinding),
      `qualified receiver finding should preserve path, line, name, and reason: ${expectedFinding}`,
    );
  }
  assert(lexicalOutput.includes("failed with 21 violation(s)"), "syntax-aware fixture should retain its exact finding count");

  const extensionRoot = path.join(tempRoot, "calculation-purity-extensions");
  const extensionSources = new Map([
    [".js", "export const value = Date.now();\n"],
    [".jsx", "export const View = () => <span>{Date.now()}</span>;\n"],
    [".mjs", "export const value = Date.now();\n"],
    [".cjs", "module.exports = Date.now();\n"],
    [".ts", "export const value: number = Date.now();\n"],
    [".tsx", "export const View = () => <span>{Date.now()}</span>;\n"],
    [".mts", "export const value: number = Date.now();\n"],
    [".cts", "export const value: number = Date.now();\n"],
  ]);
  for (const [extension, source] of extensionSources) {
    await writeText(path.join(extensionRoot, "packages", "calculation", "src", `source${extension}`), source);
  }

  const extensionResult = runNode("check-calculation-purity.mjs", [extensionRoot]);
  const extensionOutput = outputOf(extensionResult);
  assert(extensionResult.status === 1, "all supported source extensions should be scanned with their explicit syntax kind");
  for (const extension of extensionSources.keys()) {
    assert(
      extensionOutput.includes(`packages/calculation/src/source${extension}:1: Date.now()`),
      `purity scan should parse and report ${extension} production source`,
    );
  }
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

  const malformedRoot = path.join(tempRoot, "purity-malformed-source");
  await writeText(
    path.join(malformedRoot, "packages", "calculation", "src", "index.ts"),
    'export const sensitiveMarker = "do-not-echo";\nconst broken = (\n',
  );
  fixtures.push({ label: "malformed source", root: malformedRoot, exactOutput: true });

  for (const fixture of fixtures) {
    const result = runNode("check-calculation-purity.mjs", [fixture.root]);
    const output = outputOf(result);
    assert(result.status === 1, `check-calculation-purity should fail for ${fixture.label}`);
    assert(output.includes(fixedMessage), `${fixture.label} should use the fixed scope error`);
    assert(!output.includes("Calculation purity check passed."), `${fixture.label} must not report PASS`);
    assert(!output.includes(fixture.root), `${fixture.label} must not echo the absolute fixture path`);
    assert(!output.includes("do-not-echo"), `${fixture.label} must not echo nested source content`);
    if (fixture.exactOutput) {
      assert(output.trim() === fixedMessage, `${fixture.label} should expose only the fixed scope error`);
    }
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

  const cleanNpmrcRoot = path.join(tempRoot, "secrets-npmrc-clean");
  await writeText(
    path.join(cleanNpmrcRoot, ".npmrc"),
    [
      "registry=https://registry.npmjs.org/",
      "always-auth=false",
      "//registry.npmjs.org/:_authToken=${NPM_TOKEN}",
      "# _authToken=commented-example",
      "; _auth=commented-placeholder",
      "_authTokenName=SyntheticNpmTokenName1234567890",
      "_auth=short",
      "_password=example-placeholder-value",
      "",
    ].join("\n"),
  );
  const cleanNpmrcResult = runNode("check-secrets.mjs", [], { cwd: cleanNpmrcRoot });
  assert(
    cleanNpmrcResult.status === 0,
    `check-secrets should pass a clean standalone .npmrc: ${outputOf(cleanNpmrcResult)}`,
  );

  const syntheticNpmToken = ["Synthetic", "Npm", "Token", "1234567890"].join("");
  const syntheticNpmAuth = ["Synthetic", "Npm", "Auth", "1234567890"].join("");
  const syntheticNpmPassword = ["Synthetic", "Npm", "Password", "1234567890"].join("");
  const npmrcLeakRoot = path.join(tempRoot, "secrets-npmrc-leak");
  await writeText(
    path.join(npmrcLeakRoot, "config", ".npmrc"),
    [
      "",
      `//registry.npmjs.org/:_authToken=${syntheticNpmToken}`,
      `_auth = '${syntheticNpmAuth}'`,
      `//registry.example.invalid/team/:_password="${syntheticNpmPassword}"`,
      `# //registry.npmjs.org/:_authToken=${syntheticNpmToken}`,
      `; _password=${syntheticNpmPassword}`,
      "",
    ].join("\n"),
  );
  const npmrcLeakResult = runNode("check-secrets.mjs", [], { cwd: npmrcLeakRoot });
  const npmrcLeakOutput = outputOf(npmrcLeakResult);
  assert(npmrcLeakResult.status === 1, "check-secrets should reject npm credentials in nested .npmrc files");
  assert(
    npmrcLeakOutput.includes("config/.npmrc:2: npm auth token"),
    "npm token finding should include the relative path, line, and pattern name",
  );
  assert(
    npmrcLeakOutput.includes("config/.npmrc:3: npm auth credential") &&
      npmrcLeakOutput.includes("config/.npmrc:4: npm auth credential") &&
      npmrcLeakOutput.includes("config/.npmrc:5: npm auth token") &&
      npmrcLeakOutput.includes("config/.npmrc:6: npm auth credential"),
    "npm auth findings should include each relative line and pattern name",
  );
  for (const credential of [syntheticNpmToken, syntheticNpmAuth, syntheticNpmPassword]) {
    assert(!npmrcLeakOutput.includes(credential), "npm findings must not expose raw synthetic values");
  }

  const allowedNpmrcRoot = path.join(tempRoot, "secrets-npmrc-allow");
  await writeText(
    path.join(allowedNpmrcRoot, ".npmrc"),
    [
      "#",
      ";",
      `//registry.npmjs.org/:_authToken=${syntheticNpmToken} # secret-scan: allow`,
      "",
    ].join("\n"),
  );
  const allowedNpmrcResult = runNode("check-secrets.mjs", [], { cwd: allowedNpmrcRoot });
  assert(allowedNpmrcResult.status === 0, "check-secrets should honor .npmrc same-line allow markers");

  const npmrcSymlinkRoot = path.join(tempRoot, "secrets-npmrc-symlink");
  const externalNpmrc = path.join(tempRoot, "secrets-external-npmrc");
  await writeText(path.join(npmrcSymlinkRoot, "README.md"), "clean eligible text\n");
  await writeText(externalNpmrc, `_authToken=${syntheticNpmToken}\n`);
  await symlink(externalNpmrc, path.join(npmrcSymlinkRoot, ".npmrc"));
  const npmrcSymlinkResult = runNode("check-secrets.mjs", [], { cwd: npmrcSymlinkRoot });
  const npmrcSymlinkOutput = outputOf(npmrcSymlinkResult);
  assert(npmrcSymlinkResult.status === 1, "check-secrets should reject a symlinked .npmrc");
  assert(npmrcSymlinkOutput.includes(fixedScopeMessage), "symlinked .npmrc should use the fixed scope error");
  assert(!npmrcSymlinkOutput.includes(externalNpmrc), "symlinked .npmrc must not expose its target path");
  assert(!npmrcSymlinkOutput.includes(syntheticNpmToken), "symlinked .npmrc must not expose target content");
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
  const fixedFailure =
    "Dependency audit failed: audit report or command result was invalid.\n";
  const registryWarning =
    "Dependency audit registry/network warning (non-blocking): recognized transient error code.\n";
  const thresholdFailure = (count, level) =>
    `Dependency audit failed: ${count} ${level}+ vulnerabilities found.\n`;
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
  assert(cleanResult.status === 0, "check-deps should pass for a valid clean report");

  const vulnerableReportPath = await writeAuditReport(
    "audit-vulnerable.json",
    auditReport(
      { ...cleanCounts, high: 1 },
      {
        "1": {
          module_name:
            "https://synthetic:token@registry.example.invalid/private\r\nINJECTED_LINE\u001b[31mAUDIT_JSON_RAW_SENTINEL_4182\u001b[0m\u2028\u2029" +
            "x".repeat(1024),
          severity: "high",
          github_advisory_id: "GHSA-RAW-SENTINEL-4182",
        },
      },
    ),
  );

  const vulnerableResult = runNode("check-deps.mjs", ["--from-audit-json", vulnerableReportPath]);
  assert(vulnerableResult.status === 1, "check-deps should fail for high severity vulnerabilities");
  assert(vulnerableResult.stdout === "", "vulnerable audit output should keep stdout empty");
  assert(
    vulnerableResult.stderr === thresholdFailure(1, "high"),
    "vulnerable audit output should contain only the validated count and level",
  );
  for (const [sentinel, label] of [
    ["AUDIT_JSON_RAW_SENTINEL_4182", "module sentinel"],
    ["GHSA-RAW-SENTINEL-4182", "advisory sentinel"],
    ["registry.example.invalid", "registry host"],
    ["INJECTED_LINE", "injected line"],
    ["\u001b", "ESC"],
    ["\u2028", "U+2028"],
    ["\u2029", "U+2029"],
  ]) {
    assert(!outputOf(vulnerableResult).includes(sentinel), `vulnerable audit output must omit ${label}`);
  }

  const criticalReportPath = await writeAuditReport(
    "audit-critical.json",
    auditReport({ ...cleanCounts, critical: 1 }),
  );
  const criticalResult = runNode("check-deps.mjs", ["--from-audit-json", criticalReportPath]);
  assert(criticalResult.status === 1, "check-deps should fail for critical severity vulnerabilities");
  assert(criticalResult.stderr === thresholdFailure(1, "high"), "critical count should retain the default high threshold");

  const allSeverityReportPath = await writeAuditReport(
    "audit-all-severities.json",
    auditReport({ info: 1, low: 1, moderate: 1, high: 1, critical: 1 }, "malformed-advisories-ignored"),
  );
  for (const [level, count] of [["info", 5], ["low", 4], ["moderate", 3], ["high", 2], ["critical", 1]]) {
    const result = runNode("check-deps.mjs", ["--audit-level", level, "--from-audit-json", allSeverityReportPath]);
    assert(result.status === 1, `check-deps should retain the ${level} threshold`);
    assert(result.stdout === "", `${level} threshold failure should keep stdout empty`);
    assert(result.stderr === thresholdFailure(count, level), `${level} threshold should use a bounded numeric failure`);
  }

  const safeSumReportPath = await writeAuditReport(
    "audit-safe-sum.json",
    auditReport({ ...cleanCounts, high: Number.MAX_SAFE_INTEGER }),
  );
  const safeSumResult = runNode("check-deps.mjs", ["--from-audit-json", safeSumReportPath]);
  assert(safeSumResult.stderr === thresholdFailure(Number.MAX_SAFE_INTEGER, "high"), "safe aggregate boundary should remain exact");
  const overflowReportPath = await writeAuditReport(
    "audit-overflow-sum.json",
    auditReport({ ...cleanCounts, high: Number.MAX_SAFE_INTEGER, critical: 1 }),
  );
  const overflowResult = runNode("check-deps.mjs", ["--from-audit-json", overflowReportPath]);
  assert(overflowResult.status === 1, "unsafe aggregate should fail closed");
  assert(overflowResult.stderr === fixedFailure, "unsafe aggregate should not print an imprecise count");

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
    assert(result.stdout === "", `invalid report ${name} should keep stdout empty`);
    assert(result.stderr === fixedFailure, `invalid report ${name} should use one fixed failure line`);
  }

  const malformedJsonPath = path.join(root, "RAW_SENSITIVE_AUDIT_PATH_4182.json");
  await writeText(malformedJsonPath, '{"raw":"AUDIT_PARSE_RAW_SENTINEL_4182\u001b[31m"');
  for (const [inputPath, pathLabel] of [
    [malformedJsonPath, "malformed fixture path"],
    [path.join(root, "MISSING_SENSITIVE_AUDIT_PATH_4182.json"), "missing fixture path"],
    [root, "unreadable fixture path"],
  ]) {
    const result = runNode("check-deps.mjs", ["--from-audit-json", inputPath]);
    assert(result.status === 1, "unreadable or malformed captured JSON should fail closed");
    assert(result.stdout === "", "captured JSON failure should keep stdout empty");
    assert(result.stderr === fixedFailure, "captured JSON failure should use one fixed line");
    for (const [sentinel, label] of [
      [inputPath, pathLabel],
      ["AUDIT_PARSE_RAW_SENTINEL_4182", "parse sentinel"],
      ["RAW_SENSITIVE_AUDIT_PATH_4182", "malformed path basename"],
      ["MISSING_SENSITIVE_AUDIT_PATH_4182", "missing path basename"],
      ["\u001b", "ESC"],
      ["SyntaxError", "parser type"],
    ]) {
      assert(!outputOf(result).includes(sentinel), `captured JSON failure must omit ${label}`);
    }
  }

  for (const args of [
    ["--from-audit-json"],
    ["--from-audit-error"],
    ["--audit-level"],
    ["--audit-level", "RAW_LEVEL_SENTINEL_4182"],
    ["--unknown-RAW_ARG_SENTINEL_4182"],
  ]) {
    const result = runNode("check-deps.mjs", args);
    assert(result.status === 1, "missing or invalid arguments should fail closed");
    assert(result.stdout === "", "argument failure should keep stdout empty");
    assert(result.stderr === fixedFailure, "argument failure should use one fixed line");
    assert(!outputOf(result).includes("RAW_LEVEL_SENTINEL_4182"), "invalid level must not be echoed");
    assert(!outputOf(result).includes("RAW_ARG_SENTINEL_4182"), "unknown argument must not be echoed");
  }

  const registryErrorPath = path.join(root, "registry-error-sensitive-path.txt");
  const rawSentinel = "AUDIT_ERROR_RAW_SENTINEL_4177";
  await writeText(
    registryErrorPath,
    `ERR_PNPM_META_FETCH_FAIL\r\nhttps://synthetic:${rawSentinel}@registry.example.invalid/private?token=${rawSentinel}\r\n\u001b[31m${rawSentinel}\u001b[0m`,
  );
  const registryResult = runNode("check-deps.mjs", ["--from-audit-error", registryErrorPath]);
  assert(registryResult.status === 0, "check-deps should warn-only for registry/network outages");
  assert(registryResult.stdout === "", "captured registry warning should not write stdout");
  assert(
    registryResult.stderr ===
      "Dependency audit registry/network warning (non-blocking): recognized transient error code.\n",
    "registry outage should use one fixed warning line",
  );
  assert(!outputOf(registryResult).includes(rawSentinel), "registry warning must not replay raw audit stderr");
  assert(!outputOf(registryResult).includes(registryErrorPath), "registry warning must not expose the input path");
  assert(!outputOf(registryResult).includes("\u001b"), "registry warning must not replay control characters");

  for (const args of [
    ["--from-audit-json", vulnerableReportPath, "--from-audit-error", registryErrorPath],
    ["--from-audit-error", registryErrorPath, "--from-audit-json", vulnerableReportPath],
  ]) {
    const result = runNode("check-deps.mjs", args);
    assert(result.status === 1, "dual captured source modes should fail closed");
    assert(result.stdout === "", "dual captured source failure should keep stdout empty");
    assert(result.stderr === fixedFailure, "dual captured source failure should use one fixed line");
    assert(!result.stderr.includes(registryWarning), "dual captured source failure must not warn-pass");
    assert(!outputOf(result).includes("AUDIT_JSON_RAW_SENTINEL_4182"), "dual source failure must omit report sentinel");
    assert(!outputOf(result).includes(rawSentinel), "dual source failure must omit error sentinel");
    assert(!outputOf(result).includes(vulnerableReportPath), "dual source failure must omit report path");
    assert(!outputOf(result).includes(registryErrorPath), "dual source failure must omit error path");
    assert(!outputOf(result).includes("\u001b"), "dual source failure must omit ESC");
    assert(!outputOf(result).includes("\u2028"), "dual source failure must omit U+2028");
    assert(!outputOf(result).includes("\u2029"), "dual source failure must omit U+2029");
  }

  const genericErrorPath = path.join(root, "generic-sensitive-error.txt");
  await writeText(
    genericErrorPath,
    `registry network socket timeout while validating policy\r\n${rawSentinel}\u001b[31m`,
  );
  const genericErrorResult = runNode("check-deps.mjs", ["--from-audit-error", genericErrorPath]);
  assert(genericErrorResult.status === 1, "check-deps should not treat generic network-like words as an outage");
  assert(genericErrorResult.stdout === "", "captured failure should not write stdout");
  assert(
    genericErrorResult.stderr ===
      "Dependency audit failed: captured audit error was not a recognized transient.\n",
    "captured failure should use one fixed error line",
  );
  assert(!outputOf(genericErrorResult).includes(rawSentinel), "captured failure must not replay raw audit stderr");
  assert(!outputOf(genericErrorResult).includes(genericErrorPath), "captured failure must not expose the input path");

  const missingErrorPath = path.join(root, "missing-sensitive-error.txt");
  const missingErrorResult = runNode("check-deps.mjs", ["--from-audit-error", missingErrorPath]);
  assert(missingErrorResult.status === 1, "missing captured audit error should fail closed");
  assert(missingErrorResult.stdout === "", "missing captured audit error should not write stdout");
  assert(
    missingErrorResult.stderr ===
      "Dependency audit failed: captured audit error was not a recognized transient.\n",
    "missing captured audit error should use one fixed error line",
  );
  assert(!outputOf(missingErrorResult).includes(missingErrorPath), "missing failure must not expose the input path");

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
    parseableNonzeroResult.stderr === fixedFailure,
    "parseable nonzero failure should use one fixed non-echo line",
  );

  await writeText(
    fakePnpmPath,
    "#!/bin/sh\nprintf '%s\\n' 'not-json'\nprintf '%s\\n' 'ERR_PNPM_META_FETCH_FAIL RAW_LIVE_TRANSIENT_4182' >&2\nexit 1\n",
  );
  const liveTransientResult = runNode("check-deps.mjs", [], {
    env: { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}` },
  });
  assert(liveTransientResult.status === 0, "recognized live transient should remain non-blocking");
  assert(
    liveTransientResult.stderr ===
      "Dependency audit registry/network warning (non-blocking): recognized transient error code.\n",
    "recognized live transient should retain the WP-4177 fixed warning",
  );
  assert(!outputOf(liveTransientResult).includes("RAW_LIVE_TRANSIENT_4182"), "live transient must not replay child output");

  await writeText(
    fakePnpmPath,
    "#!/bin/sh\nprintf '%s\\n' 'RAW_LIVE_JSON_4182 {broken'\nprintf '%s\\n' 'RAW_LIVE_STDERR_4182' >&2\nexit 1\n",
  );
  const liveMalformedResult = runNode("check-deps.mjs", [], {
    env: { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}` },
  });
  assert(liveMalformedResult.status === 1, "unrecognized live malformed output should fail closed");
  assert(liveMalformedResult.stdout === "", "live malformed failure should keep wrapper stdout empty");
  assert(liveMalformedResult.stderr === fixedFailure, "live malformed failure should use one fixed line");
  assert(!outputOf(liveMalformedResult).includes("RAW_LIVE_JSON_4182"), "live malformed failure must not replay stdout");
  assert(!outputOf(liveMalformedResult).includes("RAW_LIVE_STDERR_4182"), "live malformed failure must not replay stderr");

  await writeText(
    fakePnpmPath,
    `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify(auditReport({ ...cleanCounts, high: 1 }))}'\nexit 1\n`,
  );
  const liveVulnerableResult = runNode("check-deps.mjs", [], {
    env: { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}` },
  });
  assert(liveVulnerableResult.status === 1, "live vulnerable report should remain blocking");
  assert(liveVulnerableResult.stdout === "", "live vulnerable failure should keep stdout empty");
  assert(liveVulnerableResult.stderr === thresholdFailure(1, "high"), "live vulnerable failure should use the bounded threshold line");
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
  if (absentResult.status !== 0) {
    return;
  }
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
  await testCiWorkflowTrustBoundary();
  await testPnpmToolchainAuthority();
  await testBoundaryViolationDetection();
  await testBoundaryCleanFixturePasses();
  await testBoundaryWorkspaceAliasPasses();
  await testPureCoreRejectsAwsAndDynamoDbImports();
  await testPureCoreRejectsAwsAndDynamoDbImportsThroughNonStaticForms();
  await testBoundarySyntaxAwareImportExtraction();
  await testAppAwsImportDoesNotTripPureCoreRule();
  await testDuplicateRegistryConstDetection();
  await testDuplicateContractAndKernelConstDetectionAcrossApps();
  await testDuplicateConstSyntaxBoundaries();
  await testBoundaryScopeValidationFailsClosed();
  await testCalculationPurityCleanFixturePasses();
  await testCalculationPurityViolationDetection();
  await testCalculationPuritySyntaxAwareDetection();
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
