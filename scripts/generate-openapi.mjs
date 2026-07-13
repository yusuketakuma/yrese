#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
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
const source = await renderOpenApiYaml();
let temporaryPath;
let published = false;

try {
  const outputDirectory = path.dirname(outputPath);
  await mkdir(outputDirectory, { recursive: true });
  temporaryPath = path.join(outputDirectory, `.yrese-openapi-${process.pid}-${randomUUID()}.tmp`);
  await writeFile(temporaryPath, source, { encoding: "utf8", flag: "wx", mode: 0o644 });
  await rename(temporaryPath, outputPath);
  temporaryPath = undefined;
  published = true;
} catch {
  if (temporaryPath !== undefined) {
    try {
      await rm(temporaryPath, { force: true });
    } catch {
      // Best-effort cleanup; publication failure remains the primary error.
    }
  }
  console.error("OpenAPI generation could not publish the generated artifact.");
  process.exitCode = 1;
}

if (published) {
  console.log(`Generated OpenAPI document: ${path.relative(process.cwd(), outputPath)}`);
}
