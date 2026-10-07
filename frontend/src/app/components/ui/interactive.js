"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "../landing/motion";
import { cx } from "./primitives";

/**
 * Interactive primitives. Each one carries its own ARIA contract so call
 * sites can't forget it: Tabs implements the WAI-ARIA tabs pattern (roving
 * tabindex, arrow/Home/End keys), Drawer is a native modal <dialog> (focus
 * trap, Esc, inert background), Magnetic is decorative and pointer-only.
 */

/** Tabs: [{ id, label, count? }]. Controlled via `value`/`onChange`. */
export function Tabs({ tabs, value, onChange, label = "Sections", className, children }) {
  const base = useId();
  const refs = useRef({});

  const move = (index) => {
    const next = tabs[(index + tabs.length) % tabs.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="tabs">
        {tabs.map((tab, i) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                refs.current[tab.id] = node;
              }}
              role="tab"
              type="button"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className="tab"
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") (e.preventDefault(), move(i + 1));
                else if (e.key === "ArrowLeft") (e.preventDefault(), move(i - 1));
                else if (e.key === "Home") (e.preventDefault(), move(0));
                else if (e.key === "End") (e.preventDefault(), move(tabs.length - 1));
              }}
            >
              {tab.label}
              {tab.count != null ? <span className="tab-count mono">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel-${value}`}
        aria-labelledby={`${base}-tab-${value}`}
        tabIndex={0}
        className="tabpanel"
      >
        {children}
      </div>
    </div>
  );
}

/** Right-side sheet built on <dialog>, so focus handling is the platform's. */
export function Drawer({ open, onClose, title, subtitle, children, width = 480 }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="drawer"
      style={{ "--drawer-w": `${width}px` }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="drawer-title"
    >
      <div className="drawer-panel">
        <header className="drawer-head">
          <div className="min-w-0">
            <h2 id="drawer-title" className="t-h2 truncate">
              {title}
            </h2>
            {subtitle ? <p className="t-mono mt-0.5 truncate">{subtitle}</p> : null}
          </div>
          <button type="button" className="btn btn-quiet btn-icon" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="drawer-body scroll">{open ? children : null}</div>
      </div>
    </dialog>
  );
}

/**
 * Pulls its child a few pixels toward the pointer. Transform only, desktop
 * pointers only, and a no-op under reduced motion.
 */
export function Magnetic({ children, strength = 0.22, className }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  const onMove = useCallback(
    (event) => {
      const node = ref.current;
      if (!node || reduced) return;
      const rect = node.getBoundingClientRect();
      const x = (event.clientX - (rect.left + rect.width / 2)) * strength;
      const y = (event.clientY - (rect.top + rect.height / 2)) * strength;
      node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    },
    [reduced, strength],
  );

  const reset = useCallback(() => {
    if (ref.current) ref.current.style.transform = "";
  }, []);

  return (
    <span
      ref={ref}
      className={cx("magnetic", className)}
      onPointerMove={(e) => e.pointerType === "mouse" && onMove(e)}
      onPointerLeave={reset}
    >
      {children}
    </span>
  );
}

/** A value that eases to its target when it changes (counts, durations). */
export function useTween(target, duration = 600) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    if (reduced) {
      from.current = target;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = origin + (target - origin) * eased;
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);

  return reduced ? target : shown;
}
