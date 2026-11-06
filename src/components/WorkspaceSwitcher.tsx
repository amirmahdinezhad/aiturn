import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { Workspace } from "../types";
import { AddIcon, CloseIcon, EditIcon } from "../icons";
import { Button } from "./ui/button";
import { useWorkspacePickerMotion } from "../useWorkspacePickerMotion";

function WorkspaceMark({ workspace }: { workspace: Workspace }) {
  const initials = workspace.name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join("").toUpperCase();
  return <span className="workspace-mark" aria-hidden="true">{initials || "W"}</span>;
}

/** A keyboard-operated workspace picker with contextual workspace actions. */
export function WorkspaceSwitcher({ workspace, workspaces, busy, status, onSelect, onCreate, onEdit }: {
  workspace: Workspace; workspaces: Workspace[]; busy: boolean; status: ReactNode;
  onSelect: (id: string) => void; onCreate: (origin?: HTMLElement) => void; onEdit?: () => void;
}) {
  const { open, motion, closing, setInput, changeOpen, contentRef, overlayRef } = useWorkspacePickerMotion();
  const nameId = useId();
  const pendingAction = useRef<"create" | "edit" | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const current = workspaces.filter(item => item.id === workspace.id);
  const others = workspaces.filter(item => item.id !== workspace.id);
  const ordered = [...current, ...others];
  const choose = (id: string) => {
    if (busy || closing) return;
    changeOpen(false);
    if (id !== workspace.id) onSelect(id);
  };
  const navigate = (event: KeyboardEvent, index: number) => {
    const target = event.key === "ArrowDown" ? (index + 1) % ordered.length
      : event.key === "ArrowUp" ? (index - 1 + ordered.length) % ordered.length
      : event.key === "Home" ? 0 : event.key === "End" ? ordered.length - 1 : null;
    if (target === null || !ordered.length) return;
    event.preventDefault(); buttons.current[target]?.focus();
  };
  const option = (item: Workspace) => {
    const index = ordered.findIndex(value => value.id === item.id);
    return <button key={item.id} ref={node => { buttons.current[index] = node; }} type="button" role="option" aria-selected={item.id === workspace.id} disabled={busy}
      className="workspace-choice" onClick={() => choose(item.id)} onKeyDown={event => navigate(event, index)}>
      <WorkspaceMark workspace={item} /><span dir="auto">{item.name}</span>
      {item.id === workspace.id ? <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 10 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
    </button>;
  };
  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Trigger asChild><button ref={trigger} type="button" role="combobox" aria-label="Workspace" aria-describedby={nameId} disabled={busy} className="workspace-picker" data-motion={motion} data-closing={closing || undefined}
      onPointerDown={() => setInput("pointer")} onKeyDown={() => setInput("instant")} onClick={event => { if (event.detail === 0) setInput("instant"); }}>
      <WorkspaceMark workspace={workspace} /><span className="workspace-picker-copy"><span className="brand-caption">Workspace</span><span className="workspace-picker-name"><strong id={nameId} dir="auto">{workspace.name}</strong><svg className="workspace-picker-chevron" aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>{status ? <span className="workspace-picker-status">{status}</span> : null}</span>
    </button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay ref={overlayRef} className="workspace-picker-overlay" data-motion={motion} onPointerDownCapture={() => setInput("pointer")} /><Dialog.Content ref={contentRef} className="workspace-picker-panel" data-motion={motion} data-closing={closing || undefined} aria-describedby={undefined}
      onKeyDownCapture={event => { if (event.key !== "Escape") setInput("instant"); }} onPointerDownCapture={() => setInput("pointer")}
      onOpenAutoFocus={event => { event.preventDefault(); buttons.current[0]?.focus(); }} onCloseAutoFocus={event => { if (pendingAction.current) { event.preventDefault(); const action = pendingAction.current; pendingAction.current = null; trigger.current?.focus(); if (action === "create") onCreate(trigger.current ?? undefined); else onEdit?.(); } }}>
      <div className="workspace-picker-head"><Dialog.Title>Workspaces</Dialog.Title><Dialog.Close asChild><Button size="icon-sm" variant="ghost" className="popup-close" aria-label="Close workspace picker"><CloseIcon size={17} /></Button></Dialog.Close></div>
      <div className="workspace-choices">
        {current.length ? <><p className="workspace-choice-label">Current workspace</p><div className="workspace-current-card">
          <div role="listbox" aria-label="Current workspace">{current.map(option)}</div>
          {onEdit ? <Button size="icon-sm" variant="ghost" className="workspace-edit" disabled={busy || closing} aria-label="Edit workspace" title="Edit workspace" onClick={() => { pendingAction.current = "edit"; changeOpen(false); }}><EditIcon size={18} /></Button> : null}
        </div></> : null}
        {others.length ? <><p className="workspace-choice-label">Other workspaces</p><div role="listbox" aria-label="Other workspaces">{others.map(option)}</div></> : null}
      </div>
      <div className="workspace-create-section"><Button variant="ghost" className="workspace-create" disabled={busy || closing} onClick={() => { pendingAction.current = "create"; changeOpen(false); }}><AddIcon size={18} />New workspace</Button></div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
