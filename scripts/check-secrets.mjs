#!/usr/bin/env node
/**
 * Lightweight repository secret scan.
 *
 * False positives can be allowlisted per line by adding:
 *   secret-scan: allow
 *
 * Keep allowlists rare and local to non-secret examples only.
 */
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const ignoredDirs = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);
const ignoredFiles = new Set(["pnpm-lock.yaml"]);
const scopeErrorMessage = "Secret scan could not validate the protected repository scope.";
class ProtectedScopeError extends Error {}
function failScope() { throw new ProtectedScopeError(scopeErrorMessage); }

const secretPatterns = [
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g },
  { name: "OpenAI API key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g },
  { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { name: "Private key block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  {
    name: "Generic secret assignment",
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|secret|token)\b\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{16,})["']?/gi,
    validate: (match) => isLikelySecretValue(match[1] ?? ""),
  },
];

const textExtensions = new Set([
  ".bash",
  ".cjs",
  ".css",
  ".env",
  ".example",
  ".js",
  ".json",
  ".jsx",
  ".key",
  ".md",
  ".mjs",
  ".mts",
  ".pem",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
  ".zsh",
]);

function isLikelySecretValue(value) {
  const normalized = value.toLowerCase();
  if (
    normalized.includes("example") ||
    normalized.includes("placeholder") ||
    normalized.includes("changeme") ||
    normalized.includes("dummy") ||
    normalized.includes("not-a-secret")
  ) {
    return false;
  }

  if (/^(x+|0+|1+|a+|test)+$/i.test(value)) {
    return false;
  }

  const characterClasses = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[_./+=-]/.test(value),
  ].filter(Boolean).length;

  return value.length >= 16 && characterClasses >= 2;
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function isTextFile(filePath) {
  const basename = path.basename(filePath);
  if (basename.startsWith(".env")) {
    return true;
  }
  return textExtensions.has(path.extname(filePath));
}

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split("\n").length;
}

function lineForIndex(source, index) {
  const lineStart = source.lastIndexOf("\n", index) + 1;
  const lineEnd = source.indexOf("\n", index);
  return source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
}

async function listFiles(dir) {
  const files = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { failScope(); }

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) failScope();
    if (ignoredDirs.has(entry.name)) {
      if (!entry.isDirectory()) failScope();
      continue;
    }
    if (ignoredFiles.has(entry.name)) {
      if (!entry.isFile()) failScope();
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && isTextFile(entryPath)) {
      files.push(entryPath);
    } else if (!entry.isFile()) {
      failScope();
    }
  }

  return files;
}

async function main() {
const root = await lstat(rootDir).catch(() => failScope());
if (!root.isDirectory() || root.isSymbolicLink()) failScope();
const files = await listFiles(rootDir);
if (files.length === 0) failScope();
const findings = [];

for (const filePath of files) {
  let source;
  try { source = await readFile(filePath, "utf8"); } catch { failScope(); }
  for (const { name, pattern, validate } of secretPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      if (lineForIndex(source, match.index).includes("secret-scan: allow")) {
        continue;
      }
      if (typeof validate === "function" && !validate(match)) {
        continue;
      }
      findings.push({
        filePath: toPosix(path.relative(rootDir, filePath)),
        line: lineNumberForIndex(source, match.index),
        name,
      });
    }
  }
}

if (findings.length > 0) {
  console.error(`Secret scan failed with ${findings.length} finding(s):`);
  for (const finding of findings) {
    console.error(`- ${finding.filePath}:${finding.line}: ${finding.name}`);
  }
  process.exitCode = 1;
} else {
  console.log("Secret scan passed.");
}
}

try { await main(); } catch (error) {
  if (!(error instanceof ProtectedScopeError)) throw error;
  console.error(scopeErrorMessage);
  process.exitCode = 1;
}
