import { useEffect, useState } from 'react';

/**
 * Phase 3.6 — a SINGLE shared clock for the whole app. Every subscriber reads
 * the same `now`, updated once a minute by ONE module-level interval — never
 * one timer per TaskItem. The interval only runs while something is subscribed,
 * and pauses when the tab is hidden (no wasted wakeups in the background).
 */

let current = Date.now();
const subscribers = new Set<(now: number) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function tick() {
  current = Date.now();
  subscribers.forEach((fn) => fn(current));
}

function start() {
  if (intervalId != null) return;
  tick();
  intervalId = setInterval(tick, 60 * 1000);
  document.addEventListener('visibilitychange', onVisibility);
}

function stop() {
  if (intervalId != null) { clearInterval(intervalId); intervalId = null; }
  document.removeEventListener('visibilitychange', onVisibility);
}

function onVisibility() {
  if (document.visibilityState === 'visible') tick();
}

export function useNow(): number {
  const [now, setNow] = useState(current);
  useEffect(() => {
    subscribers.add(setNow);
    if (subscribers.size === 1) start();
    setNow(Date.now());
    return () => {
      subscribers.delete(setNow);
      if (subscribers.size === 0) stop();
    };
  }, []);
  return now;
}
