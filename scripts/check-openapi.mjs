#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

import { defaultOpenApiPath, renderOpenApiYaml } from "./openapi-renderer.mjs";

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

const args = parseArgs(process.argv.slice(2));
const openapiFile = path.resolve(args.openapiFile);
const [expected, actual] = await Promise.all([renderOpenApiYaml(), readFile(openapiFile, "utf8")]);

if (actual !== expected) {
  console.error("GENERATED_CODE_DRIFT_BLOCKED: OpenAPI generated artifact drift detected.");
  console.error("Run `pnpm generate:openapi` and commit the updated docs/api/openapi.yaml with its schema source.");
  process.exitCode = 1;
} else {
  console.log(`OpenAPI drift check passed: ${path.relative(process.cwd(), openapiFile)}`);
}
