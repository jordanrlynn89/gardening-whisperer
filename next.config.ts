import type { NextConfig } from "next";
import { networkInterfaces } from "os";

// Collect all local network IPs so any device on the LAN can reach dev server
function getLocalIPs(): string[] {
  const ips: string[] = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    ...getLocalIPs(),
    "*.share.zrok.io",
    "*.ngrok-free.dev",
  ],
};

export default nextConfig;
