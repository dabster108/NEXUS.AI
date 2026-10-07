"use client";

import { useEffect, useRef } from "react";

/** True when the keystroke belongs to a text field and must not be hijacked. */
export function isTyping(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Registers single-key shortcuts for as long as `enabled`. Ignored while
 * typing, with a modifier held, or while a modal <dialog> is open — so "A"
 * approves from anywhere on the page but never while you're writing a message.
 *
 * `map`: { a: fn, d: fn, ArrowDown: fn } — keys compared case-insensitively.
 */
export function useHotkeys(map, enabled = true) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      if (document.querySelector("dialog[open]")) return;
      const fn = ref.current[event.key] ?? ref.current[event.key.toLowerCase()];
      if (fn) {
        event.preventDefault();
        fn(event);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
