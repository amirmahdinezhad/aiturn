import { Toaster, toast } from "sonner";
import type { CSSProperties } from "react";

export type ToastKind = "" | "ok" | "err";

/** Preserve distinct feedback and deduplicate repeated native/StrictMode errors. */
export function showToast(message: string, kind: ToastKind = "") {
  const options = { id: `aiturn:${kind}:${message}`, duration: kind === "err" ? 6000 : 3200 };
  if (kind === "err") return toast.error(message, options);
  if (kind === "ok") return toast.success(message, options);
  return toast(message, options);
}

/** One notification surface; Sonner owns pausing, dismissal, stacking and motion. */
export function Toast({ theme = "dark" }: { theme?: "dark" | "light" | "system" }) {
  return <Toaster theme={theme} position="top-center" closeButton visibleToasts={2}
    offset={0} mobileOffset={0} style={{ "--width": "100vw" } as CSSProperties}
    toastOptions={{ className: "home-notification", style: {
      "--normal-bg": "var(--home-picker)", "--normal-border": "var(--home-border)",
      "--normal-text": "var(--home-text)", fontFamily: 'var(--font)',
    } as CSSProperties }} />;
}
