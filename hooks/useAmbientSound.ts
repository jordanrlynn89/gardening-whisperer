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

  // No eager loading — audio is created on demand in startAmbient()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearFadeInterval();
      birdsAudioRef.current?.pause();
      birdsAudioRef.current = null;
    };
  }, [clearFadeInterval]);

  const startAmbient = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    // Lazy load audio on first use
    if (!birdsAudioRef.current) {
      const audio = new Audio('/sounds/birds-loop.mp3');
      audio.loop = true;
      audio.volume = 0;
      audio.onerror = () => console.log('[useAmbientSound] Failed to load birds-loop.mp3');
      birdsAudioRef.current = audio;
    }

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
