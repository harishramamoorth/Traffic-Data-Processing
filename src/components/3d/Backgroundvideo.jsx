import React, { useEffect, useRef, useState } from 'react';
import { useThemeStore } from '../../store/useThemeStore';
import defaultVideo from './video-no-watermark.mp4';

/**
 * High-Efficiency Minimalist Background Video Component
 * - Displays video-no-watermark.mp4 clearly in both Light Pro and Dark themes
 * - Auto-pauses on hidden tab, reduced motion, or battery saver for efficiency
 * - Balanced overlays so video streams remain vibrant while UI cards stay crisp
 */
export default function BackgroundVideo({
  src = defaultVideo,
  opacity
}) {
  const videoRef = useRef(null);
  const theme = useThemeStore((s) => s.theme);
  const animLevel = useThemeStore((s) => s.animationLevel);
  const [canPlay, setCanPlay] = useState(true);

  const isLight = theme === 'light-pro';
  // Clearly visible opacity: vibrant and clear in Light theme (0.35) and deep ambient in dark themes (0.28)
  const effectiveOpacity = opacity !== undefined ? opacity : isLight ? 0.35 : 0.28;

  // Check reduced motion or data-saver preferences
  useEffect(() => {
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const saveData = navigator.connection?.saveData;
    const disabled = Boolean(prefersReduced || saveData || animLevel === 'reduced' || animLevel === 'off');
    setCanPlay(!disabled);

    if (disabled && videoRef.current) {
      videoRef.current.pause();
    } else if (!disabled && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [animLevel]);

  // Pause when tab is not visible to save CPU/GPU and battery
  useEffect(() => {
    const handleVisibilityChange = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) {
        v.pause();
      } else if (canPlay) {
        v.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [canPlay]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none bg-theme-bg"
    >
      {canPlay && (
        <video
          ref={videoRef}
          src={src}
          className="absolute inset-0 w-full h-full object-cover will-change-transform"
          style={{
            opacity: effectiveOpacity,
            transform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden'
          }}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          disableRemotePlayback
        />
      )}

      {/* Gentle ambient overlays to keep video visible while maintaining page polish */}
      {isLight ? (
        <>
          <div className="absolute inset-0 bg-white/20 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/50 pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-theme-bg/40 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-theme-bg/60 via-transparent to-theme-bg/75 pointer-events-none" />
        </>
      )}
    </div>
  );
}