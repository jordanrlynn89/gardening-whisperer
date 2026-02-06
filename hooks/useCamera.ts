import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseCameraReturn {
  isActive: boolean;
  stream: MediaStream | null;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  capturePhoto: (videoElement: HTMLVideoElement) => Promise<string | null>;
}

export function useCamera(): UseCameraReturn {
  const [isActive, setIsActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsActive(true);
    } catch (err) {
      const error = err as DOMException | Error;

      if (error.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access.');
      } else if (error.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError(`Failed to access camera: ${error.message}`);
      }

      setIsActive(false);
      setStream(null);
    }
  }, []);

  const capturePhoto = useCallback(
    async (videoElement: HTMLVideoElement): Promise<string | null> => {
      console.log('[useCamera] Capturing photo...');

      if (!isActive || !streamRef.current) {
        console.error('[useCamera] Cannot capture - camera not active');
        return null;
      }

      const { videoWidth, videoHeight } = videoElement;

      if (videoWidth === 0 || videoHeight === 0) {
        console.error('[useCamera] Invalid video dimensions:', videoWidth, videoHeight);
        return null;
      }

      const canvas = document.createElement('canvas');
      canvas.width = videoWidth;
      canvas.height = videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('[useCamera] Failed to get canvas context');
        return null;
      }

      ctx.drawImage(videoElement, 0, 0);

      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      console.log('[useCamera] Photo captured, size:', imageData.length);

      return imageData;
    },
    [isActive]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    isActive,
    stream,
    error,
    startCamera,
    stopCamera,
    capturePhoto,
  };
}
