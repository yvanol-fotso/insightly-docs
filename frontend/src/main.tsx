import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ToastProvider } from "./components/ui/toast/ToastProvider";
import { SubscriptionProvider } from "./context/SubscriptionProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <SubscriptionProvider>
        <App />
      </SubscriptionProvider>
    </ToastProvider>
  </StrictMode>
);
