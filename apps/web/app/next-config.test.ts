import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "../next.config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Next.js API rewrite (WP-4067)", () => {
  it("exposes only the narrow same-origin proxy in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(nextConfig.rewrites?.()).resolves.toEqual([
      {
        source: "/_yrese-api/:path*",
        destination: "http://127.0.0.1:3001/:path*",
      },
    ]);
  });

  it.each(["production", "test", "staging"])(
    "does not expose the proxy in %s",
    async (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);

      await expect(nextConfig.rewrites?.()).resolves.toEqual([]);
    },
  );
});
