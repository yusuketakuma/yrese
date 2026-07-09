import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { stringify } from "yaml";

import { createYreseOpenApiDocument } from "../packages/contracts/src/openapi.ts";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const defaultOpenApiPath = path.join(repoRoot, "docs", "api", "openapi.yaml");

async function packageVersion(packageJsonPath) {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  return String(packageJson.version);
}

export async function openApiGeneratedHeader() {
  const zodOpenApiPackageJsonPath = require.resolve("zod-openapi/package.json");
  const zodOpenApiVersion = await packageVersion(zodOpenApiPackageJsonPath);

  return [
    "# GENERATED - DO NOT EDIT.",
    "# 手編集禁止・再生成のみ。",
    "# Source: packages/contracts/src/openapi.ts and @yrese/contracts zod schemas.",
    "# Regenerate: pnpm generate:openapi",
    `# Tool: zod-openapi@${zodOpenApiVersion}`,
    "",
  ].join("\n");
}

export async function renderOpenApiYaml() {
  const document = createYreseOpenApiDocument();
  const yaml = stringify(document, {
    lineWidth: 120,
    singleQuote: false,
  });

  return `${await openApiGeneratedHeader()}${yaml}`;
}
