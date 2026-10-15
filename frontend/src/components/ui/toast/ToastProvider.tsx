import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CloseIcon, ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from "../Icons";
import { ToastContext } from "./ToastContext";
import type { ToastAction, ToastOptions, ToastVariant } from "./ToastContext";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  icon: ReactNode;
  action?: ToastAction;
}

const DEFAULT_ICONS: Record<ToastVariant, ReactNode> = {
  success: <SuccessIcon />,
  warning: <WarningIcon />,
  info: <InfoIcon />,
  error: <ErrorIcon />,
};

const DEFAULT_DURATION_MS = 5000;
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = nextId.current++;
      const variant = options?.variant ?? "info";

      setToasts((prev) =>
        [...prev, { id, message, variant, icon: options?.icon ?? DEFAULT_ICONS[variant], action: options?.action }].slice(
          -MAX_VISIBLE
        )
      );
      timers.current.set(
        id,
        setTimeout(() => dismissToast(id), options?.durationMs ?? DEFAULT_DURATION_MS)
      );
    },
    [dismissToast]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.variant}`}>
            <span className="toast__icon">{toast.icon}</span>
            <span className="toast__message">{toast.message}</span>
            {toast.action && (
              <button
                className="toast__action"
                onClick={() => {
                  toast.action?.onClick();
                  dismissToast(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button className="toast__close" onClick={() => dismissToast(toast.id)} aria-label="Dismiss">
              <CloseIcon size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
