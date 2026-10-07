"use client";

import { useEffect, useState } from "react";

/** A clock that only ticks while `active` — for live durations, not decoration. */
export function useNow(active, every = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [active, every]);
  return now;
}
