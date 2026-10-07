"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "./motion";

/**
 * Small client islands for the landing page. Each one does a single thing and
 * degrades to its static content without JavaScript or under reduced motion.
 */

/** Cycles through `words` in place, sliding each one up. */
export function RotatingWord({ words, interval = 2400 }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const visible = useInView(ref);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced || !visible) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [reduced, visible, words.length, interval]);

  // The widest word reserves the space, so the line never reflows.
  const widest = words.reduce((a, b) => (b.length > a.length ? b : a), "");
  return (
    <span ref={ref} className="rotating-word">
      <span className="invisible" aria-hidden>
        {widest}
      </span>
      {words.map((word, i) => (
        <span
          key={word}
          className="rotating-word-item"
          data-state={i === index ? "in" : i === (index - 1 + words.length) % words.length ? "out" : "idle"}
          aria-hidden={i !== index}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

/** Counts from 0 to `value` once, the first time it scrolls into view. */
export function CountUp({ value, duration = 1400, suffix = "" }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const seen = useInView(ref, { once: true, threshold: 0.6 });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!seen || reduced) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(Math.round(eased * value));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [seen, reduced, value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {reduced ? value : shown}
      {suffix}
    </span>
  );
}

/**
 * Publishes the pointer position as `--mx`/`--my` on every `[data-spotlight]`
 * descendant, relative to that element. CSS draws the glow; this writes two
 * custom properties per frame and never re-renders React.
 */
export function SpotlightGroup({ children, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia("(pointer: coarse)").matches) return;
    let frame = 0;
    const onMove = (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const node of root.querySelectorAll("[data-spotlight]")) {
          const rect = node.getBoundingClientRect();
          node.style.setProperty("--mx", `${event.clientX - rect.left}px`);
          node.style.setProperty("--my", `${event.clientY - rect.top}px`);
        }
      });
    };
    root.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Copies `text` and confirms in place for a moment. */
export function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // Clipboard can be blocked (insecure context); the text stays selectable.
        }
      }}
      aria-label={copied ? "Copied" : `${label} to clipboard`}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
