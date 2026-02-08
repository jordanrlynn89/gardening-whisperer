import { useRef, useCallback, useEffect } from 'react';

interface UseAmbientSoundOptions {
  volume?: number;
  duckingVolume?: number;
}

interface UseAmbientSoundReturn {
  startAmbient: () => void;
  stopAmbient: () => void;
  duck: () => void;
  unduck: () => void;
}

export function useAmbientSound({
  volume = 0.15,
  duckingVolume = 0.05,
}: UseAmbientSoundOptions = {}): UseAmbientSoundReturn {
  const birdsAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up fade interval helper
  const clearFadeInterval = useCallback(() => {
    if (fadeIntervalRef.current !== null) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  }, []);

  // Create Audio element on mount so the browser can preload it.
  // Desktop Chrome requires this — lazily-created Audio elements can be
  // blocked by autoplay policy even with a user gesture.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Trimmed 30s loop (586 KB) — created by `node scripts/trim-audio.js`
    const audio = new Audio('/sounds/birds-loop.mp3');
    audio.loop = true;
    audio.volume = volume;
    birdsAudioRef.current = audio;

    return () => {
      clearFadeInterval();
      birdsAudioRef.current?.pause();
      birdsAudioRef.current = null;
    };
  }, [volume, clearFadeInterval]);

  const startAmbient = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    if (birdsAudioRef.current) {
      clearFadeInterval();
      birdsAudioRef.current.volume = 0;
      birdsAudioRef.current.play().catch((err) => {
        console.warn('[useAmbientSound] play() failed:', err.message);
      });

      let vol = 0;
      fadeIntervalRef.current = setInterval(() => {
        vol += 0.01;
        if (vol >= volume) {
          vol = volume;
          clearFadeInterval();
        }
        if (birdsAudioRef.current) {
          birdsAudioRef.current.volume = vol;
        }
      }, 50);
    }
  }, [volume, clearFadeInterval]);

  const stopAmbient = useCallback(() => {
    isPlayingRef.current = false;

    if (!birdsAudioRef.current) return;

    clearFadeInterval();
    const audio = birdsAudioRef.current;
    let vol = audio.volume;
    fadeIntervalRef.current = setInterval(() => {
      vol -= 0.01;
      if (vol <= 0) {
        vol = 0;
        audio.pause();
        audio.currentTime = 0;
        clearFadeInterval();
      }
      audio.volume = vol;
    }, 30);
  }, [clearFadeInterval]);

  const duck = useCallback(() => {
    if (birdsAudioRef.current) {
      birdsAudioRef.current.volume = duckingVolume;
    }
  }, [duckingVolume]);

  const unduck = useCallback(() => {
    if (birdsAudioRef.current) {
      birdsAudioRef.current.volume = volume;
    }
  }, [volume]);

  return {
    startAmbient,
    stopAmbient,
    duck,
    unduck,
  };
}
