"use client";
import { useSyncExternalStore } from "react";
const query = "(prefers-reduced-motion: reduce)";
function subscribe(update: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}
function snapshot() { return window.matchMedia(query).matches; }
// Initial server content stays visible and still until the browser preference is known.
export function useWorkflowReducedMotion() { return useSyncExternalStore(subscribe, snapshot, () => true); }
