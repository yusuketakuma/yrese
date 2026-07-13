#!/usr/bin/env node
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const rootDir = path.resolve(process.argv[2] ?? process.cwd());
const targetDir = path.join(rootDir, "packages", "calculation");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const ignoredDirs = new Set([".git", ".next", "coverage", "dist", "node_modules"]);
const invalidScopeMessage =
  "Calculation purity check failed: protected source scope is unavailable or contains no production source files.";

const forbiddenRules = [
  {
    name: "Date.now()",
    reason: "CAL-010 forbids implicit current time in calculation code",
    matches: (node) => isStaticMemberCall(node, "Date", "now"),
  },
  {
    name: "new Date()",
    reason: "CAL-010 requires dates to be explicit inputs",
    matches: (node) => ts.isNewExpression(node) && isStaticReferenceNamed(node.expression, "Date"),
  },
  {
    name: "Math.random()",
    reason: "CAL-010 requires deterministic calculation output",
    matches: (node) => isStaticMemberCall(node, "Math", "random"),
  },
  {
    name: "parseFloat()",
    reason: "CAL-010 forbids floating-point parsing in calculation code",
    matches: (node) =>
      ts.isCallExpression(node) && isIdentifierNamed(node.expression, "parseFloat"),
  },
  {
    name: "Math.round()",
    reason: "CAL-010 requires rounding to go through approved money/point helpers",
    matches: (node) => isStaticMemberCall(node, "Math", "round"),
  },
];

const violations = [];

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

async function listFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error("symbolic links are not allowed in the protected source scope");
    }
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...(await listFiles(entryPath)));
      }
      continue;
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entryPath)) && !isTestSourceFile(entryPath)) {
      files.push(entryPath);
      continue;
    }
    if (!entry.isFile()) {
      throw new Error("unsupported filesystem entry in the protected source scope");
    }
  }

  return files;
}

function isTestSourceFile(filePath) {
  const basename = path.basename(filePath);
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(basename);
}

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function isIdentifierNamed(node, name) {
  const expression = unwrapExpression(node);
  return ts.isIdentifier(expression) && expression.text === name;
}

function staticMemberName(node) {
  const expression = unwrapExpression(node);
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  if (ts.isElementAccessExpression(expression)) {
    const argument = expression.argumentExpression && unwrapExpression(expression.argumentExpression);
    if (argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))) {
      return argument.text;
    }
  }
  return undefined;
}

function isStaticReferenceNamed(node, name) {
  const expression = unwrapExpression(node);
  if (ts.isIdentifier(expression)) {
    return expression.text === name;
  }
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    return staticMemberName(expression) === name;
  }
  return false;
}

function isStaticMemberCall(node, receiverName, memberName) {
  if (!ts.isCallExpression(node)) {
    return false;
  }
  const callee = unwrapExpression(node.expression);
  if (!ts.isPropertyAccessExpression(callee) && !ts.isElementAccessExpression(callee)) {
    return false;
  }
  return isStaticReferenceNamed(callee.expression, receiverName) && staticMemberName(callee) === memberName;
}

function scriptKindFor(filePath) {
  switch (path.extname(filePath)) {
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".ts":
    case ".mts":
    case ".cts":
      return ts.ScriptKind.TS;
    case ".tsx":
      return ts.ScriptKind.TSX;
    default:
      throw new Error("unsupported production source extension");
  }
}

async function checkFile(filePath) {
  const source = await readFile(filePath, "utf8");
  const relative = toPosix(path.relative(rootDir, filePath));
  const sourceFile = ts.createSourceFile(
    relative,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filePath),
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    throw new Error("production source contains a syntax error");
  }

  const matchesByRule = forbiddenRules.map(() => []);
  function visit(node) {
    forbiddenRules.forEach((rule, index) => {
      if (rule.matches(node)) {
        matchesByRule[index].push(node);
      }
    });
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  forbiddenRules.forEach((forbidden, index) => {
    for (const node of matchesByRule[index]) {
      violations.push({
        relative,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        name: forbidden.name,
        reason: forbidden.reason,
      });
    }
  });
}

async function main() {
  try {
    const targetMetadata = await lstat(targetDir);
    if (!targetMetadata.isDirectory() || targetMetadata.isSymbolicLink()) {
      throw new Error("protected source scope must be a real directory");
    }

    const files = await listFiles(targetDir);
    if (files.length === 0) {
      throw new Error("protected source scope has no production source files");
    }
    for (const filePath of files) {
      await checkFile(filePath);
    }
  } catch {
    console.error(invalidScopeMessage);
    process.exitCode = 1;
    return;
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
