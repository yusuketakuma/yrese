import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("./[receptionId]/page.tsx", import.meta.url),
  "utf8",
);
const launchSource = readFileSync(
  new URL("../reception-prescription-launch.tsx", import.meta.url),
  "utf8",
);
const routeSource = readFileSync(
  new URL("./prescription-launch-route.tsx", import.meta.url),
  "utf8",
);
const receptionBoundarySource = readFileSync(
  new URL("./prescription-reception-boundary.tsx", import.meta.url),
  "utf8",
);
const workspaceSource = readFileSync(
  new URL("./prescription-workspace.tsx", import.meta.url),
  "utf8",
);

describe("prescription launch URL contract", () => {
  it("keeps patient identity out of workflow URLs and launch diagnostics", () => {
    expect(pageSource).not.toContain("query.patientId");
    expect(launchSource).not.toContain("patientId=");
    expect(routeSource).not.toContain("data-patient-id");
  });

  it("routes every verified result through the existing guarded handoff", () => {
    expect(launchSource).toContain("<ReceptionPrescriptionHandoffAction");
    expect(launchSource).not.toContain("href={`/prescriptions/");
    expect(routeSource).toContain("<ReceptionPrescriptionHandoffAction");
    expect(routeSource).not.toContain("<PrescriptionWorkspace");
  });

  it("does not present an unapproved workflow or a stale conflict version", () => {
    expect(receptionBoundarySource).not.toContain("PrescriptionWorkflowProgress");
    expect(workspaceSource).not.toContain(
      "競合・サーバー版 v${serverVersion}",
    );
    expect(workspaceSource).toContain("競合・再読込が必要");
  });
});
