'use client';

import { useEffect, useRef, useCallback } from 'react';

interface VisualizerProps {
  volume: number;
  isActive: boolean;
}

export function Visualizer({ volume, isActive }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const ringsRef = useRef<{ radius: number; alpha: number; speed: number }[]>([]);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // Handle canvas resize — only runs on mount and when the element size changes
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    sizeRef.current = { width, height };
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  // Set up ResizeObserver for canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    updateCanvasSize();

    const observer = new ResizeObserver(() => {
      updateCanvasSize();
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
    };
  }, [updateCanvasSize]);

  // Animation loop — reads size from sizeRef instead of recalculating every frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (ringsRef.current.length === 0) {
      for (let i = 0; i < 5; i++) {
        ringsRef.current.push({
          radius: 50 + i * 30,
          alpha: 0.1 + i * 0.05,
          speed: 0.5 + Math.random() * 0.5,
        });
      }
    }

    const animate = () => {
      const { width, height } = sizeRef.current;
      if (width === 0 || height === 0) {
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.save();
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      const baseRadius = 80 + volume * 100;

      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        baseRadius * 2
      );
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 40 + volume * 20, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#22c55e' : '#57534e';
      ctx.fill();

      ringsRef.current.forEach((ring) => {
        ring.radius += ring.speed + volume * 2;
        if (ring.radius > Math.max(width, height) / 2) {
          ring.radius = 40;
          ring.alpha = 0.5;
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(168, 162, 158, ${Math.max(
          0,
          0.5 - (ring.radius / (width / 2)) * 0.5
        )})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      ctx.restore();

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [volume, isActive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="w-full h-full absolute top-0 left-0 -z-10"
    />
  );
}
