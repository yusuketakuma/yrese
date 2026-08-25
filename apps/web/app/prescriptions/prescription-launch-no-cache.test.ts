import { describe, expect, it } from "vitest";

import { parsePrescriptionLaunchContext } from "./prescription-launch-context";

describe("prescription launch cache identity", () => {
  it("keeps patient and reception identities in the parsed context", () => {
    const parsed = parsePrescriptionLaunchContext({
      receptionId: "reception-cache-a",
      patientId: "patient-cache-a",
      date: "2026-08-25",
    });

    expect(parsed).toMatchObject({
      status: "ready",
      context: {
        receptionId: "reception-cache-a",
        patientId: "patient-cache-a",
      },
    });
  });
});
