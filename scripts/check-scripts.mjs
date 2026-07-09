#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

try {
  await testBoundaryViolationDetection();
  await testBoundaryCleanFixturePasses();
  await testDuplicateRegistryConstDetection();
  await testSecretAllowlistAndDetection();
  await testCleanRemovesGeneratedArtifacts();
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
