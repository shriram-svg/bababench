import { renderToString } from "react-dom/server";
import App from "./App.tsx";

// Rendered once at build time by scripts/prerender.mjs so the shipped HTML carries
// the whole article for crawlers, readers with JS off, and reader modes.
export function render() {
  return renderToString(<App />);
}
