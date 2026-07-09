import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 共通モジュールは TS ソースをそのまま export しているためトランスパイル対象にする
  transpilePackages: ["@yrese/shared-kernel", "@yrese/contracts"],
  webpack: (config) => {
    // 共通モジュールは NodeNext 形式(./x.js)で相互 import するため、.js → .ts 解決を許可する
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
