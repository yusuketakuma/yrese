import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // NextのTypeScript API検査は6、shellのtscは7という既存分離を維持する。
  experimental: { useTypeScriptCli: false },
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }
    return [
      {
        source: "/_yrese-api/:path*",
        destination: "http://127.0.0.1:3001/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  // 共通モジュールは TS ソースをそのまま export しているためトランスパイル対象にする
  transpilePackages: [
    "@yrese/shared-kernel",
    "@yrese/contracts",
    "@yrese/date-time",
    "@yrese/trace",
  ],
  webpack: (config) => {
    // 共通モジュールは NodeNext 形式(./x.js)で相互 import するため、.js → .ts 解決を許可する
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
