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
});
