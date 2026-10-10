/**
 * The NEXUS mark: an "N" drawn as one continuous node-to-node path on the
 * accent gradient. It is theme-aware — the gradient stops read the accent
 * tokens — so it sits in the interface instead of on top of it.
 */
export function BrandMark({ size = 28, className = "" }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`brand-mark ${className}`.trim()}
    >
      <defs>
        <linearGradient id="nx-brand-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--accent)" }} />
          <stop offset="1" style={{ stopColor: "var(--violet)" }} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#nx-brand-grad)" />
      <path
        d="M10.5 22.5V9.5l11 13v-13"
        fill="none"
        stroke="#fff"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
