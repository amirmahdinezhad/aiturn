import { useId } from "react";
import type { QuotaSet, QuotaWindow } from "../api";
import { accountWindowLabel, canonicalAccountWindow } from "../accountPrefs";
import { useAccountClock } from "../useAccountClock";
import { usagePace } from "../usage";
import { Tooltip } from "./ui/tooltip";
import { RefreshIcon } from "../icons";

/** Only measured main windows belong in the primary card columns. */
export function accountPreviewWindows(quota: QuotaSet | null | undefined): QuotaWindow[] {
  if (quota?.error) return [];
  const seen = new Set<string>();
  return (quota?.windows ?? []).filter(window => {
    const key = canonicalAccountWindow(window.window);
    if (!key || seen.has(key) || !Number.isFinite(window.percent) || window.percent < 0) return false;
    seen.add(key); return true;
  }).sort((a, b) => {
    const rank = (window: QuotaWindow) => ({ "5-hour": 0, weekly: 1, monthly: 2 })[canonicalAccountWindow(window.window) as "5-hour" | "weekly" | "monthly"] ?? 3;
    return rank(a) - rank(b);
  }).slice(0, 2);
}

/** Local calendar boundaries keep Tomorrow correct across daylight-saving changes. */
export function resetDeadline(iso: string | null | undefined, now: number) {
  const date = new Date(iso ?? "");
  if (!Number.isFinite(date.getTime())) return null;
  if (date.getTime() <= now) return { day: "Updating", time: "…", full: "Reset time passed; waiting for fresh usage" };
  const today = new Date(now), tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = date.toDateString() === today.toDateString() ? "Today"
    : date.toDateString() === tomorrow.toDateString() ? "Tomorrow"
    : date.toLocaleDateString("en", { month: "short", day: "numeric", ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
  return { day, time: date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }), full: `Resets ${date.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}` };
}

/** Match the time marker to the bar's remaining/used direction; never guess a period. */
export function accountTimeMarker(window: QuotaWindow, now: number, showRemaining: boolean): number | null {
  const pace = usagePace(window, now);
  if (pace) return showRemaining ? 1 - pace.elapsed : pace.elapsed;
  const reset = Date.parse(window.resetsAt ?? "");
  return Number.isFinite(reset) && reset <= now ? (showRemaining ? 0 : 1) : null;
}

function UsageTrack({ window, now, value, showRemaining, label }: {
  window: QuotaWindow; now: number; value: number; showRemaining: boolean; label: string;
}) {
  const deadline = resetDeadline(window.resetsAt, now);
  const marker = accountTimeMarker(window, now, showRemaining);
  const pending = deadline?.day === "Updating";
  const state = showRemaining ? "remaining" : "used";
  const timeText = marker !== null && !pending ? `${Math.round(marker * 100)}% of window time ${showRemaining ? "remaining" : "elapsed"}` : null;
  const resetText = deadline?.full ?? "Reset time unavailable";
  return <Tooltip contentClassName="usage-reset-popover" content={<span className="usage-reset-tooltip">
    <span className="usage-reset-tooltip-label"><RefreshIcon size={12} />{label} reset</span>
    {deadline && !pending ? <span className="usage-reset-tooltip-date"><span>{deadline.day}</span><time dateTime={window.resetsAt!}>{deadline.time}</time></span>
      : <span className="usage-reset-tooltip-status">{pending ? "Refreshing…" : "Time unavailable"}</span>}
  </span>}>
    <span className="usage-preview-plot" role="meter" tabIndex={0} aria-label={`${label} ${state}`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}
      aria-valuetext={`${value}% ${state}. ${resetText}${timeText ? `. Time marker: ${timeText}` : ""}`}>
      <span className="usage-preview-track" aria-hidden="true"><span style={{ transform: `scaleX(${value / 100})` }} /></span>
      {marker !== null ? <span className="usage-preview-time-marker" data-pending={pending || undefined} aria-hidden="true" style={{ left: `clamp(1px, ${marker * 100}%, calc(100% - 1px))` }} /> : null}
    </span>
  </Tooltip>;
}

/** Read-only limits and local reset deadlines; usage never opens a modal. */
export function AccountUsagePreview({ windows, accountName, showRemaining = true }: {
  windows: QuotaWindow[]; accountName: string; showRemaining?: boolean;
}) {
  const descriptionId = useId();
  const now = useAccountClock(windows.map(window => window.resetsAt));
  if (!windows.length) return null;
  const label = (window: QuotaWindow) => { const key = canonicalAccountWindow(window.window); return key ? accountWindowLabel(key) : window.window; };
  const shown = (window: QuotaWindow) => Math.round(Math.min(100, Math.max(0, showRemaining ? 100 - window.percent : window.percent)));
  return <div className="account-usage-preview" role="group" aria-label={`Usage for ${accountName}`} aria-describedby={descriptionId}>
    <span className="sr-only" id={descriptionId}>{windows.map(window => `${label(window)} ${shown(window)}% ${showRemaining ? "remaining" : "used"}`).join(", ")}</span>
    <div className="account-usage-metrics">{windows.map(window => <div className="account-usage-metric" data-tone={window.percent >= 95 ? "danger" : window.percent >= 75 ? "warning" : "healthy"} key={window.window}>
      <span className="usage-preview-label">{label(window)}</span>
      <strong aria-hidden="true"><span>{shown(window)}%</span><span className="usage-preview-unit">{showRemaining ? "left" : "used"}</span></strong>
      <UsageTrack window={window} now={now} value={shown(window)} showRemaining={showRemaining} label={label(window)} />
    </div>)}</div>
  </div>;
}

/** Secondary/model limits stay available inline rather than disappearing with the popup. */
export function AccountQuotaPreview({ quota, accountName, showRemaining = true }: { quota: QuotaSet | null | undefined; accountName: string; showRemaining?: boolean }) {
  if (quota?.error) return <p className="account-data-note" role="status">{quota.error}</p>;
  const measured = (quota?.windows ?? []).filter(window => Number.isFinite(window.percent) && window.percent >= 0);
  const primary = accountPreviewWindows(quota);
  const main = primary.length ? primary : measured.slice(0, 2);
  const seen = new Set(main.map(window => canonicalAccountWindow(window.window) ?? window.window));
  const extra = measured.filter(window => { const key = canonicalAccountWindow(window.window) ?? window.window; if (seen.has(key)) return false; seen.add(key); return true; });
  return <>
    <AccountUsagePreview windows={main} accountName={accountName} showRemaining={showRemaining} />
    {extra.length ? <details className="account-extra-limits"><summary>Additional limits <span>{extra.length}</span></summary><AccountUsagePreview windows={extra} accountName={`${accountName} additional limits`} showRemaining={showRemaining} /></details> : null}
    {!main.length ? <p className="account-data-note">Usage unavailable</p> : null}
  </>;
}
