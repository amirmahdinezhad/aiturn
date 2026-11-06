import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { Tooltip, TooltipProvider } from "./tooltip";

const original = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  if (original) Object.defineProperty(Element.prototype, "animate", original);
  else Reflect.deleteProperty(Element.prototype, "animate");
});
function mockMotion() {
  const runs: { frames: Keyframe[]; options: KeyframeAnimationOptions; finish: () => void; cancel: ReturnType<typeof vi.fn> }[] = [];
  Object.defineProperty(Element.prototype,"animate",{configurable:true,writable:true,value:(frames:Keyframe[],options:KeyframeAnimationOptions)=>{
    let finish!:()=>void;
    const finished=new Promise<void>(resolve=>{finish=resolve;});const cancel=vi.fn();
    runs.push({frames,options,finish,cancel});
    return {finished,cancel};
  }});
  return runs;
}
function Demo() { return <TooltipProvider><Tooltip content="First reset" contentClassName="test-tooltip"><button>First</button></Tooltip><Tooltip content="Second reset"><button>Second</button></Tooltip><button>Outside</button></TooltipProvider>; }

it("opens keyboard tooltips immediately without motion and closes with Escape", async () => {
  const runs=mockMotion(),user=userEvent.setup(); render(<Demo />);
  await user.tab(); expect(await screen.findByRole("tooltip")).toHaveTextContent("First reset");
  expect(runs).toHaveLength(0);
  await user.keyboard("{Escape}"); expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("keeps pointer exit mounted until its fade finishes and hides it from accessibility", async () => {
  const runs=mockMotion(),user=userEvent.setup(); render(<Demo />);
  await user.hover(screen.getByRole("button",{name:"First"}));
  await screen.findByRole("tooltip");
  expect(runs[runs.length-1]?.options.duration).toBe(200);
  await act(async()=>runs[runs.length-1]!.finish());
  const content=document.querySelector(".test-tooltip")!;
  await user.click(screen.getByRole("button",{name:"Outside"}));
  expect(runs[runs.length-1]?.options.duration).toBe(200);
  expect(content).toBeInTheDocument(); expect(content).toHaveAttribute("aria-hidden","true");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  await act(async()=>runs[runs.length-1]!.finish());
  await waitFor(()=>expect(content).not.toBeInTheDocument());
});

it("reopens the same closing tooltip from its current frame and ignores its cancelled exit", async () => {
  const runs=mockMotion(),user=userEvent.setup(); render(<Demo />);
  await user.hover(screen.getByRole("button",{name:"First"})); await screen.findByRole("tooltip");
  await act(async()=>runs[runs.length-1]!.finish());
  await user.click(screen.getByRole("button",{name:"Outside"}));
  const exit=runs[runs.length-1]!; const content=document.querySelector<HTMLElement>(".test-tooltip")!;
  content.style.opacity="0.4";
  fireEvent.pointerMove(document.body,{pointerType:"mouse",clientX:1000,clientY:1000});
  await user.hover(screen.getByRole("button",{name:"First"}));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("First reset");
  expect(exit.cancel).toHaveBeenCalled();
  expect(runs[runs.length-1]?.frames[0].opacity).toBe("0.4");
  await act(async()=>exit.finish()); expect(content).toBeInTheDocument();
  await act(async()=>runs[runs.length-1]!.finish());
});

it("skips the entrance animation when moving to a neighbouring tooltip", async () => {
  const runs=mockMotion(),user=userEvent.setup(); render(<Demo />);
  await user.hover(screen.getByRole("button",{name:"First"})); await screen.findByRole("tooltip");
  await act(async()=>runs[runs.length-1]!.finish());
  await user.unhover(screen.getByRole("button",{name:"First"}));
  fireEvent.pointerMove(document.body,{pointerType:"mouse",clientX:1000,clientY:1000});
  await user.hover(screen.getByRole("button",{name:"Second"}));
  await waitFor(()=>expect(screen.getByRole("tooltip")).toHaveTextContent("Second reset"));
  expect(runs.filter(run=>run.frames[run.frames.length - 1]?.opacity === "1")).toHaveLength(1);
});
