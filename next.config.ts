import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA configuration can be added here later using next-pwa
  allowedDevOrigins: [
    "192.168.*",
    "10.*",
    "172.16.*",
    "*.share.zrok.io",
    "*.ngrok-free.dev",
  ],
};

export default nextConfig;
