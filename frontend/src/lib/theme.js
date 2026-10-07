"use client";

import { useSyncExternalStore } from "react";

/**
 * Theme preference: "system" | "light" | "dark", persisted in localStorage and
 * resolved onto <html data-theme>. The inline script in layout.js applies it
 * before first paint; this module is the runtime half (toggling + reading).
 */

const KEY = "nexus-theme";
const listeners = new Set();

function readPref() {
  try {
    return localStorage.getItem(KEY) || "system";
  } catch {
    return "system";
  }
}

function resolve(pref) {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

function apply(pref) {
  document.documentElement.setAttribute("data-theme", resolve(pref));
}

export function setThemePref(pref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* storage can be blocked; the choice then lasts for this page only */
  }
  apply(pref);
  listeners.forEach((l) => l());
}

function subscribe(callback) {
  listeners.add(callback);
  // Follow the OS while the preference is "system".
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readPref() === "system") {
      apply("system");
      callback();
    }
  };
  query.addEventListener("change", onChange);
  return () => {
    listeners.delete(callback);
    query.removeEventListener("change", onChange);
  };
}

/** { pref, resolved, setPref, toggle } — safe on the server (reports light). */
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system");
  const resolved = useSyncExternalStore(
    subscribe,
    () => document.documentElement.getAttribute("data-theme") || "light",
    () => "light",
  );
  return {
    pref,
    resolved,
    setPref: setThemePref,
    toggle: () => setThemePref(resolved === "dark" ? "light" : "dark"),
  };
}
