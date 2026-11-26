"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Icon from "./Icon";

/*
 * App-wide feedback: toasts (short confirmations, announced politely) and a confirmation dialog that
 * replaces window.confirm. The dialog is the native <dialog>, so focus trapping, Escape and the
 * backdrop come from the browser.
 */

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}
export interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface FeedbackApi {
  toast: (text: string, tone?: ToastTone) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

// Outside the provider (tests, isolated renders) fall back to the browser's own dialogs.
const FeedbackContext = createContext<FeedbackApi>({
  toast: () => {},
  confirm: async (o) => window.confirm(o.title),
});

export const useToast = () => useContext(FeedbackContext).toast;
export const useConfirm = () => useContext(FeedbackContext).confirm;

const TOAST_MS = 4500;

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const seq = useRef(0);

  const toast = useCallback((text: string, tone: ToastTone = "success") => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  );

  useEffect(() => {
    if (pending && !dialog.current?.open) dialog.current?.showModal();
  }, [pending]);

  function settle(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
    dialog.current?.close();
  }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="animate-fade-up pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-[var(--shadow-raised)]"
          >
            <Icon
              name={t.tone === "error" ? "alert" : t.tone === "info" ? "info" : "success"}
              className={`h-4.5 w-4.5 flex-none ${t.tone === "error" ? "text-red-300" : t.tone === "info" ? "text-ink-200" : "text-green-300"}`}
            />
            <span>{t.text}</span>
            <button
              type="button"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              className="-mr-1 ml-1 grid h-7 w-7 place-items-center rounded text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="Dismiss"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="confirm-title"
        onCancel={(e) => {
          e.preventDefault();
          settle(false);
        }}
        onClick={(e) => {
          if (e.target === dialog.current) settle(false);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-0 shadow-[var(--shadow-raised)] backdrop:bg-slate-900/50"
      >
        {pending && (
          <div className="p-5 sm:p-6">
            <h2 id="confirm-title" className="text-lg font-semibold text-slate-900">
              {pending.title}
            </h2>
            {pending.body && <div className="mt-2 text-sm leading-relaxed text-slate-600">{pending.body}</div>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => settle(false)} className="btn btn-secondary" autoFocus>
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button type="button" onClick={() => settle(true)} className={`btn ${pending.danger ? "btn-danger-solid" : "btn-primary"}`}>
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </FeedbackContext.Provider>
  );
}
