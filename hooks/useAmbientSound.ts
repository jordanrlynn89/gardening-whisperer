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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio('/sounds/birds.mp3');
    audio.loop = true;
    audio.volume = volume;
    audio.onerror = () => {
      console.log('Audio file not found: /sounds/birds.mp3');
    };
    birdsAudioRef.current = audio;

    return () => {
      birdsAudioRef.current?.pause();
      birdsAudioRef.current = null;
    };
  }, [volume]);

  const startAmbient = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    if (birdsAudioRef.current) {
      birdsAudioRef.current.volume = 0;
      birdsAudioRef.current.play().catch(() => {});

      let vol = 0;
      const fadeIn = setInterval(() => {
        vol += 0.01;
        if (vol >= volume) {
          vol = volume;
          clearInterval(fadeIn);
        }
        if (birdsAudioRef.current) {
          birdsAudioRef.current.volume = vol;
        }
      }, 50);
    }
  }, [volume]);

  const stopAmbient = useCallback(() => {
    isPlayingRef.current = false;

    if (!birdsAudioRef.current) return;

    const audio = birdsAudioRef.current;
    let vol = audio.volume;
    const fadeOut = setInterval(() => {
      vol -= 0.01;
      if (vol <= 0) {
        vol = 0;
        audio.pause();
        audio.currentTime = 0;
        clearInterval(fadeOut);
      }
      audio.volume = vol;
    }, 30);
  }, []);

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
