import { createContext, type ReactNode } from "react";

export type ToastVariant = "success" | "warning" | "info" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  variant?: ToastVariant;
  icon?: ReactNode;
  durationMs?: number;
  /** Optional inline button, e.g. "View plans". Dismisses the toast when clicked. */
  action?: ToastAction;
}

export interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
