import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA configuration can be added here later using next-pwa
  allowedDevOrigins: [
    "*.share.zrok.io",
    "*.ngrok-free.dev",
  ],
};

export default nextConfig;
