#!/usr/bin/env node
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const workspaceDirs = ["apps", "packages"];
const generatedDirNames = ["dist", ".next", "coverage"];
const generatedRootDirs = [".next", "coverage", "dist", ".turbo"];

async function removePath(targetPath) {
  await rm(targetPath, { force: true, recursive: true });
}

async function removeGeneratedDirs(baseDir) {
  let entries;
  try {
    entries = await readdir(baseDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(baseDir, entry.name);
    for (const generatedDirName of generatedDirNames) {
      await removePath(path.join(entryPath, generatedDirName));
    }
  }
}

for (const generatedRootDir of generatedRootDirs) {
  await removePath(path.join(rootDir, generatedRootDir));
}

for (const workspaceDir of workspaceDirs) {
  await removeGeneratedDirs(path.join(rootDir, workspaceDir));
}

for (const tsBuildInfoFile of await findTsBuildInfoFiles(rootDir)) {
  await removePath(tsBuildInfoFile);
}

console.log("Generated artifacts removed.");

async function findTsBuildInfoFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }

    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findTsBuildInfoFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".tsbuildinfo")) {
      files.push(entryPath);
    }
  }

  return files;
}
