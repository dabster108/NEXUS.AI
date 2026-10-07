"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Shared motion plumbing for the landing page.
 *
 * Every animated piece on the page asks two questions before it moves: is it
 * on screen, and does the reader want motion at all. Anything off screen
 * pauses, so a page full of loops costs nothing while you read one section.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReduced(callback) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** True when the reader asked for less motion. Server render assumes motion. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/**
 * Whether `ref` is in the viewport. With `once`, it latches true the first
 * time — for entrance effects; without it, it tracks — for loops that should
 * pause off screen.
 */
export function useInView(ref, { once = false, threshold = 0.2, rootMargin = "0px" } = {}) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, once, threshold, rootMargin]);

  return inView;
}
