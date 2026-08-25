import { describe, expect, it } from "vitest";

import { isPatientContextVisiblePath } from "./patient-context-route-policy";

describe("patient context route boundary", () => {
  it.each([
    "/",
    "/patients",
    "/patients/patient-1",
    "/prescriptions",
    "/prescriptions/draft-1",
    "/checkout",
    "/checkout/receipt-1",
  ])("keeps patient context on patient-scoped workspaces: %s", (pathname: string) => {
    expect(isPatientContextVisiblePath(pathname)).toBe(true);
  });

  it.each([
    "/claim-check",
    "/monthly-closing",
    "/masters",
    "/sync-status",
    "/admin",
    "/not-present",
  ])("suppresses patient PHI on batch and system workspaces: %s", (pathname: string) => {
    expect(isPatientContextVisiblePath(pathname)).toBe(false);
  });
});
