// Injects the server-rendered article into dist/index.html so the page has real
// content without JavaScript. React hydrates over it on load.
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ssrEntry = resolve(root, "dist/ssr/entry-server.js");
const indexFile = resolve(root, "dist/index.html");

const { render } = await import(pathToFileURL(ssrEntry).href);
const html = readFileSync(indexFile, "utf8");
const marker = '<div id="root"></div>';

if (!html.includes(marker)) {
  throw new Error(`prerender: ${marker} not found in dist/index.html`);
}

writeFileSync(
  indexFile,
  html.replace(marker, `<div id="root">${render()}</div>`),
);
rmSync(resolve(root, "dist/ssr"), { recursive: true, force: true });
console.log("prerendered dist/index.html");
