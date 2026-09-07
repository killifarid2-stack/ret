import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Bundled broadcast typography and country flags: no CDN/network dependency on the public display.
import "@fontsource/orbitron/400.css";
import "@fontsource/orbitron/500.css";
import "@fontsource/orbitron/600.css";
import "@fontsource/orbitron/700.css";
import "@fontsource/orbitron/800.css";
import "@fontsource/orbitron/900.css";
import "@fontsource/rajdhani/400.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/500.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/800.css";
import "@fontsource/cairo/900.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";
import "flag-icons/css/flag-icons.min.css";
import "./index.css";
// App.css holds the WOO-SE-GIROK referee-arms animation styles
// (.girok-judge-card / .girok-arms-image / .girok-sweep / .girok-particle...)
// and the Final Operations Hub page styles (.ops-*). It was never imported
// anywhere, so every component using those classes rendered completely
// unstyled (no card background, no positioning, no z-index) — the WOO-SE-GIROK
// three-judge panel showed raw text floating on top of a full-opacity arms
// image with no readable card boxes around the BLUE/RED vote buttons.
import "./App.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Errors thrown outside React's render cycle (event handlers, async code,
// timers) don't trigger the ErrorBoundary but can still leave the app stuck
// or the screen blank. Log them so they can be diagnosed instead of
// silently disappearing.
window.addEventListener('error', (e) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught error:', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled promise rejection:', e.reason);
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
