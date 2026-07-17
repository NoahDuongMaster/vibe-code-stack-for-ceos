'use client';

import { useReducedMotion } from 'motion/react';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

type TMarketSceneActivity = {
  containerRef: RefObject<HTMLDivElement | null>;
  shouldAnimate: boolean;
  reducedMotion: boolean;
};

export const useMarketSceneActivity = (): TMarketSceneActivity => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [isIntersecting, setIsIntersecting] = useState(true);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () =>
      typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry?.isIntersecting ?? true),
      { threshold: 0.05 },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () =>
      setIsDocumentVisible(document.visibilityState !== 'hidden');

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return {
    containerRef,
    shouldAnimate: !prefersReducedMotion && isIntersecting && isDocumentVisible,
    reducedMotion: prefersReducedMotion,
  };
};
