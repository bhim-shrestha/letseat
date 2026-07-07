// Intercept and mute cross-origin "Script error." caused by browser extensions or iframe wrappers
if (typeof window !== "undefined") {
  // Override console.error to suppress cross-origin / third-party script error reporting
  const originalConsoleError = console.error;
  console.error = function (...args) {
    const argsStr = args.map(arg => String(arg || "")).join(" ").toLowerCase();
    if (
      argsStr.includes("script error") || 
      argsStr.includes("extension") ||
      argsStr.includes("chrome-extension") ||
      argsStr.includes("moz-extension")
    ) {
      console.warn("Muted console.error of third-party / cross-origin script error:", ...args);
      return;
    }
    return originalConsoleError.apply(console, args);
  };

  // Override window.onerror directly to suppress cross-origin script error logging
  const originalOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msgStr = String(message || "").toLowerCase();
    const srcStr = String(source || "").toLowerCase();
    if (
      msgStr.includes("script error") || 
      srcStr.includes("extensions") || 
      msgStr.includes("extension") ||
      srcStr.includes("chrome-extension") ||
      srcStr.includes("moz-extension")
    ) {
      console.warn("Muted third-party / cross-origin script error:", message, "from:", source);
      return true; // Prevents browser from propagating/logging the error to the parent iframe wrapper
    }
    if (originalOnError) {
      return (originalOnError as any).apply(this, arguments);
    }
    return false;
  };

  window.addEventListener("error", (event) => {
    const msg = (event.message || "").toLowerCase();
    const filename = (event.filename || "").toLowerCase();
    if (
      msg.includes("script error") || 
      filename.includes("extension") || 
      filename.includes("chrome-extension") ||
      filename.includes("moz-extension") ||
      msg.includes("extension")
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    const reasonStr = event.reason ? String(event.reason.message || event.reason || "").toLowerCase() : "";
    if (
      reasonStr.includes("script error") || 
      reasonStr.includes("extension") ||
      reasonStr.includes("chrome-extension") ||
      reasonStr.includes("moz-extension")
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

