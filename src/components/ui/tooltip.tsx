import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

const SharedTooltipScope = createContext(false);

/** Adjacent controls share Radix's skip-delay window after the first tooltip. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <SharedTooltipScope.Provider value={true}><TooltipPrimitive.Provider delayDuration={450} skipDelayDuration={300}>{children}</TooltipPrimitive.Provider></SharedTooltipScope.Provider>;
}

/** Radix owns interaction and focus; WAAPI keeps the tooltip mounted through pointer exit. */
export function Tooltip({ children, content, contentClassName = "" }: {
  children: ReactElement; content: ReactNode; contentClassName?: string;
}) {
  const shared = useContext(SharedTooltipScope);
  const pointer = useRef(false);
  const lastNode = useRef<HTMLDivElement | null>(null);
  const skipEntry = useRef(false);
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!node) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (lastNode.current !== node) {
      lastNode.current = node;
      skipEntry.current = node.dataset.state === "instant-open";
    }
    if (!open) skipEntry.current = false;
    const instant = !pointer.current || (open && skipEntry.current);
    const style = getComputedStyle(node);
    const end = { opacity: open ? "1" : "0", transform: open || reduce ? "none" : "scale(.97)" };
    if (instant || typeof node.animate !== "function") {
      Object.assign(node.style, end);
      if (!open) setPresent(false);
      return;
    }
    const start = { opacity: style.opacity, transform: reduce ? "none" : style.transform };
    const animation = node.animate([start, end], {
      duration: reduce ? 100 : 200,
      easing: open
        ? style.getPropertyValue("--ease-out").trim() || "cubic-bezier(0.23, 1, 0.32, 1)"
        : style.getPropertyValue("--ease-in-out").trim() || "cubic-bezier(0.77, 0, 0.175, 1)",
      fill: "both",
    });
    let cancelled = false;
    void animation.finished.then(() => {
      if (cancelled) return;
      Object.assign(node.style, end);
      if (!open) setPresent(false);
    }).catch(() => {});
    return () => {
      cancelled = true;
      // Freeze the current frame before cancelling so re-entry never jumps to zero.
      const current = getComputedStyle(node);
      node.style.opacity = current.opacity;
      node.style.transform = current.transform;
      animation.cancel();
    };
  }, [node, open]);

  const tooltip = <TooltipPrimitive.Root open={open} onOpenChange={next => {
    if (next) setPresent(true);
    setOpen(next);
  }}>
    <TooltipPrimitive.Trigger asChild
      onPointerMove={() => { pointer.current = true; }}
      onFocus={event => { if (event.currentTarget.matches(":focus-visible")) pointer.current = false; }}
      onKeyDown={() => { pointer.current = false; }}>
      {children}
    </TooltipPrimitive.Trigger>
    {present ? <TooltipPrimitive.Portal forceMount>
      <TooltipPrimitive.Content forceMount ref={setNode}
        sideOffset={8} collisionPadding={12}
        className={`ui-tooltip${contentClassName ? ` ${contentClassName}` : ""}`}
        aria-hidden={!open || undefined}
        style={!open ? { pointerEvents: "none" } : undefined}
        onEscapeKeyDown={() => { pointer.current = false; }}>
        {content}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal> : null}
  </TooltipPrimitive.Root>;
  return shared ? tooltip : <TooltipProvider>{tooltip}</TooltipProvider>;
}
