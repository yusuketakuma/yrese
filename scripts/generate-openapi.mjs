#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { defaultOpenApiPath, renderOpenApiYaml } from "./openapi-renderer.mjs";

function parseArgs(argv) {
  const args = { output: defaultOpenApiPath };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") {
      args.output = argv.at(index + 1) ?? "";
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (args.output.length === 0) {
    throw new Error("--output must not be empty");
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const outputPath = path.resolve(args.output);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, await renderOpenApiYaml(), "utf8");

console.log(`Generated OpenAPI document: ${path.relative(process.cwd(), outputPath)}`);
