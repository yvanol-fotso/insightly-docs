import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";

type ToastVariant = "success" | "warning" | "info" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  icon?: ReactNode;
  durationMs: number;
}

interface ToastOptions {
  variant?: ToastVariant;
  icon?: ReactNode;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_ICONS: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
  error: <XCircle size={18} />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = Date.now() + Math.random();
      const variant = options?.variant ?? "info";
      const durationMs = options?.durationMs ?? 5000;

      setToasts((prev) => [...prev, { id, message, variant, icon: options?.icon, durationMs }]);

      setTimeout(() => dismissToast(id), durationMs);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.variant}`}>
            <span className="toast__icon">{toast.icon ?? DEFAULT_ICONS[toast.variant]}</span>
            <span className="toast__message">{toast.message}</span>
            <button className="toast__close" onClick={() => dismissToast(toast.id)} aria-label="Fermer">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé à l'intérieur d'un ToastProvider");
  return ctx;
}