#!/usr/bin/env node
import { lstat, readdir, rm } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const workspaceDirs = ["apps", "packages"];
const generatedDirNames = ["dist", ".next", "coverage"];
const generatedRootDirs = [".next", "coverage", "dist", ".turbo"];
const scopeError = "Clean refused: a protected workspace scope is not a real directory.";
class ScopeRefusalError extends Error {}

async function removePath(targetPath) {
  await rm(targetPath, { force: true, recursive: true });
}

// readdir() は path 先頭の symlink を辿るため、scope root が symlink だと
// 別 directory(protected root を含む)の中身を rm -rf し得る。lstat で
// 実 directory を強制し、symlink/file は fail closed で拒否する。
async function requireRealDirectory(dirPath) {
  const metadata = await lstat(dirPath);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new ScopeRefusalError(scopeError);
  }
}

// 存在しない workspace root は no-op として skip する。symlink/file/権限
// エラーは「実 directory として安全に traverse できない」ため fail する。
async function optionalWorkspaceDirectory(dirPath) {
  try {
    await requireRealDirectory(dirPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

// Dirent は lstat ベースなので symlink 子 entry は isDirectory()=false で
// 既に除外される。残る消失 race(列挙後に消える/差し替わる)だけを許容し、
// それ以外の readdir 失敗は黙って skip せず fail する。
async function readDirectoryEntries(dirPath) {
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return null;
    }
    throw error;
  }
}

async function removeGeneratedDirs(baseDir) {
  const entries = await readDirectoryEntries(baseDir);
  if (entries === null) {
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

async function findTsBuildInfoFiles(dir) {
  const files = [];
  const entries = await readDirectoryEntries(dir);
  if (entries === null) {
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

async function main() {
  await requireRealDirectory(rootDir);

  for (const generatedRootDir of generatedRootDirs) {
    await removePath(path.join(rootDir, generatedRootDir));
  }

  for (const workspaceDir of workspaceDirs) {
    const workspacePath = path.join(rootDir, workspaceDir);
    if (await optionalWorkspaceDirectory(workspacePath)) {
      await removeGeneratedDirs(workspacePath);
    }
  }

  // ponytail: scope cache cleanup to tracked workspaces; add an explicit generated
  // root only if a tracked build starts emitting a root-level tsbuildinfo file.
  for (const workspaceDir of workspaceDirs) {
    const workspacePath = path.join(rootDir, workspaceDir);
    if (await optionalWorkspaceDirectory(workspacePath)) {
      for (const tsBuildInfoFile of await findTsBuildInfoFiles(workspacePath)) {
        await removePath(tsBuildInfoFile);
      }
    }
  }

  console.log("Generated artifacts removed.");
}

try {
  await main();
} catch (error) {
  // scope拒否は固定 message で報告する。それ以外(途中の EACCES/EPERM や
  // rm 失敗)を同じ文に潰すと、部分削除を拒否と誤認する — 区別して報告する。
  console.error(error instanceof ScopeRefusalError ? scopeError : error);
  process.exitCode = 1;
}
