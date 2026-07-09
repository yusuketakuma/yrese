import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 共通モジュールは TS ソースをそのまま export しているためトランスパイル対象にする
  transpilePackages: ["@yrese/shared-kernel"],
};

export default nextConfig;
