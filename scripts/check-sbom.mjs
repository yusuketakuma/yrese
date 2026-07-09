#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = { fromListJson: undefined, output: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--from-list-json") {
      args.fromListJson = argv.at(index + 1);
      index += 1;
    } else if (arg === "--output") {
      args.output = argv.at(index + 1);
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

function runPnpmList() {
  const result = spawnSync("pnpm", ["list", "--recursive", "--json", "--depth", "Infinity"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error("pnpm list failed");
  }
  return result.stdout;
}

async function loadListJson(fromListJson) {
  let source;
  try {
    source = fromListJson === undefined ? runPnpmList() : await readFile(fromListJson, "utf8");
  } catch {
    throw new Error("unable to load pnpm list JSON");
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("pnpm list JSON must be valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("pnpm list JSON must be a non-empty array");
  }
  return parsed;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, context) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${context} must be a non-blank string`);
  }
  return value;
}

const dependencyContainerNames = ["dependencies", "devDependencies", "optionalDependencies"];

function dependencyEntries(node, context) {
  const entries = [];
  for (const containerName of dependencyContainerNames) {
    const container = node[containerName];
    if (container === undefined) {
      continue;
    }
    if (!isPlainObject(container)) {
      throw new Error(`${context} dependency container must be a plain object`);
    }
    entries.push(...Object.entries(container));
  }
  return entries;
}

function validatePackageNode(name, node, context) {
  const validatedName = requiredString(name, `${context} name`);
  validatePackageName(validatedName, context);
  if (!isPlainObject(node)) {
    throw new Error(`${context} must be a plain object`);
  }
  const version = requiredString(node.version, `${context} version`);
  const nodePath = requiredString(node.path, `${context} path`);
  dependencyEntries(node, context);
  return { name: validatedName, version, path: nodePath };
}

function validatePackageName(name, context) {
  if (name.startsWith("@")) {
    if (!/^@[^/@\s]+\/[^/@\s]+$/.test(name)) {
      throw new Error(`${context} scoped package name is invalid`);
    }
    return;
  }
  if (!/^[^/@\s]+$/.test(name)) {
    throw new Error(`${context} unscoped package name is invalid`);
  }
}

function createWorkspaceRegistry(workspaces) {
  const byPath = new Map();
  const byName = new Map();

  workspaces.forEach((workspace, index) => {
    const context = `workspace root ${index}`;
    const validated = validatePackageNode(workspace?.name, workspace, context);
    if (!path.isAbsolute(validated.path)) {
      throw new Error(`${context} path must be absolute`);
    }
    if (validated.version.startsWith("link:")) {
      throw new Error(`${context} version must be concrete`);
    }

    const resolvedPath = path.resolve(validated.path);
    if (byPath.has(resolvedPath)) {
      throw new Error("workspace path must be unique");
    }
    const existingName = byName.get(validated.name);
    if (
      existingName !== undefined &&
      (existingName.path !== resolvedPath || existingName.version !== validated.version)
    ) {
      throw new Error("workspace name registration conflicts");
    }

    const registration = { name: validated.name, version: validated.version, path: resolvedPath };
    byPath.set(resolvedPath, registration);
    byName.set(validated.name, registration);
  });

  return { byName, byPath };
}

function resolvedVersion(name, node, registry, context, isWorkspace) {
  const { version, path: nodePath } = validatePackageNode(name, node, context);
  if (!version.startsWith("link:")) {
    return { isWorkspaceLink: false, version };
  }
  if (isWorkspace) {
    throw new Error(`${context} version must be concrete`);
  }
  if (version.slice("link:".length).trim().length === 0) {
    throw new Error(`${context} workspace link suffix must be non-blank`);
  }
  if (!path.isAbsolute(nodePath)) {
    throw new Error(`${context} workspace link path must be absolute`);
  }

  // The pnpm-reported absolute node.path is the sole workspace identity authority.
  // The non-blank link suffix is display metadata and is intentionally never path-resolved.
  const target = registry.byPath.get(path.resolve(nodePath));
  if (target === undefined) {
    throw new Error(`${context} workspace link target must be registered`);
  }
  if (target.name !== name) {
    throw new Error(`${context} workspace link target name must match`);
  }
  if (target.version.startsWith("link:") || target.version.trim().length === 0) {
    throw new Error(`${context} workspace link target version must be concrete`);
  }
  return { isWorkspaceLink: true, version: target.version };
}

function packageUrl(name, version) {
  if (name.startsWith("@")) {
    const [scope, unscoped] = name.slice(1).split("/", 2);
    return `pkg:npm/%40${encodeURIComponent(scope)}/${encodeURIComponent(unscoped)}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function collectComponents(workspaces) {
  const registry = createWorkspaceRegistry(workspaces);
  const components = new Map();

  function addComponent(name, version, type) {
    const componentKey = JSON.stringify([name, version]);
    const bomRef = `${name}@${version}`;
    if (!components.has(componentKey)) {
      components.set(componentKey, {
        type,
        "bom-ref": bomRef,
        name,
        version,
        purl: packageUrl(name, version),
      });
    }
  }

  function visitDependency(name, node, context) {
    const resolution = resolvedVersion(name, node, registry, context, false);
    const workspace = registry.byName.get(name);
    if (!resolution.isWorkspaceLink && workspace?.version === resolution.version) {
      throw new Error(`${context} workspace and external package identities conflict`);
    }
    addComponent(name, resolution.version, "library");
    for (const [dependencyName, dependencyNode] of dependencyEntries(node, context)) {
      visitDependency(dependencyName, dependencyNode, `${context} dependency`);
    }
  }

  workspaces.forEach((workspace, index) => {
    const resolution = resolvedVersion(workspace.name, workspace, registry, `workspace root ${index}`, true);
    addComponent(workspace.name, resolution.version, "application");
  });
  workspaces.forEach((workspace, index) => {
    for (const [dependencyName, dependencyNode] of dependencyEntries(workspace, `workspace root ${index}`)) {
      visitDependency(dependencyName, dependencyNode, `workspace root ${index} dependency`);
    }
  });

  return [...components.values()].sort((a, b) => a["bom-ref"].localeCompare(b["bom-ref"]));
}

function createSbom(workspaces) {
  const components = collectComponents(workspaces);
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      component: {
        type: "application",
        name: "yrese",
      },
      tools: [
        {
          vendor: "yrese",
          name: "scripts/check-sbom.mjs",
        },
      ],
    },
    components,
  };
}

function validateSbom(sbom) {
  const failures = [];
  if (sbom.bomFormat !== "CycloneDX") failures.push("bomFormat must be CycloneDX");
  if (sbom.specVersion !== "1.5") failures.push("specVersion must be 1.5");
  if (!Array.isArray(sbom.components) || sbom.components.length === 0) {
    failures.push("components must be a non-empty array");
  }

  const refs = new Set();
  for (const component of sbom.components ?? []) {
    if (!isPlainObject(component)) {
      failures.push("component must be a plain object");
      continue;
    }
    if (typeof component.name !== "string" || component.name.trim().length === 0) {
      failures.push("component name is required");
    }
    if (typeof component.version !== "string" || component.version.trim().length === 0) {
      failures.push("component version is required");
    }
    if (typeof component["bom-ref"] !== "string" || component["bom-ref"].trim().length === 0) {
      failures.push("component bom-ref is required");
    } else if (refs.has(component["bom-ref"])) {
      failures.push("component bom-ref must be unique");
    } else {
      refs.add(component["bom-ref"]);
    }
  }

  if (failures.length > 0) {
    throw new Error(`SBOM validation failed:\n- ${failures.join("\n- ")}`);
  }
}

async function publishSbom(output, sbom) {
  let temporaryPath;
  try {
    const serialized = `${JSON.stringify(sbom, null, 2)}\n`;
    temporaryPath = path.join(path.dirname(output), `.yrese-sbom-${process.pid}-${randomUUID()}.tmp`);
    await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporaryPath, output);
  } catch {
    if (temporaryPath !== undefined) {
      try {
        await rm(temporaryPath, { force: true });
      } catch {
        // Best-effort cleanup; publish failure remains the primary error.
      }
    }
    throw new Error("unable to publish SBOM output");
  }
}

const args = parseArgs(process.argv.slice(2));
const workspaces = await loadListJson(args.fromListJson);
const sbom = createSbom(workspaces);
validateSbom(sbom);

if (args.output !== undefined) {
  await publishSbom(args.output, sbom);
}

console.log(`SBOM check passed: ${sbom.components.length} component(s).`);
