import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { editorPlugin } from "./editor/plugin.mjs";
import { parseFrontMatter } from "./src/content/post";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// <title>, meta description and the social descriptions come from the front
// matter of src/content/post.md (page_title, page_description,
// share_description), so the whole page is edited in one file.
function postMeta(): Plugin {
  return {
    name: "post-front-matter-meta",
    transformIndexHtml(html) {
      const src = readFileSync(new URL("./src/content/post.md", import.meta.url), "utf8");
      const { meta } = parseFrontMatter(src.replace(/\r\n?/g, "\n").split("\n"));
      let out = html;
      if (meta.page_title) {
        out = out.replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.page_title)}</title>`);
      }
      if (meta.page_description) {
        out = out.replace(
          /(<meta\s+name="description"\s+content=")[^"]*(")/,
          `$1${esc(meta.page_description)}$2`,
        );
      }
      if (meta.share_description) {
        out = out.replace(
          /(<meta\s+(?:property="og:description"|name="twitter:description")\s+content=")[^"]*(")/g,
          `$1${esc(meta.share_description)}$2`,
        );
      }
      return out;
    },
  };
}

// Crawlers resolve og:image and og:url as absolute URLs only, so the deployed
// origin is supplied at build time: `SITE_URL=https://host/path pnpm build`.
// Without it the tags stay relative and no canonical is emitted.
function absoluteMeta(siteUrl: string): Plugin {
  const raw = siteUrl.trim();
  const site = raw ? (raw.endsWith("/") ? raw : `${raw}/`) : "";
  return {
    name: "absolute-social-meta",
    transformIndexHtml(html) {
      if (!site) return html;
      return html
        .replace(
          /(og:image|twitter:image)" content="\.\//g,
          `$1" content="${site}`,
        )
        .replace(
          "</head>",
          `  <link rel="canonical" href="${site}" />\n` +
            `    <meta property="og:url" content="${site}" />\n` +
            `  </head>`,
        );
    },
  };
}

// Build to a single deployable static page. `base: "./"` keeps asset paths relative
// so the output can be hosted from any path.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    postMeta(),
    absoluteMeta(loadEnv(mode, ".", "SITE_URL").SITE_URL ?? ""),
    // Local post editor at /__edit/ (dev server only): `pnpm edit`.
    editorPlugin(),
  ],
  base: "./",
}));
