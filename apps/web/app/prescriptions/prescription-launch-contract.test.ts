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

describe("prescription launch URL contract", () => {
  it("keeps patient identity out of workflow URLs", () => {
    expect(pageSource).not.toContain("query.patientId");
    expect(launchSource).not.toContain("patientId=");
  });
});
