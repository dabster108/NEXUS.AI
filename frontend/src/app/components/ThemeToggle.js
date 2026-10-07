"use client";

import { useTheme } from "@/lib/theme";

/** Sun/moon toggle. Labelled for what pressing it does, not what it shows. */
export function ThemeToggle({ className = "" }) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      className={`btn btn-quiet btn-icon theme-toggle ${className}`}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="theme-icon">
        {dark ? (
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="2.8" />
            <path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M12.4 3.6l-1 1M4.6 11.4l-1 1" />
          </g>
        ) : (
          <path
            d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
}
