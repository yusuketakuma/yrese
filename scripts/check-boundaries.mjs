#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(process.argv[2] ?? process.cwd());
const violations = [];
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const ignoredDirs = new Set([".git", ".next", "coverage", "dist", "node_modules"]);
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
  { constName: "ELIGIBILITY_STATUSES", ownerPackageName: "contracts", sourceName: "contracts", requiresAsConst: true },
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

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function listFiles(dir, predicate = () => true) {
  if (!(await pathExists(dir))) {
    return [];
  }

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
    if (!(await pathExists(baseDir))) {
      continue;
    }

    const entries = await readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && (await pathExists(path.join(baseDir, entry.name, "package.json")))) {
        dirs.push(path.join(baseDir, entry.name));
      }
    }
  }

  return dirs;
}

function extractImportSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?[^'"]+\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      specifiers.add(match[1]);
    }
  }

  return [...specifiers];
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

function isTestSourceFile(filePath) {
  const basename = path.basename(filePath);
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(basename);
}

async function checkImportBoundaries(packageNameByDir, appPackageNames) {
  const sourcePredicate = (filePath) => sourceExtensions.has(path.extname(filePath));
  const packageFiles = await listFiles(path.join(rootDir, "packages"), sourcePredicate);
  const appFiles = await listFiles(path.join(rootDir, "apps"), sourcePredicate);

  for (const filePath of packageFiles) {
    const source = await readFile(filePath, "utf8");
    const relative = toPosix(path.relative(rootDir, filePath));
    for (const specifier of extractImportSpecifiers(source)) {
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

    const source = await readFile(filePath, "utf8");
    const relative = toPosix(path.relative(rootDir, filePath));
    for (const specifier of extractImportSpecifiers(source)) {
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
  const sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  const deps = [];
  for (const section of sections) {
    const values = packageJson[section] ?? {};
    for (const [name, specifier] of Object.entries(values)) {
      if (typeof specifier === "string" && specifier.startsWith("workspace:")) {
        deps.push(name);
      }
    }
  }
  return deps;
}

async function checkWorkspaceCycles(workspacePackageDirs) {
  const graph = new Map();

  for (const dir of workspacePackageDirs) {
    const packageJson = await readJson(path.join(dir, "package.json"));
    if (typeof packageJson.name !== "string") {
      continue;
    }
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
    const source = await readFile(filePath, "utf8");
    const relative = toPosix(path.relative(rootDir, filePath));
    for (const { constName, ownerPackageName, sourceName, requiresAsConst } of duplicateConstRules) {
      if (packageName === ownerPackageName) {
        continue;
      }
      const pattern = requiresAsConst
        ? new RegExp(`\\b(?:export\\s+)?const\\s+${constName}\\b[\\s\\S]*?\\bas\\s+const\\b`, "m")
        : new RegExp(`\\b(?:export\\s+)?const\\s+${constName}\\b\\s*(?::[^=]+)?=`, "m");
      if (pattern.test(source)) {
        const constKind = requiresAsConst ? "const array" : "const";
        report(`${relative}: duplicate ${sourceName} ${constKind} '${constName}' is not allowed`);
      }
    }
  }
}

async function main() {
  const workspacePackageDirs = await listWorkspacePackageDirs();
  const packageNameByDir = new Map();
  const appPackageNames = new Map();

  for (const dir of workspacePackageDirs) {
    const packageJson = await readJson(path.join(dir, "package.json"));
    if (typeof packageJson.name !== "string") {
      continue;
    }
    packageNameByDir.set(dir, packageJson.name);
    if (toPosix(path.relative(rootDir, dir)).startsWith("apps/")) {
      appPackageNames.set(packageJson.name, path.basename(dir));
    }
  }

  await checkImportBoundaries(packageNameByDir, appPackageNames);
  await checkWorkspaceCycles(workspacePackageDirs);
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

await main();
