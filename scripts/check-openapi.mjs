#!/usr/bin/env node
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";

import { defaultOpenApiPath, renderOpenApiYaml } from "./openapi-renderer.mjs";

const artifactScopeErrorMessage =
  "GENERATED_CODE_DRIFT_BLOCKED: OpenAPI generated artifact target must be a readable real regular file.";

class ArtifactScopeError extends Error {}

function failArtifactScope() {
  throw new ArtifactScopeError(artifactScopeErrorMessage);
}

function parseArgs(argv) {
  const args = { openapiFile: defaultOpenApiPath };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--openapi-file") {
      args.openapiFile = argv.at(index + 1) ?? "";
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (args.openapiFile.length === 0) {
    throw new Error("--openapi-file must not be empty");
  }
  return args;
}

async function readArtifact(filePath) {
  let handle;
  let source;
  let failed = false;

  try {
    if (typeof constants.O_NOFOLLOW !== "number" || typeof constants.O_NONBLOCK !== "number") {
      failed = true;
    } else {
      const pathStats = await lstat(filePath);
      if (pathStats.isSymbolicLink() || !pathStats.isFile()) {
        failed = true;
      } else {
        handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        const handleStats = await handle.stat();
        if (!handleStats.isFile()) {
          failed = true;
        } else {
          source = await handle.readFile({ encoding: "utf8" });
        }
      }
    }
  } catch {
    failed = true;
  }

  if (handle !== undefined) {
    try {
      await handle.close();
    } catch {
      failed = true;
    }
  }

  if (failed || source === undefined) {
    failArtifactScope();
  }
  return source;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const openapiFile = path.resolve(args.openapiFile);
  const actual = await readArtifact(openapiFile);
  const expected = await renderOpenApiYaml();

  if (actual !== expected) {
    console.error("GENERATED_CODE_DRIFT_BLOCKED: OpenAPI generated artifact drift detected.");
    console.error("Run `pnpm generate:openapi` and commit the updated docs/api/openapi.yaml with its schema source.");
    process.exitCode = 1;
  } else {
    console.log(`OpenAPI drift check passed: ${path.relative(process.cwd(), openapiFile)}`);
  }
}

try {
  await main();
} catch (error) {
  if (!(error instanceof ArtifactScopeError)) throw error;
  console.error(artifactScopeErrorMessage);
  process.exitCode = 1;
}
