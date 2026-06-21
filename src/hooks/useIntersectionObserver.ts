import { useState, useRef, useCallback, useEffect } from "react";

interface UseIntersectionObserverOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
  /** Once the element enters the viewport, stop observing (default: true). */
  once?: boolean;
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
) {
  const { root = null, rootMargin = "200px", threshold = 0, once = true } = options;
  const [isIntersecting, setIsIntersecting] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (el: HTMLElement | null) => {
      // Cleanup any previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!el) return;

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsIntersecting(true);
            if (once) {
              observerRef.current?.disconnect();
              observerRef.current = null;
            }
          } else if (!once) {
            setIsIntersecting(false);
          }
        },
        { root, rootMargin, threshold }
      );

      observerRef.current.observe(el);
    },
    [root, rootMargin, threshold, once]
  );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return { ref, isIntersecting };
}
