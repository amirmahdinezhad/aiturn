import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { CloseIcon } from "../icons";

const ModalLayer = createContext(0);

interface AppModalProps {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
  title: string;
  /** Centered header inside the body: which key/account this is about. */
  detail?: ReactNode;
  /** Fixed controls between the header and the scrollable body. */
  navigation?: ReactNode;
  cardClass?: string;
  overlayClass?: string;
  bodyId?: string;
  /** When set, a back chevron renders top-left in the header row. */
  onBack?: () => void;
  backLabel?: string;
  /** Wizard back navigation retains the draft in the mounted parent. */
  preserveDraftOnBack?: boolean;
  hasUnsavedChanges?: boolean;
  busy?: boolean;
  busyMessage?: string;
  /** Stable origin when the opening control belongs to a closing popup. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/** Shadcn dialog with fixed navigation and a scrollable panel body. */
export function AppModal({
  open,
  onClose,
  onExited,
  title,
  detail,
  navigation,
  cardClass,
  overlayClass,
  bodyId,
  onBack,
  backLabel = "Back",
  preserveDraftOnBack = false,
  hasUnsavedChanges = false,
  busy = false,
  busyMessage = "Saving changes…",
  children,
  returnFocusRef,
}: AppModalProps) {
  const layer = useContext(ModalLayer);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const discardDescription = useId();
  useEffect(() => { if (!open) setPendingAction(null); }, [open]);
  const requestLeave = (action: () => void) => {
    if (busy) return;
    if (hasUnsavedChanges) setPendingAction(() => action);
    else action();
  };
  return (
    <ModalLayer.Provider value={layer + 1}><Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) requestLeave(onClose);
      }}
    >
      <DialogContent
        layer={layer}
        className={`card${cardClass ? ` ${cardClass}` : ""}`}
        overlayClassName={overlayClass}
        aria-describedby={undefined}
        onOpenAutoFocus={() => {
          returnFocus.current = returnFocusRef?.current ?? (
            document.activeElement instanceof HTMLElement ? document.activeElement : null
          );
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          (returnFocusRef?.current ?? returnFocus.current)?.focus();
          onExited?.();
        }}
      >
        <div className="modal-head">
          {onBack ? (
            <Button
              className="modal-back"
              onClick={() => preserveDraftOnBack ? onBack() : requestLeave(onBack)}
              disabled={busy}
              aria-label={backLabel}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            </Button>
          ) : null}
          <DialogTitle>{title}</DialogTitle>
          <DialogClose asChild>
            <Button size="icon-sm" variant="ghost" className="icon popup-close" aria-label="Close" disabled={busy}>
              <CloseIcon size={20} />
            </Button>
          </DialogClose>
        </div>
        {navigation}
        <div id={bodyId} className="app-modal-body">
          {detail ? <div className="modal-detail">{detail}</div> : null}
          {children}
        </div>
        {busy ? <span className="sr-only" role="status">{busyMessage}</span> : null}
      </DialogContent>
      <Dialog open={open && !!pendingAction} onOpenChange={(next) => { if (!next) setPendingAction(null); }}>
        <DialogContent layer={layer + 1} overlayClassName="discard-confirm-overlay" className="card discard-confirm" role="alertdialog" aria-describedby={discardDescription}>
          <DialogTitle>Discard changes?</DialogTitle>
          <p id={discardDescription}>Your changes haven’t been saved.</p>
          <div className="discard-actions">
            <Button variant="default" onClick={() => setPendingAction(null)}>Keep editing</Button>
            <Button variant="destructive" onClick={() => { const leave = pendingAction; setPendingAction(null); leave?.(); }}>Discard changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog></ModalLayer.Provider>
  );
}

/** Keep a dialog and its last content mounted while Radix runs its exit. */
export function ModalTarget<T>({ target, children }: {
  target: T | null | undefined;
  children: (target: T, presence: { open: boolean; onExited: () => void }) => ReactNode;
}) {
  const [last, setLast] = useState(target);
  const open = target != null;
  const isOpen = useRef(open);
  isOpen.current = open;
  if (open && last !== target) setLast(target);
  const visible = target ?? last;
  return visible == null ? null : children(visible, {
    open,
    onExited: () => { if (!isOpen.current) setLast(null); },
  });
}
