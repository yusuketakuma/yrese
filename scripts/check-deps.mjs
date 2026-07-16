#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const DEFAULT_AUDIT_LEVEL = "high";
const DEPENDENCY_AUDIT_FAILURE_MESSAGE =
  "Dependency audit failed: audit report or command result was invalid.";
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

class DependencyAuditFailure extends Error {}

function failDependencyAudit(message = DEPENDENCY_AUDIT_FAILURE_MESSAGE) {
  throw new DependencyAuditFailure(message);
}

function parseArgs(argv) {
  const args = {
    auditLevel: DEFAULT_AUDIT_LEVEL,
    fromAuditJson: undefined,
    fromAuditError: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--audit-level") {
      const value = argv.at(index + 1);
      if (value === undefined || value.startsWith("--")) failDependencyAudit();
      args.auditLevel = value;
      index += 1;
    } else if (arg === "--from-audit-json") {
      const value = argv.at(index + 1);
      if (value === undefined || value.startsWith("--")) failDependencyAudit();
      args.fromAuditJson = value;
      index += 1;
    } else if (arg === "--from-audit-error") {
      const value = argv.at(index + 1);
      if (value === undefined || value.startsWith("--")) failDependencyAudit();
      args.fromAuditError = value;
      index += 1;
    } else {
      failDependencyAudit();
    }
  }
  if (args.fromAuditJson !== undefined && args.fromAuditError !== undefined) {
    failDependencyAudit();
  }
  if (!SEVERITIES.includes(args.auditLevel)) {
    failDependencyAudit();
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
    failDependencyAudit();
  }

  const counts = report.metadata.vulnerabilities;
  for (const severity of SEVERITIES) {
    if (!Object.hasOwn(counts, severity) || !Number.isSafeInteger(counts[severity]) || counts[severity] < 0) {
      failDependencyAudit();
    }
  }
  return counts;
}

function isRegistryOrNetworkError(output) {
  return REGISTRY_OR_NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(output));
}

function assertNoThresholdVulnerabilities(counts, auditLevel) {
  let vulnerableCount = 0;
  for (const severity of thresholdSeverities(auditLevel)) {
    if (counts[severity] > Number.MAX_SAFE_INTEGER - vulnerableCount) {
      failDependencyAudit();
    }
    vulnerableCount += counts[severity];
  }
  if (vulnerableCount > 0) {
    failDependencyAudit(
      `Dependency audit failed: ${vulnerableCount} ${auditLevel}+ vulnerabilities found.`,
    );
  }
}

function inspectAuditReport(report, auditLevel) {
  const counts = validateVulnerabilityCounts(report);
  assertNoThresholdVulnerabilities(counts, auditLevel);
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
    let report;
    try {
      report = JSON.parse(await readFile(args.fromAuditJson, "utf8"));
    } catch {
      failDependencyAudit();
    }
    reportAuditPass(inspectAuditReport(report, args.auditLevel), args.auditLevel);
    return;
  }

  const result = runPnpmAudit(args.auditLevel);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error !== undefined) {
    failDependencyAudit();
  }
  if (result.signal !== null) {
    failDependencyAudit();
  }

  let report;
  let reportShapeError;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    reportShapeError = true;
  }
  let counts;
  if (reportShapeError === undefined) {
    try {
      counts = validateVulnerabilityCounts(report);
    } catch {
      reportShapeError = true;
    }
  }

  if (result.status !== 0 && reportShapeError !== undefined && isRegistryOrNetworkError(output)) {
    console.warn(REGISTRY_WARNING_MESSAGE);
    return;
  }
  if (reportShapeError !== undefined) {
    failDependencyAudit();
  }
  assertNoThresholdVulnerabilities(counts, args.auditLevel);
  if (result.status !== 0) {
    failDependencyAudit();
  }
  reportAuditPass(counts, args.auditLevel);
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof DependencyAuditFailure
      ? error.message
      : DEPENDENCY_AUDIT_FAILURE_MESSAGE,
  );
  process.exitCode = 1;
}
