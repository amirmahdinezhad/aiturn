import { useEffect, useState } from "react";

const NO_DEADLINES: readonly (string | null | undefined)[] = [];

/** Tick at display precision while still hiding subscriptions at their exact expiry. */
export function useAccountClock(deadlines: readonly (string | null | undefined)[] = NO_DEADLINES) {
  const [now, setNow] = useState(Date.now);
  const key = JSON.stringify(deadlines);
  useEffect(() => {
    const dates = (JSON.parse(key) as (string | null)[]).map(date => Date.parse(date ?? "")).filter(Number.isFinite);
    let timer: number;
    const tick = () => {
      window.clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      const next = Math.min(30_000, ...dates.filter(date => date > current).map(date => date - current));
      timer = window.setTimeout(tick, Math.max(1, next));
    };
    tick();
    window.addEventListener("focus", tick);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", tick); };
  }, [key]);
  return now;
}
