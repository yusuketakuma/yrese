#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(process.argv[2] ?? process.cwd());
const targetDir = path.join(rootDir, "packages", "calculation");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const ignoredDirs = new Set([".git", ".next", "coverage", "dist", "node_modules"]);

const forbiddenPatterns = [
  {
    name: "Date.now()",
    pattern: /\bDate\s*\.\s*now\s*\(/g,
    reason: "CAL-010 forbids implicit current time in calculation code",
  },
  {
    name: "new Date()",
    pattern: /\bnew\s+Date\s*\(/g,
    reason: "CAL-010 requires dates to be explicit inputs",
  },
  {
    name: "Math.random()",
    pattern: /\bMath\s*\.\s*random\s*\(/g,
    reason: "CAL-010 requires deterministic calculation output",
  },
  {
    name: "parseFloat()",
    pattern: /\bparseFloat\s*\(/g,
    reason: "CAL-010 forbids floating-point parsing in calculation code",
  },
  {
    name: "Math.round()",
    pattern: /\bMath\s*\.\s*round\s*\(/g,
    reason: "CAL-010 requires rounding to go through approved money/point helpers",
  },
];

const violations = [];

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  if (!(await pathExists(dir))) {
    return [];
  }

  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...(await listFiles(entryPath)));
      }
      continue;
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entryPath)) && !isTestSourceFile(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

function isTestSourceFile(filePath) {
  const basename = path.basename(filePath);
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(basename);
}

function stripComments(source) {
  let output = "";
  let index = 0;
  let state = "code";

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "line-comment") {
      if (char === "\n") {
        output += "\n";
        state = "code";
      } else {
        output += " ";
      }
      index += 1;
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        output += "  ";
        index += 2;
        state = "code";
        continue;
      }
      output += char === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      output += "  ";
      index += 2;
      state = "line-comment";
      continue;
    }

    if (char === "/" && next === "*") {
      output += "  ";
      index += 2;
      state = "block-comment";
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === "\n") {
      line += 1;
    }
  }
  return line;
}

async function checkFile(filePath) {
  const source = await readFile(filePath, "utf8");
  const scanSource = stripComments(source);
  const relative = toPosix(path.relative(rootDir, filePath));

  for (const forbidden of forbiddenPatterns) {
    forbidden.pattern.lastIndex = 0;
    let match;
    while ((match = forbidden.pattern.exec(scanSource)) !== null) {
      violations.push({
        relative,
        line: lineNumberAt(scanSource, match.index),
        name: forbidden.name,
        reason: forbidden.reason,
      });
    }
  }
}

async function main() {
  const files = await listFiles(targetDir);
  for (const filePath of files) {
    await checkFile(filePath);
  }

  if (violations.length > 0) {
    console.error(`Calculation purity check failed with ${violations.length} violation(s):`);
    for (const violation of violations) {
      console.error(`- ${violation.relative}:${violation.line}: ${violation.name} is forbidden. ${violation.reason}.`);
    }
    console.error("Scope: packages/calculation non-test source files; comments are ignored; test/spec files are excluded.");
    process.exitCode = 1;
    return;
  }

  console.log("Calculation purity check passed.");
}

await main();
