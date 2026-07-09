#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
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
    throw new Error(`pnpm list failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout;
}

async function loadListJson(fromListJson) {
  const source = fromListJson === undefined ? runPnpmList() : await readFile(fromListJson, "utf8");
  const parsed = JSON.parse(source);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("pnpm list JSON must be a non-empty array");
  }
  return parsed;
}

function dependencyEntries(node) {
  return [
    ...Object.entries(node.dependencies ?? {}),
    ...Object.entries(node.devDependencies ?? {}),
    ...Object.entries(node.optionalDependencies ?? {}),
  ];
}

function workspaceVersionByPath(workspaces) {
  const versions = new Map();
  for (const workspace of workspaces) {
    if (typeof workspace.path === "string" && typeof workspace.version === "string") {
      versions.set(path.resolve(workspace.path), workspace.version);
    }
  }
  return versions;
}

function normalizeVersion(node, versionsByPath) {
  if (typeof node.version !== "string" || node.version.length === 0) {
    return "0.0.0";
  }
  if (node.version.startsWith("link:") && typeof node.path === "string") {
    return versionsByPath.get(path.resolve(node.path)) ?? node.version;
  }
  return node.version;
}

function packageUrl(name, version) {
  if (name.startsWith("@")) {
    const [scope, unscoped] = name.slice(1).split("/", 2);
    return `pkg:npm/%40${encodeURIComponent(scope)}/${encodeURIComponent(unscoped)}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function collectComponents(workspaces) {
  const versionsByPath = workspaceVersionByPath(workspaces);
  const components = new Map();

  function visit(name, node, isWorkspace = false) {
    if (typeof name !== "string" || name.length === 0 || node === null || typeof node !== "object") {
      return;
    }
    const version = normalizeVersion(node, versionsByPath);
    const bomRef = `${name}@${version}`;
    if (!components.has(bomRef)) {
      components.set(bomRef, {
        type: isWorkspace ? "application" : "library",
        "bom-ref": bomRef,
        name,
        version,
        purl: packageUrl(name, version),
      });
    }
    for (const [dependencyName, dependencyNode] of dependencyEntries(node)) {
      visit(dependencyName, dependencyNode);
    }
  }

  for (const workspace of workspaces) {
    visit(workspace.name, workspace, true);
  }

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
    if (typeof component.name !== "string" || component.name.length === 0) {
      failures.push("component name is required");
    }
    if (typeof component.version !== "string" || component.version.length === 0) {
      failures.push(`component version is required for ${component.name ?? "<unknown>"}`);
    }
    if (typeof component["bom-ref"] !== "string" || component["bom-ref"].length === 0) {
      failures.push(`component bom-ref is required for ${component.name ?? "<unknown>"}`);
    } else if (refs.has(component["bom-ref"])) {
      failures.push(`duplicate bom-ref: ${component["bom-ref"]}`);
    } else {
      refs.add(component["bom-ref"]);
    }
  }

  if (failures.length > 0) {
    throw new Error(`SBOM validation failed:\n- ${failures.join("\n- ")}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const workspaces = await loadListJson(args.fromListJson);
const sbom = createSbom(workspaces);
validateSbom(sbom);

if (args.output !== undefined) {
  await writeFile(args.output, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");
}

console.log(`SBOM check passed: ${sbom.components.length} component(s).`);
