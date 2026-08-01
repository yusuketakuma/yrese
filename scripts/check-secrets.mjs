#!/usr/bin/env node
/**
 * Lightweight repository secret scan.
 *
 * Scope: every eligible text file under the working directory is scanned, including
 * files git ignores (an ignored `.env` is exactly what this gate exists to catch).
 * Ignore data is consulted for one purpose only — deciding whether a scope violation
 * (a symlink, a non-file, an unreadable entry) belongs to repository content and must
 * therefore abort the scan, or belongs to developer-local tooling and may be skipped.
 * Skips are always reported. Outside a git work tree there is no ignore data and the
 * scan aborts on any violation, as it always did.
 *
 * False positives can be allowlisted per line by adding:
 *   secret-scan: allow
 *
 * Keep allowlists rare and local to non-secret examples only.
 */
import { spawnSync } from "node:child_process";
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
const exactTextBasenames = new Set([".npmrc"]);
const scopeErrorMessage = "Secret scan could not validate the protected repository scope.";
class ProtectedScopeError extends Error {
  constructor(offendingPath) {
    super(scopeErrorMessage);
    this.offendingPath = offendingPath;
  }
}
/**
 * Scope violations abort the whole scan, so the operator must be able to tell which
 * entry broke it. Report only the repository-relative path — never the absolute root,
 * a symlink target, or file content (the same disclosure boundary as findings).
 */
function failScope(offendingPath) {
  throw new ProtectedScopeError(
    offendingPath === undefined ? undefined : toPosix(path.relative(rootDir, offendingPath)),
  );
}

/**
 * A scope violation aborts the whole scan, which is correct only when the offending
 * entry is repository content. Developer-local tooling that git is told to ignore is
 * not repository content, so a symlink or non-file among it must not take the gate
 * down. This narrows the abort condition only: every readable file, including an
 * ignored `.env`, is still scanned exactly as before, so coverage is unchanged.
 *
 * Ignore data exists only inside a work tree. Without one there is nothing to
 * distinguish content from tooling, so the scan stays fail-closed as it was.
 */
const insideGitWorkTree = (() => {
  const probe = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return probe.status === 0 && probe.stdout.trim() === "true";
})();

const skippedExcludedPaths = [];

function isExcludedFromRepositoryContent(entryPath) {
  if (!insideGitWorkTree || entryPath === undefined) {
    return false;
  }
  // `git check-ignore` reports a tracked path as not ignored even when a pattern
  // matches it, which is the boundary we want: tracked means repository content.
  // Any non-zero status — including git being absent or erroring — means "treat as
  // content", so an unreadable ignore configuration cannot silently widen the skip.
  const probe = spawnSync("git", ["check-ignore", "-q", "--", entryPath], {
    cwd: rootDir,
    stdio: "ignore",
  });
  return probe.status === 0;
}

/**
 * Returns true when the caller should skip the entry instead of aborting. Throws the
 * scope error otherwise, preserving the previous fail-closed behavior.
 */
function skipOrFailScope(entryPath) {
  if (!isExcludedFromRepositoryContent(entryPath)) {
    failScope(entryPath);
  }
  skippedExcludedPaths.push(toPosix(path.relative(rootDir, entryPath)));
  return true;
}

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
  {
    name: "npm auth token",
    pattern:
      /^[^\S\r\n]*(?:[#;][^\S\r\n]*)?(?:\/\/[^\r\n=]*\/:)?_authToken[^\S\r\n]*=[^\S\r\n]*["']?([A-Za-z0-9_./+=-]{16,})["']?/gm,
    validate: (match) => isLikelySecretValue(match[1] ?? ""),
    appliesTo: (filePath) => path.basename(filePath) === ".npmrc",
  },
  {
    name: "npm auth credential",
    pattern:
      /^[^\S\r\n]*(?:[#;][^\S\r\n]*)?(?:\/\/[^\r\n=]*\/:)?_(?:auth|password)[^\S\r\n]*=[^\S\r\n]*["']?([A-Za-z0-9_./+=-]{16,})["']?/gm,
    validate: (match) => isLikelySecretValue(match[1] ?? ""),
    appliesTo: (filePath) => path.basename(filePath) === ".npmrc",
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
  if (exactTextBasenames.has(basename)) {
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
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    skipOrFailScope(dir);
    return files;
  }

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      skipOrFailScope(entryPath);
      continue;
    }
    if (ignoredDirs.has(entry.name)) {
      if (!entry.isDirectory()) skipOrFailScope(entryPath);
      continue;
    }
    if (ignoredFiles.has(entry.name)) {
      if (!entry.isFile()) skipOrFailScope(entryPath);
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && isTextFile(entryPath)) {
      files.push(entryPath);
    } else if (!entry.isFile()) {
      skipOrFailScope(entryPath);
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
  try {
    source = await readFile(filePath, "utf8");
  } catch {
    skipOrFailScope(filePath);
    continue;
  }
  for (const { name, pattern, validate, appliesTo } of secretPatterns) {
    if (typeof appliesTo === "function" && !appliesTo(filePath)) {
      continue;
    }
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

// Never let a skip read as full coverage: say what was left out and why.
if (skippedExcludedPaths.length > 0) {
  console.error(
    `Secret scan skipped ${skippedExcludedPaths.length} entr${skippedExcludedPaths.length === 1 ? "y" : "ies"} excluded from repository content:`,
  );
  for (const skipped of skippedExcludedPaths) {
    console.error(`- ${skipped}`);
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
  if (error.offendingPath !== undefined && error.offendingPath.length > 0) {
    console.error(`Scope was broken by: ${error.offendingPath}`);
  }
  process.exitCode = 1;
}
