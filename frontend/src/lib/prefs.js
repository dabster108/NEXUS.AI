"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny persisted-preference store (localStorage), safe on the server and in
 * private windows. Used for the data source, pinned memories and the like —
 * per-viewer conveniences, never anything that must survive a cleared cache.
 */

const listeners = new Set();

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const cache = new Map();

function snapshot(key, fallback) {
  // useSyncExternalStore needs a referentially stable snapshot.
  const raw = (() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  })();
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value;
  const value = read(key, fallback);
  cache.set(key, { raw, value });
  return value;
}

export function setPref(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* blocked storage: the change lasts until reload */
  }
  cache.delete(key);
  cache.set(key, { raw: JSON.stringify(value), value });
  listeners.forEach((l) => l());
}

function subscribe(cb) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function usePref(key, fallback) {
  const value = useSyncExternalStore(
    subscribe,
    () => snapshot(key, fallback),
    () => fallback,
  );
  return [value, (next) => setPref(key, typeof next === "function" ? next(value) : next)];
}
