import { describe, expect, it } from "vitest";

import { shouldShowPatientContext } from "./scoped-patient-context-bar";

describe("shouldShowPatientContext", () => {
  it.each([
    "/",
    "/patients",
    "/patients/patient-1",
    "/prescriptions",
    "/prescriptions/current",
    "/checkout",
    "/checkout/receipt",
  ])("shows patient context on %s", (pathname) => {
    expect(shouldShowPatientContext(pathname)).toBe(true);
  });

  it.each([
    "/admin",
    "/admin/users",
    "/claim-check",
    "/monthly-closing",
    "/masters",
    "/sync-status",
  ])("suppresses patient context on %s", (pathname) => {
    expect(shouldShowPatientContext(pathname)).toBe(false);
  });
});
