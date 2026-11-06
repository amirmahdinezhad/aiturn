import { useCallback, useEffect, useRef, useState } from "react";

type Input = "instant" | "pointer";

/** Keep Radix mounted through every exit; animate without requiring @starting-style. */
export function useWorkspacePickerMotion() {
  const [open, setOpen] = useState(false);
  const [motion, setMotion] = useState<Input>("instant");
  const [closing, setClosing] = useState(false);
  const input = useRef<Input>("instant");
  const leaving = useRef(false);
  const generation = useRef(0);
  const content = useRef<HTMLDivElement | null>(null);
  const overlay = useRef<HTMLDivElement | null>(null);
  const animations = useRef(new Map<Element, Animation>());

  const stop = useCallback(() => {
    animations.current.forEach(animation => animation.cancel());
    animations.current.clear();
  }, []);
  useEffect(() => () => { generation.current++; stop(); }, [stop]);

  const play = useCallback((element: HTMLElement, exit: boolean, panel: boolean) => {
    if (typeof element.animate !== "function") return Promise.resolve();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const style = getComputedStyle(element);
    // Sample before cancelling so a dismissal can reverse an unfinished entrance.
    const start: Keyframe = exit ? { opacity: style.opacity } : { opacity: 0 };
    const end: Keyframe = { opacity: exit ? 0 : 1 };
    if (panel && !reduced) {
      start.transform = exit ? style.transform : "translateY(-6px) scale(0.95)";
      end.transform = exit ? "translateY(-6px) scale(0.95)" : "translateY(0) scale(1)";
    }
    animations.current.get(element)?.cancel();
    try {
      const animation = element.animate([start, end], {
        duration: reduced ? 100 : 250,
        // A balanced exit keeps the surface legible through the first half of
        // dismissal instead of fading almost completely in its first frames.
        easing: exit
          ? style.getPropertyValue("--ease-in-out").trim() || "cubic-bezier(0.77, 0, 0.175, 1)"
          : style.getPropertyValue("--ease-ios").trim() || "cubic-bezier(0.32, 0.72, 0, 1)",
        fill: "both",
      });
      animations.current.set(element, animation);
      return animation.finished.then(() => {
        if (!exit && animations.current.get(element) === animation) {
          animations.current.delete(element);
          animation.cancel(); // Settled CSS is opaque and untransformed.
        }
      }).catch(() => { /* A newer interaction owns a cancelled animation. */ });
    } catch {
      return Promise.resolve(); // Unsupported animation engines still allow navigation.
    }
  }, []);

  const contentRef = useCallback((node: HTMLDivElement | null) => {
    if (!node && content.current) {
      animations.current.get(content.current)?.cancel();
      animations.current.delete(content.current);
    }
    content.current = node;
    if (node && input.current === "pointer") void play(node, false, true);
  }, [play]);
  const overlayRef = useCallback((node: HTMLDivElement | null) => {
    if (!node && overlay.current) {
      animations.current.get(overlay.current)?.cancel();
      animations.current.delete(overlay.current);
    }
    overlay.current = node;
    if (node && input.current === "pointer") void play(node, false, false);
  }, [play]);

  const setInput = useCallback((next: Input) => {
    input.current = next;
    setMotion(next);
    // Keyboard navigation can settle an entrance, but must never cancel an
    // already requested dismissal. All dismissal methods share the same exit.
    if (next === "instant" && !leaving.current) stop();
  }, [stop]);

  const changeOpen = useCallback((next: boolean) => {
    if (next) {
      generation.current++;
      leaving.current = false;
      stop();
      setClosing(false);
      setOpen(true);
      return;
    }
    if (leaving.current) return;
    const ticket = ++generation.current;
    if (!content.current?.animate) {
      stop();
      setOpen(false);
      return;
    }
    leaving.current = true;
    setClosing(true);
    const exits = [play(content.current, true, true)];
    if (overlay.current) exits.push(play(overlay.current, true, false));
    void Promise.all(exits).then(() => {
      if (generation.current !== ticket) return;
      leaving.current = false;
      setClosing(false);
      setOpen(false);
    });
  }, [play, stop]);

  return { open, motion, closing, setInput, changeOpen, contentRef, overlayRef };
}
