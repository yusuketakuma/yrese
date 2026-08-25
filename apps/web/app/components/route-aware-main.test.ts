import { describe, expect, it } from "vitest";

import { isWideWorkspaceRoute } from "./route-aware-main";

describe("isWideWorkspaceRoute", () => {
  it.each(["/admin", "/admin/users", "/admin/permissions"])(
    "widens the administration workspace on %s",
    (pathname) => {
      expect(isWideWorkspaceRoute(pathname)).toBe(true);
    },
  );

  it.each(["/", "/patients", "/prescriptions", "/claim-check", "/sync-status"])(
    "preserves the legacy canvas on %s",
    (pathname) => {
      expect(isWideWorkspaceRoute(pathname)).toBe(false);
    },
  );
});
