'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCamera } from '@/hooks/useCamera';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
  onCaptureReady?: (fn: () => void) => void;
}

export function CameraCapture({ onCapture, onCancel, onCaptureReady }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isActive, stream, error, startCamera, stopCamera, capturePhoto } = useCamera();
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState(false);
  const isCapturingRef = useRef(false);

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

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || isCapturingRef.current) return;
    isCapturingRef.current = true;
    setIsCapturing(true);
    const imageData = await capturePhoto(videoRef.current);
    isCapturingRef.current = false;
    setIsCapturing(false);
    if (!imageData) {
      setCaptureError(true);
      setTimeout(() => setCaptureError(false), 2000);
      return;
    }
    onCapture(imageData);
  }, [capturePhoto, onCapture]);

  // Expose capture fn to parent for voice commands
  useEffect(() => {
    if (isActive && onCaptureReady) {
      onCaptureReady(handleCapture);
    }
  }, [isActive, onCaptureReady, handleCapture]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Camera capture"
      className="fixed inset-0 z-50 bg-pixel-bg flex flex-col overflow-hidden sheet-slide-up"
    >
      {/* Header - Pixel system sheet style */}
      <div className="px-6 py-4 bg-pixel-surface/80 backdrop-blur-xl border-b border-pixel-surface-bright" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
        {/* Drag handle indicator */}
        <div className="w-8 h-1 bg-pixel-surface-bright rounded-full mx-auto mb-3" />
        <h2 className="text-lg font-medium text-pixel-on-surface tracking-tight">
          Frame your plant
        </h2>
        <p className="text-[13px] text-pixel-on-surface-variant mt-1">Capture the affected area clearly</p>
      </div>

      {/* Camera preview / Loading / Error states */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden rounded-t-pixel">
        {/* Loading state */}
        {!isActive && !error && (
          <div className="flex flex-col items-center gap-4 z-10">
            <div className="w-12 h-12 border-2 border-garden-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-pixel-on-surface-variant text-[13px] font-medium">Activating camera...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center gap-6 p-8 text-center z-10 max-w-sm">
            <div className="w-14 h-14 bg-amber-500/15 rounded-pixel flex items-center justify-center">
              <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-amber-300 text-[14px] font-medium mb-1">{error}</p>
              <p className="text-pixel-on-surface-variant text-[12px]">Check permissions in settings and try again</p>
            </div>
            <button
              onClick={onCancel}
              aria-label="Go back"
              className="px-6 py-2.5 bg-pixel-surface border border-pixel-surface-bright text-pixel-on-surface rounded-pill text-[14px] font-medium transition-all duration-200 pill-press"
            >
              Go Back
            </button>
          </div>
        )}

        {/* Video preview */}
        {isActive && stream && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Framing guide - Pixel style corner markers */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Rule of thirds grid */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <defs>
                  <pattern id="grid" width="33.333%" height="33.333%" patternUnits="objectBoundingBox">
                    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(34,197,94,0.12)" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Corner markers */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <line x1="5" y1="0" x2="5" y2="8" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" />
                <line x1="0" y1="5" x2="8" y2="5" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" />
                <line x1="95" y1="0" x2="95" y2="8" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" />
                <line x1="100" y1="5" x2="92" y2="5" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" />
                <line x1="5" y1="100" x2="5" y2="92" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" />
                <line x1="0" y1="95" x2="8" y2="95" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" />
                <line x1="95" y1="100" x2="95" y2="92" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" />
                <line x1="100" y1="95" x2="92" y2="95" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" />
              </svg>

              {/* Center focus ring */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-16 h-16 rounded-full border-2 border-garden-500/40 animate-pulse" />
              </div>
            </div>

            {/* Capturing overlay */}
            {isCapturing && (
              <div className="absolute inset-0 bg-pixel-bg/80 flex flex-col items-center justify-center z-20">
                <div className="w-10 h-10 border-2 border-garden-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-pixel-on-surface text-[14px] font-medium">Capturing...</p>
              </div>
            )}

            {/* Capture error */}
            {captureError && (
              <div className="absolute bottom-32 left-0 right-0 flex justify-center z-20">
                <p className="text-amber-300 text-[13px] font-medium bg-pixel-surface/90 backdrop-blur-md px-4 py-2 rounded-pill border border-pixel-surface-bright">
                  Camera still loading -- try again
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Capture controls - Pixel pill button bar */}
      {isActive && stream && !isCapturing && (
        <div className="absolute bottom-0 left-0 right-0 px-6 py-8 flex justify-center items-center bg-gradient-to-t from-pixel-bg via-pixel-bg/80 to-transparent" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-6">
            {/* Cancel pill */}
            <button
              onClick={onCancel}
              aria-label="Cancel"
              className="w-12 h-12 rounded-pill bg-pixel-surface border border-pixel-surface-bright flex items-center justify-center text-pixel-on-surface-variant transition-all duration-200 pill-press"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Capture button - large pill */}
            <div className="relative">
              <div className="absolute inset-0 bg-garden-500/20 rounded-full blur-xl capture-pulse" />
              <button
                onClick={handleCapture}
                aria-label="Capture photo"
                className="relative w-20 h-20 rounded-full bg-garden-500 hover:bg-garden-400 active:bg-garden-600 flex items-center justify-center shadow-2xl shadow-garden-500/30 transition-all duration-200 pill-press focus:outline-none focus:ring-2 focus:ring-garden-400 focus:ring-offset-2 focus:ring-offset-pixel-bg"
              >
                <div className="w-16 h-16 rounded-full border-[3px] border-white/80" />
              </button>
            </div>

            {/* Spacer to balance layout */}
            <div className="w-12 h-12" />
          </div>

          <div className="absolute bottom-full mb-3 text-center left-0 right-0">
            <p className="text-[12px] text-pixel-on-surface-variant font-medium">
              Tap to capture or say &quot;take photo&quot;
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
