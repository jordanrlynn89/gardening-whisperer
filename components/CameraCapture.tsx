'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useCamera } from '@/hooks/useCamera';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isActive, stream, error, startCamera, stopCamera, capturePhoto } = useCamera();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

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
    if (videoRef.current && !isCapturing) {
      setIsCapturing(true);
      const imageData = await capturePhoto(videoRef.current);
      if (imageData) {
        setCapturedImage(imageData);
      }
      setIsCapturing(false);
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  // Show review flow if image is captured
  if (capturedImage) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Review captured photo"
        className="fixed inset-0 z-50 bg-stone-950 flex flex-col animate-in fade-in duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-b from-stone-900 to-transparent" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
          <h2 className="text-xl font-light text-stone-100 tracking-wide">Review</h2>
        </div>

        {/* Preview */}
        <div className="flex-1 relative flex items-center justify-center px-6 py-8 overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center">
            <Image
              src={capturedImage}
              alt="Captured plant"
              fill
              className="object-contain rounded-2xl shadow-2xl"
            />
            {/* Subtle vignette effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-transparent via-transparent to-stone-950/30 pointer-events-none" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 py-8 bg-gradient-to-t from-stone-950 via-stone-950/80 to-transparent" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
          <style>{`
            @keyframes button-slide-up {
              from {
                opacity: 0;
                transform: translateY(12px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .button-retake { animation: button-slide-up 0.4s ease-out 0.1s both; }
            .button-analyze { animation: button-slide-up 0.4s ease-out 0.2s both; }
          `}</style>
          <div className="flex gap-4 justify-center">
            {/* Retake button */}
            <button
              onClick={handleRetake}
              aria-label="Retake photo"
              className="button-retake group relative px-8 py-3 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 font-light transition-all duration-200 active:scale-95 min-w-[120px] shadow-lg shadow-stone-950/50 hover:shadow-stone-900"
            >
              Retake
            </button>

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              aria-label="Confirm and analyze"
              className="button-analyze group relative px-8 py-3 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-light shadow-lg hover:shadow-emerald-500/40 transition-all duration-200 active:scale-95 min-w-[120px]"
            >
              Analyze
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main capture view
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Camera capture"
      className="fixed inset-0 z-50 bg-stone-950 flex flex-col overflow-hidden"
    >
      {/* Header with guidance */}
      <div className="px-6 py-4 bg-gradient-to-b from-stone-900/80 to-transparent backdrop-blur-sm" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
        <h2 className="text-xl font-light text-stone-100 tracking-wide mb-2">
          Frame your plant
        </h2>
        <p className="text-sm text-stone-400 font-light">Capture the affected area clearly</p>
      </div>

      {/* Camera preview / Loading / Error states */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {/* Loading state */}
        {!isActive && !error && (
          <div className="flex flex-col items-center gap-4 z-10">
            <div className="relative w-16 h-16">
              <svg className="absolute inset-0 w-full h-full text-emerald-500/20" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            </div>
            <p className="text-stone-300 text-sm font-light">Activating camera...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center gap-6 p-8 text-center z-10 max-w-sm">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl" />
              <div className="relative w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4v2m0 4v2M4.22 4.22a9 9 0 0113.56 0m-13.56 0a9 9 0 0113.56 12.56m-13.56 0a9 9 0 000 13.56m13.56 0a9 9 0 000-13.56" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-amber-300 font-light text-sm mb-1">{error}</p>
              <p className="text-stone-400 text-xs">Check permissions in settings and try again</p>
            </div>
            <button
              onClick={onCancel}
              aria-label="Go back"
              className="mt-4 px-6 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-full font-light transition-colors"
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

            {/* Framing guide - rule of thirds with organic corners */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Rule of thirds grid */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <defs>
                  <pattern id="grid" width="33.333%" height="33.333%" patternUnits="objectBoundingBox">
                    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(34,197,94,0.15)" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Corner guides */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Top-left */}
                <line x1="5" y1="0" x2="5" y2="8" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" filter="url(#glow)" />
                <line x1="0" y1="5" x2="8" y2="5" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" filter="url(#glow)" />
                {/* Top-right */}
                <line x1="95" y1="0" x2="95" y2="8" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" filter="url(#glow)" />
                <line x1="100" y1="5" x2="92" y2="5" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" filter="url(#glow)" />
                {/* Bottom-left */}
                <line x1="5" y1="100" x2="5" y2="92" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" filter="url(#glow)" />
                <line x1="0" y1="95" x2="8" y2="95" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" filter="url(#glow)" />
                {/* Bottom-right */}
                <line x1="95" y1="100" x2="95" y2="92" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" filter="url(#glow)" />
                <line x1="100" y1="95" x2="92" y2="95" stroke="rgba(34,197,94,0.4)" strokeWidth="0.8" filter="url(#glow)" />
              </svg>

              {/* Center focus indicator with subtle pulse */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-16 h-16 rounded-full border-2 border-emerald-500/50 animate-pulse" />
                <div className="absolute inset-0 rounded-full border border-emerald-500/30" />
              </div>

              {/* Lighting indicator - top right */}
              <div className="absolute top-8 right-8 bg-black/40 rounded-full px-4 py-2 backdrop-blur-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-300 font-light">Good light</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Capture controls - voice-friendly large button */}
      {isActive && stream && (
        <div className="absolute bottom-0 left-0 right-0 px-6 py-8 flex justify-center items-center bg-gradient-to-t from-black/90 via-black/50 to-transparent" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-8">
            <style>{`
              @keyframes pulse-glow {
                0%, 100% {
                  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
                }
                50% {
                  box-shadow: 0 0 0 12px rgba(34, 197, 94, 0);
                }
              }
              .capture-pulse {
                animation: pulse-glow 2s infinite;
              }
            `}</style>
            {/* Cancel - subtle side button */}
            <button
              onClick={onCancel}
              aria-label="Cancel"
              className="w-14 h-14 rounded-full bg-stone-800/60 hover:bg-stone-700/60 border border-stone-600/40 flex items-center justify-center text-stone-400 hover:text-stone-300 transition-all duration-200 active:scale-95 shadow-lg shadow-stone-950/40"
            >
              <svg className="w-6 h-6 transition-transform duration-200 hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Main capture button - organic shape with glow */}
            <div className="relative">
              {/* Outer glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 to-emerald-600/30 rounded-full blur-2xl capture-pulse" />

              {/* Button */}
              <button
                onClick={handleCapture}
                disabled={isCapturing}
                aria-label="Capture photo"
                className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:from-emerald-600 active:to-emerald-700 disabled:opacity-75 flex items-center justify-center shadow-2xl hover:shadow-2xl hover:shadow-emerald-500/50 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-stone-950"
              >
                {isCapturing ? (
                  <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-white fill-current" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                )}
              </button>
            </div>

            {/* Placeholder for symmetry */}
            <div className="w-14 h-14" />
          </div>

          {/* Voice hint */}
          <div className="absolute bottom-full mb-4 text-center">
            <p className="text-xs text-stone-500 font-light">Tap to capture or say &quot;take photo&quot;</p>
          </div>
        </div>
      )}

      {/* Canvas for photo capture (hidden) */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
