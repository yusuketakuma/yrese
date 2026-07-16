#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const DEFAULT_AUDIT_LEVEL = "high";
const CAPTURED_AUDIT_ERROR_MESSAGE =
  "Dependency audit failed: captured audit error was not a recognized transient.";
const REGISTRY_WARNING_MESSAGE =
  "Dependency audit registry/network warning (non-blocking): recognized transient error code.";
const REGISTRY_OR_NETWORK_ERROR_PATTERNS = [
  /\bERR_PNPM_META_FETCH_FAIL\b/i,
  /\bERR_PNPM_FETCH(?:_[A-Z0-9]+)*\b/i,
  /\bENOTFOUND\b/i,
  /\bECONNRESET\b/i,
  /\bECONNREFUSED\b/i,
  /\bEAI_AGAIN\b/i,
  /\bETIMEDOUT\b/i,
  /\bESOCKETTIMEDOUT\b/i,
];

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

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateVulnerabilityCounts(report) {
  if (
    !isPlainObject(report) ||
    Object.hasOwn(report, "error") ||
    !isPlainObject(report.metadata) ||
    !isPlainObject(report.metadata.vulnerabilities)
  ) {
    throw new Error("invalid dependency audit report: expected pnpm vulnerability metadata");
  }

  const counts = report.metadata.vulnerabilities;
  for (const severity of SEVERITIES) {
    if (!Object.hasOwn(counts, severity) || !Number.isSafeInteger(counts[severity]) || counts[severity] < 0) {
      throw new Error("invalid dependency audit report: vulnerability counts must be non-negative safe integers");
    }
  }
  return counts;
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
  return REGISTRY_OR_NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(output));
}

function assertNoThresholdVulnerabilities(report, counts, auditLevel) {
  const vulnerableCount = thresholdSeverities(auditLevel).reduce((sum, severity) => sum + counts[severity], 0);
  if (vulnerableCount > 0) {
    const summaries = advisorySummary(report, auditLevel);
    const details = summaries.length > 0 ? `\n- ${summaries.join("\n- ")}` : "";
    throw new Error(`dependency audit failed: ${vulnerableCount} ${auditLevel}+ vulnerabilit(ies) found${details}`);
  }
}

function inspectAuditReport(report, auditLevel) {
  const counts = validateVulnerabilityCounts(report);
  assertNoThresholdVulnerabilities(report, counts, auditLevel);
  return counts;
}

function reportAuditPass(counts, auditLevel) {
  console.log(
    `Dependency audit passed (${auditLevel}+): high=${counts.high}, critical=${counts.critical}.`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.fromAuditError !== undefined) {
    let output;
    try {
      output = await readFile(args.fromAuditError, "utf8");
    } catch {
      console.error(CAPTURED_AUDIT_ERROR_MESSAGE);
      process.exitCode = 1;
      return;
    }
    if (!isRegistryOrNetworkError(output)) {
      console.error(CAPTURED_AUDIT_ERROR_MESSAGE);
      process.exitCode = 1;
      return;
    }
    console.warn(REGISTRY_WARNING_MESSAGE);
    return;
  }

  if (args.fromAuditJson !== undefined) {
    const report = JSON.parse(await readFile(args.fromAuditJson, "utf8"));
    reportAuditPass(inspectAuditReport(report, args.auditLevel), args.auditLevel);
    return;
  }

  const result = runPnpmAudit(args.auditLevel);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error !== undefined) {
    throw new Error("dependency audit command failed to execute");
  }
  if (result.signal !== null) {
    throw new Error("dependency audit command terminated by signal");
  }

  let report;
  let reportShapeError;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    reportShapeError = new Error("invalid dependency audit report: pnpm audit did not return JSON", { cause: error });
  }
  let counts;
  if (reportShapeError === undefined) {
    try {
      counts = validateVulnerabilityCounts(report);
    } catch (error) {
      reportShapeError = error;
    }
  }

  if (result.status !== 0 && reportShapeError !== undefined && isRegistryOrNetworkError(output)) {
    console.warn(REGISTRY_WARNING_MESSAGE);
    return;
  }
  if (reportShapeError !== undefined) {
    throw reportShapeError;
  }
  assertNoThresholdVulnerabilities(report, counts, args.auditLevel);
  if (result.status !== 0) {
    throw new Error("dependency audit command failed with a nonzero exit status");
  }
  reportAuditPass(counts, args.auditLevel);
}

await main();
