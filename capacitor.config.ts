import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gardeningwhisperer.app',
  appName: 'Gardening Whisperer',
  webDir: 'out',
  // No server URL - use local static build to avoid Safari redirect
};

export default config;
