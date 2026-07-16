#!/usr/bin/env node
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const rootDir = path.resolve(process.argv[2] ?? process.cwd());
const violations = [];
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const ignoredDirs = new Set([".git", ".next", "coverage", "dist", "node_modules"]);
const scopeError = "Boundary check could not validate the protected workspace scope.";
const sourceFileCache = new Map();
const dependencySections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
const pureCorePackageNames = new Set([
  "audit",
  "calculation",
  "contracts",
  "date-time",
  "events",
  "money",
  "shared-kernel",
  "trace",
]);
const duplicateConstRules = [
  { constName: "SYSTEM_MODES", ownerPackageName: "shared-kernel", sourceName: "shared-kernel", requiresAsConst: true },
  { constName: "PROVISIONAL_STATUSES", ownerPackageName: "shared-kernel", sourceName: "shared-kernel", requiresAsConst: true },
  { constName: "RECEPTION_STATUSES", ownerPackageName: "shared-kernel", sourceName: "shared-kernel", requiresAsConst: true },
  { constName: "BLOCKER_TYPES", ownerPackageName: "shared-kernel", sourceName: "shared-kernel", requiresAsConst: true },
  { constName: "PERMISSION_ACTIONS", ownerPackageName: "shared-kernel", sourceName: "shared-kernel", requiresAsConst: true },
  { constName: "PERMISSION_RESOURCES", ownerPackageName: "shared-kernel", sourceName: "shared-kernel", requiresAsConst: true },
  { constName: "ROLE_NAMES", ownerPackageName: "shared-kernel", sourceName: "shared-kernel", requiresAsConst: true },
  { constName: "ERROR_SEVERITIES", ownerPackageName: "shared-kernel", sourceName: "shared-kernel", requiresAsConst: true },
  { constName: "ERROR_DOMAINS", ownerPackageName: "shared-kernel", sourceName: "shared-kernel", requiresAsConst: true },
  { constName: "KERNEL_ERROR_CODES", ownerPackageName: "shared-kernel", sourceName: "shared-kernel", requiresAsConst: true },
  { constName: "ELIGIBILITY_STATUSES", ownerPackageName: "shared-kernel", sourceName: "shared-kernel", requiresAsConst: true },
  {
    constName: "PATIENT_SEARCH_CURSOR_MAX_LENGTH",
    ownerPackageName: "contracts",
    sourceName: "contracts",
    requiresAsConst: false,
  },
];

function report(message) {
  violations.push(message);
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function validateManifestShape(manifest) {
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(scopeError);
  }
  if (typeof manifest.name !== "string" || manifest.name.trim() === "" || manifest.name !== manifest.name.trim()) {
    throw new Error(scopeError);
  }

  for (const section of dependencySections) {
    const dependencies = manifest[section];
    if (dependencies === undefined) {
      continue;
    }
    if (dependencies === null || typeof dependencies !== "object" || Array.isArray(dependencies)) {
      throw new Error(scopeError);
    }
    for (const [name, specifier] of Object.entries(dependencies)) {
      if (name.trim() === "" || name !== name.trim()) {
        throw new Error(scopeError);
      }
      if (typeof specifier !== "string" || specifier.trim() === "" || specifier !== specifier.trim()) {
        throw new Error(scopeError);
      }
    }
  }
}

async function readWorkspaceManifests(workspacePackageDirs) {
  const manifests = new Map();
  const packageNames = new Set();

  for (const dir of workspacePackageDirs) {
    const manifest = await readJson(path.join(dir, "package.json"));
    validateManifestShape(manifest);
    if (packageNames.has(manifest.name)) {
      throw new Error(scopeError);
    }
    packageNames.add(manifest.name);
    manifests.set(dir, manifest);
  }

  return manifests;
}

async function listFiles(dir, predicate = () => true) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...(await listFiles(entryPath, predicate)));
      }
      continue;
    }

    if (entry.isFile() && predicate(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

async function listWorkspacePackageDirs() {
  const dirs = [];
  for (const workspaceDir of ["apps", "packages"]) {
    const baseDir = path.join(rootDir, workspaceDir);
    const entries = await readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !ignoredDirs.has(entry.name)) {
        dirs.push(path.join(baseDir, entry.name));
      }
    }
  }

  return dirs;
}

async function validateProtectedScopes() {
  const rootEntry = await lstat(rootDir);
  if (!rootEntry.isDirectory() || rootEntry.isSymbolicLink()) {
    throw new Error(scopeError);
  }

  for (const workspaceDir of ["apps", "packages"]) {
    const baseDir = path.join(rootDir, workspaceDir);
    const baseEntry = await lstat(baseDir);
    if (!baseEntry.isDirectory() || baseEntry.isSymbolicLink()) {
      throw new Error(scopeError);
    }

    const scopeEntries = await readdir(baseDir, { withFileTypes: true });
    const workspaceEntries = [];
    for (const entry of scopeEntries) {
      if (entry.isSymbolicLink()) {
        throw new Error(scopeError);
      }
      if (ignoredDirs.has(entry.name)) {
        if (!entry.isDirectory()) {
          throw new Error(scopeError);
        }
        continue;
      }
      workspaceEntries.push(entry);
    }
    if (workspaceEntries.length === 0) {
      throw new Error(scopeError);
    }

    let sourceCount = 0;
    for (const workspaceEntry of workspaceEntries) {
      if (!workspaceEntry.isDirectory() || workspaceEntry.isSymbolicLink()) {
        throw new Error(scopeError);
      }
      const workspacePath = path.join(baseDir, workspaceEntry.name);
      const manifestPath = path.join(workspacePath, "package.json");
      const manifestEntry = await lstat(manifestPath);
      if (!manifestEntry.isFile() || manifestEntry.isSymbolicLink()) {
        throw new Error(scopeError);
      }
      await readJson(manifestPath);

      const visit = async (dir) => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          const entryPath = path.join(dir, entry.name);
          if (entry.isSymbolicLink()) {
            throw new Error(scopeError);
          }
          if (ignoredDirs.has(entry.name)) {
            if (!entry.isDirectory()) {
              throw new Error(scopeError);
            }
            continue;
          }
          if (entry.isDirectory()) {
            await visit(entryPath);
          } else if (entry.isFile()) {
            if (sourceExtensions.has(path.extname(entryPath))) {
              await readFile(entryPath, "utf8");
              sourceCount += 1;
            }
          } else {
            throw new Error(scopeError);
          }
        }
      };
      await visit(workspacePath);
    }
    if (sourceCount === 0) {
      throw new Error(scopeError);
    }
  }
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
      throw new Error(scopeError);
  }
}

async function parseSourceFile(filePath) {
  const cached = sourceFileCache.get(filePath);
  if (cached !== undefined) {
    return cached;
  }
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
    throw new Error(scopeError);
  }
  sourceFileCache.set(filePath, sourceFile);
  return sourceFile;
}

function staticModuleSpecifier(node) {
  const expression = unwrapExpression(node);
  if (ts.isLiteralTypeNode(expression)) {
    return staticModuleSpecifier(expression.literal);
  }
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  return undefined;
}

function isRequireCallee(node) {
  const expression = unwrapExpression(node);
  if (ts.isIdentifier(expression)) {
    return expression.text === "require";
  }
  if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== "require") {
    return false;
  }
  const receiver = unwrapExpression(expression.expression);
  return ts.isIdentifier(receiver) && receiver.text === "module";
}

function extractImportSpecifiers(sourceFile) {
  const staticImports = [];
  const exports = [];
  const dynamicImports = [];
  const requires = [];

  function addSpecifier(collection, node) {
    const specifier = node === undefined ? undefined : staticModuleSpecifier(node);
    if (specifier !== undefined) {
      collection.push(specifier);
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      addSpecifier(staticImports, node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node)) {
      addSpecifier(exports, node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      addSpecifier(requires, node.moduleReference.expression);
    } else if (ts.isImportTypeNode(node)) {
      addSpecifier(dynamicImports, node.argument);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        addSpecifier(dynamicImports, node.arguments[0]);
      } else if (isRequireCallee(node.expression)) {
        addSpecifier(requires, node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return [...new Set([...staticImports, ...exports, ...dynamicImports, ...requires])];
}

function resolveRelativeImport(filePath, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  return path.resolve(path.dirname(filePath), specifier);
}

function isInsideDir(candidatePath, dirPath) {
  const relative = path.relative(dirPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function workspaceAppNameFromPath(filePath) {
  const relative = toPosix(path.relative(rootDir, filePath));
  const match = /^apps\/([^/]+)\//.exec(relative);
  return match?.[1] ?? null;
}

function packageNameFromPath(filePath) {
  const relative = toPosix(path.relative(rootDir, filePath));
  const match = /^packages\/([^/]+)\//.exec(relative);
  return match?.[1] ?? null;
}

function forbiddenPureCoreImportReason(specifier) {
  if (specifier === "aws-sdk" || specifier.startsWith("@aws-sdk/")) {
    return "AWS SDK";
  }

  if (specifier.toLowerCase().includes("dynamodb")) {
    return "DynamoDB module";
  }

  return null;
}

function isTestSourceFile(filePath) {
  const basename = path.basename(filePath);
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(basename);
}

async function checkImportBoundaries(packageNameByDir, appPackageNames) {
  const sourcePredicate = (filePath) => sourceExtensions.has(path.extname(filePath));
  const packageFiles = await listFiles(path.join(rootDir, "packages"), sourcePredicate);
  const appFiles = await listFiles(path.join(rootDir, "apps"), sourcePredicate);

  for (const filePath of packageFiles) {
    const packageName = packageNameFromPath(filePath);
    const sourceFile = await parseSourceFile(filePath);
    const relative = toPosix(path.relative(rootDir, filePath));
    for (const specifier of extractImportSpecifiers(sourceFile)) {
      const forbiddenPureCoreImport =
        packageName !== null && pureCorePackageNames.has(packageName)
          ? forbiddenPureCoreImportReason(specifier)
          : null;
      if (forbiddenPureCoreImport !== null) {
        report(`${relative}: pure core package '${packageName}' must not import ${forbiddenPureCoreImport} (${specifier})`);
      }

      const relativeTarget = resolveRelativeImport(filePath, specifier);
      const importsApps =
        specifier.startsWith("apps/") ||
        specifier === "@yrese/api" ||
        specifier.startsWith("@yrese/api/") ||
        specifier === "@yrese/web" ||
        specifier.startsWith("@yrese/web/") ||
        (relativeTarget !== null && isInsideDir(relativeTarget, path.join(rootDir, "apps")));

      if (importsApps) {
        report(`${relative}: packages/** source must not import app code (${specifier})`);
      }
    }
  }

  for (const filePath of appFiles) {
    const appName = workspaceAppNameFromPath(filePath);
    if (appName === null) {
      continue;
    }

    const sourceFile = await parseSourceFile(filePath);
    const relative = toPosix(path.relative(rootDir, filePath));
    for (const specifier of extractImportSpecifiers(sourceFile)) {
      const relativeTarget = resolveRelativeImport(filePath, specifier);
      const appImportByPath = specifier.startsWith("apps/")
        ? specifier.split("/")[1]
        : relativeTarget !== null && isInsideDir(relativeTarget, path.join(rootDir, "apps"))
          ? workspaceAppNameFromPath(relativeTarget)
          : null;
      const appImportByPackage = appPackageNames.get(specifier) ?? appPackageNames.get(specifier.split("/").slice(0, 2).join("/"));
      const importedAppName = appImportByPath ?? appImportByPackage;

      if (importedAppName !== null && importedAppName !== undefined && importedAppName !== appName) {
        report(`${relative}: apps/** source must not import another app (${specifier})`);
      }
    }
  }

  void packageNameByDir;
}

function workspaceDependencies(packageJson) {
  const deps = [];
  for (const section of dependencySections) {
    const values = packageJson[section] ?? {};
    for (const [name, specifier] of Object.entries(values)) {
      if (typeof specifier === "string" && specifier.startsWith("workspace:")) {
        deps.push(name);
      }
    }
  }
  return deps;
}

function checkWorkspaceCycles(workspaceManifests) {
  const graph = new Map();

  for (const packageJson of workspaceManifests.values()) {
    graph.set(packageJson.name, workspaceDependencies(packageJson));
  }

  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(name) {
    if (visited.has(name)) {
      return;
    }
    if (visiting.has(name)) {
      const cycleStart = stack.indexOf(name);
      const cycle = [...stack.slice(cycleStart), name].join(" -> ");
      report(`workspace dependency cycle detected: ${cycle}`);
      return;
    }

    visiting.add(name);
    stack.push(name);

    for (const dependency of graph.get(name) ?? []) {
      if (graph.has(dependency)) {
        visit(dependency);
      }
    }

    stack.pop();
    visiting.delete(name);
    visited.add(name);
  }

  for (const name of graph.keys()) {
    visit(name);
  }
}

function initializerContainsConstAssertion(initializer) {
  let found = false;
  function visit(node) {
    if (
      (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
      ts.isConstTypeReference(node.type)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(initializer);
  return found;
}

function hasDuplicateConstDeclaration(sourceFile, constName, requiresAsConst) {
  let found = false;
  function visit(node) {
    if (found) {
      return;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0 &&
      ts.isIdentifier(node.name) &&
      node.name.text === constName &&
      node.initializer !== undefined &&
      (!requiresAsConst || initializerContainsConstAssertion(node.initializer))
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

async function checkDuplicateConstArrays() {
  const sourcePredicate = (filePath) => {
    const relative = toPosix(path.relative(rootDir, filePath));
    const isPackageSource = /^packages\/[^/]+\/src\/.+\.[cm]?[jt]sx?$/.test(relative);
    const isAppSource = /^apps\/[^/]+\/.+\.[cm]?[jt]sx?$/.test(relative);
    if (!isPackageSource && !isAppSource) {
      return false;
    }
    return !isTestSourceFile(filePath);
  };
  const files = [
    ...(await listFiles(path.join(rootDir, "packages"), sourcePredicate)),
    ...(await listFiles(path.join(rootDir, "apps"), sourcePredicate)),
  ];

  for (const filePath of files) {
    const packageName = packageNameFromPath(filePath);
    const sourceFile = await parseSourceFile(filePath);
    const relative = toPosix(path.relative(rootDir, filePath));
    for (const { constName, ownerPackageName, sourceName, requiresAsConst } of duplicateConstRules) {
      if (packageName === ownerPackageName) {
        continue;
      }
      if (hasDuplicateConstDeclaration(sourceFile, constName, requiresAsConst)) {
        const constKind = requiresAsConst ? "const array" : "const";
        report(`${relative}: duplicate ${sourceName} ${constKind} '${constName}' is not allowed`);
      }
    }
  }
}

async function main() {
  await validateProtectedScopes();
  const workspacePackageDirs = await listWorkspacePackageDirs();
  const workspaceManifests = await readWorkspaceManifests(workspacePackageDirs);
  const packageNameByDir = new Map();
  const appPackageNames = new Map();

  for (const dir of workspacePackageDirs) {
    const packageJson = workspaceManifests.get(dir);
    packageNameByDir.set(dir, packageJson.name);
    if (toPosix(path.relative(rootDir, dir)).startsWith("apps/")) {
      appPackageNames.set(packageJson.name, path.basename(dir));
    }
  }

  await checkImportBoundaries(packageNameByDir, appPackageNames);
  checkWorkspaceCycles(workspaceManifests);
  await checkDuplicateConstArrays();

  if (violations.length > 0) {
    console.error(`Boundary check failed with ${violations.length} violation(s):`);
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Boundary check passed.");
}

try {
  await main();
} catch {
  console.error(scopeError);
  process.exitCode = 1;
}
