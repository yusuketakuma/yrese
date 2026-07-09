#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const DEFAULT_AUDIT_LEVEL = "high";

function parseArgs(argv) {
  const args = {
    auditLevel: DEFAULT_AUDIT_LEVEL,
    fromAuditJson: undefined,
    fromAuditError: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--audit-level") {
      args.auditLevel = argv.at(index + 1) ?? "";
      index += 1;
    } else if (arg === "--from-audit-json") {
      args.fromAuditJson = argv.at(index + 1);
      index += 1;
    } else if (arg === "--from-audit-error") {
      args.fromAuditError = argv.at(index + 1);
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!SEVERITIES.includes(args.auditLevel)) {
    throw new Error(`invalid audit level: ${args.auditLevel}`);
  }
  return args;
}

function runPnpmAudit(auditLevel) {
  return spawnSync("pnpm", ["audit", "--audit-level", auditLevel, "--json"], {
    encoding: "utf8",
  });
}

function thresholdSeverities(auditLevel) {
  return SEVERITIES.slice(SEVERITIES.indexOf(auditLevel));
}

function countThresholdVulnerabilities(report, auditLevel) {
  const counts = report?.metadata?.vulnerabilities ?? {};
  return thresholdSeverities(auditLevel).reduce((sum, severity) => sum + Number(counts[severity] ?? 0), 0);
}

function advisorySummary(report, auditLevel) {
  const severities = new Set(thresholdSeverities(auditLevel));
  return Object.values(report?.advisories ?? {})
    .filter((advisory) => severities.has(advisory?.severity))
    .map((advisory) => {
      const moduleName = advisory.module_name ?? "unknown-module";
      const severity = advisory.severity ?? "unknown-severity";
      const id = advisory.github_advisory_id ?? advisory.id ?? "unknown-id";
      return `${moduleName} ${severity} ${id}`;
    });
}

function isRegistryOrNetworkError(output) {
  return [
    "ERR_PNPM_META_FETCH_FAIL",
    "ERR_PNPM_FETCH",
    "ENOTFOUND",
    "ECONNRESET",
    "ECONNREFUSED",
    "EAI_AGAIN",
    "ETIMEDOUT",
    "ESOCKETTIMEDOUT",
    "registry",
    "network",
    "socket",
    "timeout",
  ].some((pattern) => output.toLowerCase().includes(pattern.toLowerCase()));
}

function validateAuditReport(report, auditLevel) {
  const vulnerableCount = countThresholdVulnerabilities(report, auditLevel);
  if (vulnerableCount > 0) {
    const summaries = advisorySummary(report, auditLevel);
    const details = summaries.length > 0 ? `\n- ${summaries.join("\n- ")}` : "";
    throw new Error(`dependency audit failed: ${vulnerableCount} ${auditLevel}+ vulnerabilit(ies) found${details}`);
  }
  const counts = report?.metadata?.vulnerabilities ?? {};
  console.log(
    `Dependency audit passed (${auditLevel}+): high=${Number(counts.high ?? 0)}, critical=${Number(
      counts.critical ?? 0,
    )}.`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.fromAuditError !== undefined) {
    const output = await readFile(args.fromAuditError, "utf8");
    if (!isRegistryOrNetworkError(output)) {
      throw new Error(`dependency audit failed for non-registry error:\n${output.trim()}`);
    }
    console.warn(`Dependency audit registry/network warning (non-blocking): ${output.trim()}`);
    return;
  }

  if (args.fromAuditJson !== undefined) {
    validateAuditReport(JSON.parse(await readFile(args.fromAuditJson, "utf8")), args.auditLevel);
    return;
  }

  const result = runPnpmAudit(args.auditLevel);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  try {
    validateAuditReport(JSON.parse(result.stdout), args.auditLevel);
  } catch (error) {
    if (result.status !== 0 && isRegistryOrNetworkError(output) && result.stdout.trim().length === 0) {
      console.warn(`Dependency audit registry/network warning (non-blocking): ${output.trim()}`);
      return;
    }
    throw error;
  }
}

await main();
