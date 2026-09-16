// Dev-only Vite plugin: a local editor for src/content/post.md at /__edit/.
//
//   GET  /__edit/            the editor page (editor/index.html)
//   GET  /__edit/api/post    { text, mtime }
//   PUT  /__edit/api/post    body { text, base } -> writes the file; 409 if the
//                            file changed on disk since `base` was loaded
//   POST /__edit/api/build   runs `pnpm build` in the site root; returns the log
//
// Saving writes the file that App.tsx imports, so Vite's HMR updates the
// preview without a reload. Nothing here ships: `apply: "serve"` keeps the
// plugin out of production builds.
import { execFile } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const POST = resolve(here, "../src/content/post.md");
const PAGE = resolve(here, "index.html");

const mtimeOf = () => statSync(POST).mtimeMs;

function readBody(req) {
  return new Promise((done, fail) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => done(Buffer.concat(chunks).toString("utf8")));
    req.on("error", fail);
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function runBuild(cwd) {
  return new Promise((done) => {
    execFile(
      "pnpm",
      ["build"],
      { cwd, maxBuffer: 8 * 1024 * 1024, env: process.env },
      (error, stdout, stderr) => {
        done({
          ok: !error,
          output: [stdout, stderr, error ? String(error.message) : ""]
            .filter(Boolean)
            .join("\n"),
        });
      },
    );
  });
}

export function editorPlugin() {
  return {
    name: "post-editor",
    apply: "serve",
    configureServer(server) {
      const root = server.config.root;
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const path = url.pathname;
        if (!path.startsWith("/__edit")) return next();

        try {
          if (path === "/__edit") {
            res.statusCode = 302;
            res.setHeader("Location", "/__edit/");
            return res.end();
          }
          if (path === "/__edit/" && req.method === "GET") {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            return res.end(readFileSync(PAGE, "utf8"));
          }
          if (path === "/__edit/api/post" && req.method === "GET") {
            return sendJson(res, 200, {
              text: readFileSync(POST, "utf8"),
              mtime: mtimeOf(),
              file: POST,
            });
          }
          if (path === "/__edit/api/post" && req.method === "PUT") {
            const { text, base } = JSON.parse(await readBody(req));
            if (typeof text !== "string") {
              return sendJson(res, 400, { error: "text must be a string" });
            }
            const current = mtimeOf();
            if (typeof base === "number" && Math.abs(current - base) > 0.5) {
              return sendJson(res, 409, {
                error: "post.md changed on disk since you loaded it",
                mtime: current,
                text: readFileSync(POST, "utf8"),
              });
            }
            writeFileSync(POST, text, "utf8");
            return sendJson(res, 200, { ok: true, mtime: mtimeOf() });
          }
          if (path === "/__edit/api/build" && req.method === "POST") {
            return sendJson(res, 200, await runBuild(root));
          }
          return sendJson(res, 404, { error: "not found" });
        } catch (error) {
          return sendJson(res, 500, { error: String(error?.message ?? error) });
        }
      });
    },
  };
}
