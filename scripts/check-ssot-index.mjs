#!/usr/bin/env node
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(process.argv[2] ?? process.cwd());
const docsDir = path.join(rootDir, "docs");
const indexPath = path.join(docsDir, "ssot_index.md");
const indexRelativePath = "docs/ssot_index.md";
const markdownExtension = ".md";
// 非SSOT領域: 提案・調査・レビュー用の作業文書(PRC-007 で定義)。SSOT index の追跡対象外とし、
// ssot_id 必須・index 登録の規律を適用しない(APPROVED SSOT の正本性を汚さないため)。
// docs/ui-ux-refresh/: UI/UX 監査・SSOT再構築の作業/証跡ワークスペース(規範SSOTは docs/uiux/ 側が正本)。
const nonSsotDirPrefixes = ["docs/research/", "docs/ui-ux-refresh/"];
const violations = [];
const scopeErrorMessage = "SSOT index check could not validate the protected documentation scope.";

class ProtectedScopeError extends Error {}

function failScope() {
  throw new ProtectedScopeError(scopeErrorMessage);
}

function isNonSsotDoc(relativePath) {
  return nonSsotDirPrefixes.some((prefix) => relativePath.startsWith(prefix));
}

function report(message) {
  violations.push(message);
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

async function listMarkdownFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    failScope();
  }
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      failScope();
    }
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && path.extname(entry.name) === markdownExtension) {
      files.push(entryPath);
    } else if (!entry.isFile()) {
      failScope();
    }
  }

  return files;
}

async function requireRealPath(targetPath, kind) {
  let entry;
  try {
    entry = await lstat(targetPath);
  } catch {
    failScope();
  }
  if (entry.isSymbolicLink() || (kind === "directory" ? !entry.isDirectory() : !entry.isFile())) {
    failScope();
  }
}

async function readProtectedFile(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    failScope();
  }
}

function stripInlineComment(value) {
  const commentIndex = value.indexOf(" #");
  return commentIndex === -1 ? value : value.slice(0, commentIndex);
}

function parseFrontmatter(source, relativePath) {
  const match = /```yaml\s*\n([\s\S]*?)\n```/.exec(source);
  if (match === null) {
    report(`${relativePath}: missing yaml frontmatter block`);
    return undefined;
  }

  const values = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (field === null) {
      continue;
    }

    const value = stripInlineComment(field[2]).trim().replace(/^["']|["']$/g, "");
    values.set(field[1], value);
  }

  const ssotId = values.get("ssot_id");
  const status = values.get("status");
  if (ssotId === undefined || ssotId.length === 0) {
    report(`${relativePath}: frontmatter ssot_id is required`);
  }
  if (status === undefined || status.length === 0) {
    report(`${relativePath}: frontmatter status is required`);
  }

  return ssotId === undefined || status === undefined
    ? undefined
    : {
        ssotId,
        status,
      };
}

function parseIndex(source) {
  const totalMatch = /総文書数:\s*(\d+)\(本索引を除く\)/.exec(source);
  if (totalMatch === null) {
    report(`${indexRelativePath}: total document count line is required`);
  }

  const sectionCounts = new Map();
  const sectionRows = new Map();
  const entries = [];
  let currentSection;

  for (const line of source.split(/\r?\n/)) {
    const sectionMatch = /^## docs\/([^/]+)\/ \((\d+)件\)$/.exec(line);
    if (sectionMatch !== null) {
      currentSection = sectionMatch[1];
      if (sectionCounts.has(currentSection)) {
        report(`${indexRelativePath}: duplicate section docs/${currentSection}/`);
      }
      sectionCounts.set(currentSection, Number(sectionMatch[2]));
      sectionRows.set(currentSection, 0);
      continue;
    }

    const rowMatch = /^\|\s*([^|]+?)\s*\|\s*\[([^\]]+)\]\(([^)]+\.md)\)\s*\|\s*([^|]+?)\s*\|$/.exec(line);
    if (rowMatch === null || rowMatch[1] === "ssot_id") {
      continue;
    }

    if (currentSection === undefined) {
      report(`${indexRelativePath}: index row appears before a docs/<section>/ heading: ${line}`);
      continue;
    }

    const linkPath = rowMatch[3].trim();
    const relativePath = toPosix(path.normalize(path.join("docs", linkPath)));
    entries.push({
      ssotId: rowMatch[1].trim(),
      label: rowMatch[2].trim(),
      relativePath,
      section: currentSection,
      status: rowMatch[4].trim(),
    });
    sectionRows.set(currentSection, (sectionRows.get(currentSection) ?? 0) + 1);
  }

  for (const [section, expectedCount] of sectionCounts) {
    const actualCount = sectionRows.get(section) ?? 0;
    if (actualCount !== expectedCount) {
      report(`${indexRelativePath}: docs/${section}/ count mismatch: header=${expectedCount}, rows=${actualCount}`);
    }
  }

  return {
    entries,
    totalCount: totalMatch === null ? undefined : Number(totalMatch[1]),
  };
}

function findDuplicateValues(items, getValue) {
  const seen = new Map();
  const duplicates = [];
  for (const item of items) {
    const value = getValue(item);
    const existing = seen.get(value);
    if (existing !== undefined) {
      duplicates.push([value, existing, item]);
      continue;
    }
    seen.set(value, item);
  }
  return duplicates;
}

function expectedIndexOrder(entries) {
  return [...entries].sort((left, right) => {
    const leftPath = left.relativePath.replace(/^docs\//, "");
    const rightPath = right.relativePath.replace(/^docs\//, "");
    return leftPath.localeCompare(rightPath);
  });
}

function checkOrder(indexEntries, documentEntries) {
  const expected = expectedIndexOrder(documentEntries).map((entry) => entry.relativePath);
  const actual = indexEntries.map((entry) => entry.relativePath);
  if (expected.length !== actual.length) {
    return;
  }

  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index] !== actual[index]) {
      report(
        `${indexRelativePath}: index order mismatch at row ${index + 1}: expected ${expected[index]}, got ${actual[index]}`,
      );
      return;
    }
  }
}

function checkDuplicates(label, entries, getValue, formatEntry) {
  for (const [value, first, second] of findDuplicateValues(entries, getValue)) {
    report(`${label}: duplicate ${value} in ${formatEntry(first)} and ${formatEntry(second)}`);
  }
}

async function main() {
  await requireRealPath(rootDir, "directory");
  await requireRealPath(docsDir, "directory");
  await requireRealPath(indexPath, "file");
  const markdownFiles = (await listMarkdownFiles(docsDir))
    .map((filePath) => ({
      absolutePath: filePath,
      relativePath: toPosix(path.relative(rootDir, filePath)),
    }))
    .filter((file) => file.relativePath !== indexRelativePath)
    .filter((file) => !isNonSsotDoc(file.relativePath))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  if (markdownFiles.length === 0) failScope();

  const documentEntries = [];
  for (const file of markdownFiles) {
    const metadata = parseFrontmatter(await readProtectedFile(file.absolutePath), file.relativePath);
    if (metadata !== undefined) {
      documentEntries.push({
        ...metadata,
        relativePath: file.relativePath,
      });
    }
  }

  const index = parseIndex(await readProtectedFile(indexPath));
  const indexByPath = new Map(index.entries.map((entry) => [entry.relativePath, entry]));
  const documentByPath = new Map(documentEntries.map((entry) => [entry.relativePath, entry]));

  if (index.totalCount !== undefined && index.totalCount !== markdownFiles.length) {
    report(`${indexRelativePath}: total document count mismatch: index=${index.totalCount}, docs=${markdownFiles.length}`);
  }

  checkDuplicates("docs frontmatter", documentEntries, (entry) => entry.ssotId, (entry) => entry.relativePath);
  checkDuplicates(indexRelativePath, index.entries, (entry) => entry.ssotId, (entry) => entry.relativePath);
  checkDuplicates(indexRelativePath, index.entries, (entry) => entry.relativePath, (entry) => entry.ssotId);

  for (const documentEntry of documentEntries) {
    const indexEntry = indexByPath.get(documentEntry.relativePath);
    if (indexEntry === undefined) {
      report(`${documentEntry.relativePath}: missing from ${indexRelativePath}; regenerate the SSOT index`);
      continue;
    }

    if (indexEntry.ssotId !== documentEntry.ssotId) {
      report(
        `${documentEntry.relativePath}: ssot_id mismatch: frontmatter=${documentEntry.ssotId}, index=${indexEntry.ssotId}`,
      );
    }
    if (indexEntry.status !== documentEntry.status) {
      report(`${documentEntry.relativePath}: status mismatch: frontmatter=${documentEntry.status}, index=${indexEntry.status}`);
    }

    const expectedLabel = path.basename(documentEntry.relativePath);
    if (indexEntry.label !== expectedLabel) {
      report(`${documentEntry.relativePath}: index label mismatch: expected ${expectedLabel}, got ${indexEntry.label}`);
    }
  }

  for (const indexEntry of index.entries) {
    if (!documentByPath.has(indexEntry.relativePath)) {
      report(`${indexRelativePath}: indexed document does not exist: ${indexEntry.relativePath}; regenerate the SSOT index`);
    }
  }

  checkOrder(index.entries, documentEntries);

  if (violations.length > 0) {
    console.error(`SSOT index check failed with ${violations.length} violation(s):`);
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    console.error("Run the approved SSOT index regeneration workflow before committing document changes.");
    process.exitCode = 1;
  } else {
    if (index.entries.length === 0) {
      failScope();
    }
    console.log(`SSOT index check passed: ${markdownFiles.length} document(s).`);
  }
}

try {
  await main();
} catch (error) {
  if (!(error instanceof ProtectedScopeError)) throw error;
  console.error(scopeErrorMessage);
  process.exitCode = 1;
}
