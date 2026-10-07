/**
 * One small icon set (16px, 1.5 stroke, currentColor). Names are what the
 * thing is called in the product, not what it looks like.
 */

const PATHS = {
  command: "M3 4.5l3.5 3.5L3 11.5M8 12h5",
  approvals: "M8 1.8l5 1.9v3.9c0 3-2.1 5.2-5 6.6-2.9-1.4-5-3.6-5-6.6V3.7l5-1.9zM5.8 8l1.6 1.6L10.4 6.4",
  timeline: "M8 2.2a5.8 5.8 0 1 0 0 11.6A5.8 5.8 0 0 0 8 2.2zM8 5v3.2l2.2 1.3",
  context: "M8 2L2 5l6 3 6-3-6-3zM2 8l6 3 6-3M2 11l6 3 6-3",
  memory: "M3 4.2c0-1 2.2-1.8 5-1.8s5 .8 5 1.8-2.2 1.8-5 1.8-5-.8-5-1.8zM3 4.2v3.6c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4.2M3 7.8v3.6c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V7.8",
  processes: "M5 2v2M8 2v2M11 2v2M5 12v2M8 12v2M11 12v2M2 5h2M2 8h2M2 11h2M12 5h2M12 8h2M12 11h2M4 4h8v8H4z",
  git: "M4.5 2.5v7M4.5 9.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4.5 2.5a1.5 1.5 0 1 0 0-.01M11.5 4.5a2 2 0 1 0 0 .01M11.5 6.5c0 2.2-2 3-7 3",
  tools: "M9.8 2.7a3.4 3.4 0 0 0-3.9 4.4L2.5 10.5a1.4 1.4 0 0 0 2 2l3.4-3.4a3.4 3.4 0 0 0 4.4-3.9L10.4 7.1 8.9 5.6l1.9-1.9z",
  evals: "M6 2v4.3L2.8 12a1.4 1.4 0 0 0 1.2 2.1h8A1.4 1.4 0 0 0 13.2 12L10 6.3V2M5.4 2h5.2M4.6 10h6.8",
  audit: "M4 2.5h6.5L13 5v8.5H4zM10.5 2.5V5H13M6 8h5M6 10.5h5",
  settings: "M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM8 1.8v1.6M8 12.6v1.6M2.9 4.1l1.1 1.1M12 10.8l1.1 1.1M1.8 8h1.6M12.6 8h1.6M2.9 11.9L4 10.8M12 5.2l1.1-1.1",
  search: "M7 2.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4zM10.2 10.2l3 3",
  menu: "M2.5 4.5h11M2.5 8h11M2.5 11.5h11",
  close: "M4 4l8 8M12 4l-8 8",
  check: "M3 8.4l3.2 3.2L13 4.8",
  x: "M4 4l8 8M12 4l-8 8",
  pin: "M9.5 2.2l4.3 4.3-2 .6-2.3 2.3.3 3-1 1-2.7-2.7-3.6 3.6-.7-.7 3.6-3.6L3.7 6.7l1-1 3 .3 2.3-2.3.5-1.5z",
  trash: "M3 4.5h10M6.2 4.5V3h3.6v1.5M4.5 4.5l.5 8.5h6l.5-8.5M6.8 7v3.8M9.2 7v3.8",
  edit: "M10.5 2.5l3 3L6 13H3v-3l7.5-7.5z",
  restart: "M13 7.5A5 5 0 1 0 11.6 11M13 3v4.5H8.5",
  play: "M5 3.2l7 4.8-7 4.8V3.2z",
  copy: "M5.5 5.5h7v8h-7zM3.5 10.5v-8h7",
  chevron: "M6 3.5L10.5 8 6 12.5",
  down: "M3.5 6L8 10.5 12.5 6",
  arrow: "M3.5 8h9M9 4.5L12.5 8 9 11.5",
  sun: "M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1",
  moon: "M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z",
  spark: "M8 2.2l1.5 3.9 3.9 1.5-3.9 1.5L8 13l-1.5-3.9L2.6 7.6l3.9-1.5L8 2.2z",
  filter: "M2.5 3.5h11L9.2 8.6v4l-2.4-1.2V8.6L2.5 3.5z",
  download: "M8 2.5v7.5M4.8 7.2L8 10.4l3.2-3.2M3 13h10",
  warn: "M8 2.4l6 10.4H2L8 2.4zM8 6.6v3M8 11.2v.1",
  info: "M8 2.2a5.8 5.8 0 1 0 0 11.6A5.8 5.8 0 0 0 8 2.2zM8 7.2v3.6M8 5.2v.1",
  external: "M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5",
  keyboard: "M2 4.5h12v7H2zM4.5 7h.01M7 7h.01M9.5 7h.01M12 7h.01M5 9.5h6",
};

export function Icon({ name, size = 16, className, strokeWidth = 1.5, ...rest }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={className}
      {...rest}
    >
      <path d={d} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
