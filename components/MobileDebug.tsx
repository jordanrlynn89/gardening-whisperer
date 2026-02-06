'use client';

import { useEffect } from 'react';

export function MobileDebug() {
  useEffect(() => {
    // Only load Eruda on mobile or when accessed via ngrok
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isNgrok = window.location.hostname.includes('ngrok');

    if (isMobile || isNgrok) {
      import('eruda').then((eruda) => {
        eruda.default.init();
        console.log('[MobileDebug] Eruda console loaded');
      });
    }
  }, []);

  return null;
}
