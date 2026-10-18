import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * High-performance, GPU-accelerated top loading bar.
 * Fires a smooth glowing gradient beam across the top of the viewport
 * whenever route navigation or page loading occurs.
 */
export default function PageLoadingBar({ isLoading = false }) {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);

  // Trigger on route transitions
  useEffect(() => {
    setActive(true);
    setProgress(20);

    const t1 = setTimeout(() => setProgress(65), 80);
    const t2 = setTimeout(() => setProgress(90), 180);
    const t3 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setActive(false);
        setProgress(0);
      }, 250);
    }, 320);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [location.pathname, location.search]);

  // Also support manual isLoading prop
  useEffect(() => {
    if (isLoading) {
      setActive(true);
      setProgress(75);
    } else if (active && !isLoading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setActive(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!active && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[100] h-[3px] pointer-events-none overflow-hidden"
    >
      <div
        className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(6,182,212,0.8)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? 'width 0.2s ease-out, opacity 0.3s ease-in' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      />
    </div>
  );
}
