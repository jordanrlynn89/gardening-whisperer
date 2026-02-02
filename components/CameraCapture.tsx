'use client';

import { useEffect, useRef } from 'react';
import { useCamera } from '@/hooks/useCamera';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isActive, stream, error, startCamera, stopCamera, capturePhoto } = useCamera();

  // Start camera on mount
  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleCapture = async () => {
    if (videoRef.current) {
      const imageData = await capturePhoto(videoRef.current);
      if (imageData) {
        onCapture(imageData);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Camera capture"
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-stone-900/80 backdrop-blur-sm">
        <h2 className="text-lg font-medium text-stone-100">
          Take a photo of your plant
        </h2>
        {isActive && (
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="p-2 text-stone-400 hover:text-stone-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Camera preview / Loading / Error states */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Loading state */}
        {!isActive && !error && (
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
            <p className="text-stone-400">Starting camera...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-300">{error}</p>
            <button
              onClick={onCancel}
              aria-label="Go Back"
              className="px-6 py-2 bg-stone-700 hover:bg-stone-600 rounded-lg text-stone-200 transition-colors"
            >
              Go Back
            </button>
          </div>
        )}

        {/* Video preview */}
        {isActive && stream && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Capture controls */}
      {isActive && stream && (
        <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center items-center bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center gap-8">
            {/* Cancel button */}
            <button
              onClick={onCancel}
              aria-label="Cancel"
              className="w-12 h-12 rounded-full bg-stone-800/80 border border-stone-600 flex items-center justify-center text-stone-300 hover:bg-stone-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Capture button - large touch target (80x80px = w-20 h-20) */}
            <button
              onClick={handleCapture}
              aria-label="Capture photo"
              className="w-20 h-20 rounded-full bg-white border-4 border-green-500 flex items-center justify-center hover:bg-green-50 active:scale-95 transition-all shadow-xl"
            >
              <div className="w-16 h-16 rounded-full bg-green-500" />
            </button>

            {/* Placeholder for symmetry */}
            <div className="w-12 h-12" />
          </div>
        </div>
      )}
    </div>
  );
}
