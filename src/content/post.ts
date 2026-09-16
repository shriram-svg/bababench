/* Parser for the post's Markdown dialect (src/content/post.md).
 *
 * The dialect is plain Markdown (headings, paragraphs, lists, quotes, fenced
 * code, tables, bold, italic, code spans, links) plus three extensions:
 *
 *   {{name}}            a variable substituted at render time (case_id, repo)
 *   [^id]               a citation marker for the reference with that id
 *   ::: name args       a container; `:::` on its own line closes the innermost
 *   <Name attr="v" />   a component directive rendered by App.tsx
 *
 * The parser is dependency-free and runs at module load, so it must stay
 * deterministic for the SSR prerender.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "cite"; id: string }
  | { t: "var"; name: string };

export type ListItem = { raw: string; c: Inline[] };

export type Block =
  | { t: "heading"; level: 2 | 3; id: string; c: Inline[] }
  | { t: "para"; c: Inline[] }
  | { t: "list"; ordered: boolean; items: ListItem[] }
  | { t: "quote"; c: Inline[] }
  | { t: "code"; lang: string; v: string }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "component"; name: string; attrs: Record<string, string> }
  | {
      t: "container";
      name: string;
      arg: string;
      flags: string[];
      attrs: Record<string, string>;
      c: Block[];
    };

export type Reference = {
  id: string;
  authors: string;
  title: string;
  href: string;
  label: string;
  year: string;
};

export type Post = {
  meta: Record<string, string>;
  stats: Array<[string, string]>;
  actions: Array<[string, string]>;
  blocks: Block[];
  references: Reference[];
  sections: Array<[string, string]>;
};

/* ---- inline ---- */

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", v: text });
    text = "";
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length) {
      text += s[i + 1];
      i += 2;
      continue;
    }
    if (ch === "`") {
      const j = s.indexOf("`", i + 1);
      if (j > i) {
        flush();
        out.push({ t: "code", v: s.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
    }
    if (s.startsWith("**", i)) {
      const j = s.indexOf("**", i + 2);
      if (j > i + 1) {
        flush();
        out.push({ t: "strong", c: parseInline(s.slice(i + 2, j)) });
        i = j + 2;
        continue;
      }
    }
    if (ch === "*") {
      const j = s.indexOf("*", i + 1);
      if (j > i) {
        flush();
        out.push({ t: "em", c: parseInline(s.slice(i + 1, j)) });
        i = j + 1;
        continue;
      }
    }
    if (s.startsWith("[^", i)) {
      const j = s.indexOf("]", i);
      if (j > i) {
        flush();
        out.push({ t: "cite", id: s.slice(i + 2, j).trim() });
        i = j + 1;
        continue;
      }
    }
    if (ch === "[") {
      const mid = s.indexOf("](", i);
      const end = mid > 0 ? s.indexOf(")", mid + 2) : -1;
      if (end > 0) {
        flush();
        out.push({
          t: "link",
          href: s.slice(mid + 2, end).trim(),
          c: parseInline(s.slice(i + 1, mid)),
        });
        i = end + 1;
        continue;
      }
    }
    if (s.startsWith("{{", i)) {
      const j = s.indexOf("}}", i);
      if (j > i) {
        flush();
        out.push({ t: "var", name: s.slice(i + 2, j).trim() });
        i = j + 2;
        continue;
      }
    }
    text += ch;
    i += 1;
  }
  flush();
  return out;
}

export function plainText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case "text":
        case "code":
          return n.v;
        case "strong":
        case "em":
        case "link":
          return plainText(n.c);
        default:
          return "";
      }
    })
    .join("");
}

/* ---- blocks ---- */

const RE_HEADING = /^(#{2,3})\s+(.*?)(?:\s*\{#([\w-]+)\})?\s*$/;
const RE_CONTAINER_OPEN = /^:::\s*([\w-]+)(.*)$/;
const RE_CONTAINER_CLOSE = /^:::\s*$/;
const RE_COMPONENT = /^<([A-Z]\w*)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*\/>\s*$/;
const RE_FENCE = /^```(\w*)\s*$/;
const RE_LIST_ITEM = /^\s{0,3}(?:([-*])|(\d+)\.)\s+(.*)$/;
const RE_TABLE_ROW = /^\|.*\|\s*$/;
const RE_TABLE_SEP = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseAttrs(s: string): { attrs: Record<string, string>; rest: string } {
  const attrs: Record<string, string> = {};
  const rest = s
    .replace(/([\w-]+)="([^"]*)"/g, (_m, k: string, v: string) => {
      attrs[k] = v;
      return " ";
    })
    .replace(/\b([\w-]+)=(\S+)/g, (_m, k: string, v: string) => {
      attrs[k] = v;
      return " ";
    });
  return { attrs, rest: rest.replace(/\s+/g, " ").trim() };
}

function splitRow(line: string): string[] {
  const cells = line.trim().split("|");
  if (cells[0].trim() === "") cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((c) => c.trim());
}

function startsBlock(line: string): boolean {
  return (
    RE_HEADING.test(line) ||
    RE_CONTAINER_OPEN.test(line) ||
    RE_CONTAINER_CLOSE.test(line) ||
    RE_COMPONENT.test(line) ||
    RE_FENCE.test(line) ||
    RE_LIST_ITEM.test(line) ||
    RE_TABLE_ROW.test(line) ||
    line.startsWith("> ") ||
    line === ">"
  );
}

class Cursor {
  i = 0;
  constructor(public lines: string[]) {}
  get done() {
    return this.i >= this.lines.length;
  }
  peek() {
    return this.lines[this.i];
  }
  next() {
    return this.lines[this.i++];
  }
}

function parseBlocks(cur: Cursor, inContainer: boolean): Block[] {
  const blocks: Block[] = [];
  while (!cur.done) {
    const line = cur.peek();
    if (line.trim() === "") {
      cur.next();
      continue;
    }
    if (RE_CONTAINER_CLOSE.test(line)) {
      if (inContainer) return blocks;
      cur.next(); // stray close at top level: ignore
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(RE_HEADING))) {
      // Headings never live inside a container, so a heading also closes any
      // container whose `:::` was forgotten.
      if (inContainer) return blocks;
      cur.next();
      const c = parseInline(m[2]);
      blocks.push({
        t: "heading",
        level: m[1].length === 2 ? 2 : 3,
        id: m[3] ?? slug(plainText(c)),
        c,
      });
      continue;
    }
    if ((m = line.match(RE_CONTAINER_OPEN))) {
      cur.next();
      const { attrs, rest } = parseAttrs(m[2]);
      const c = parseBlocks(cur, true);
      if (!cur.done && RE_CONTAINER_CLOSE.test(cur.peek())) cur.next();
      blocks.push({
        t: "container",
        name: m[1],
        arg: rest,
        flags: rest ? rest.split(" ") : [],
        attrs,
        c,
      });
      continue;
    }
    if ((m = line.match(RE_COMPONENT))) {
      cur.next();
      blocks.push({ t: "component", name: m[1], attrs: parseAttrs(m[2]).attrs });
      continue;
    }
    if ((m = line.match(RE_FENCE))) {
      cur.next();
      const body: string[] = [];
      while (!cur.done && !/^```\s*$/.test(cur.peek())) body.push(cur.next());
      if (!cur.done) cur.next();
      blocks.push({ t: "code", lang: m[1], v: body.join("\n") });
      continue;
    }
    if (line.startsWith(">")) {
      const parts: string[] = [];
      while (!cur.done && cur.peek().startsWith(">")) {
        parts.push(cur.next().replace(/^>\s?/, ""));
      }
      blocks.push({ t: "quote", c: parseInline(parts.join(" ").trim()) });
      continue;
    }
    if (RE_LIST_ITEM.test(line)) {
      const ordered = /^\s{0,3}\d+\./.test(line);
      const items: ListItem[] = [];
      while (!cur.done && (m = cur.peek().match(RE_LIST_ITEM))) {
        cur.next();
        let raw = m[3];
        while (
          !cur.done &&
          cur.peek().trim() !== "" &&
          !startsBlock(cur.peek())
        ) {
          raw += " " + cur.next().trim();
        }
        items.push({ raw, c: parseInline(raw) });
      }
      blocks.push({ t: "list", ordered, items });
      continue;
    }
    if (RE_TABLE_ROW.test(line)) {
      const rows: string[][] = [];
      while (!cur.done && RE_TABLE_ROW.test(cur.peek())) {
        const row = cur.next();
        if (RE_TABLE_SEP.test(row)) continue;
        rows.push(splitRow(row));
      }
      const [head, ...body] = rows;
      blocks.push({
        t: "table",
        head: (head ?? []).map(parseInline),
        rows: body.map((r) => r.map(parseInline)),
      });
      continue;
    }
    // paragraph: consecutive non-blank lines that do not start another block
    const parts: string[] = [cur.next().trim()];
    while (!cur.done && cur.peek().trim() !== "" && !startsBlock(cur.peek())) {
      parts.push(cur.next().trim());
    }
    blocks.push({ t: "para", c: parseInline(parts.join(" ")) });
  }
  return blocks;
}

/* ---- front matter, references, sections ---- */

export function parseFrontMatter(lines: string[]): {
  meta: Record<string, string>;
  rest: string[];
} {
  const meta: Record<string, string> = {};
  if (lines[0]?.trim() !== "---") return { meta, rest: lines };
  let i = 1;
  for (; i < lines.length && lines[i].trim() !== "---"; i += 1) {
    const m = lines[i].match(/^([\w-]+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return { meta, rest: lines.slice(i + 1) };
}

/* "label=value; label=value" -> pairs (split on the first "=" only). */
function parsePairs(s: string | undefined): Array<[string, string]> {
  if (!s) return [];
  return s
    .split(";")
    .map((pair): [string, string] => {
      const i = pair.indexOf("=");
      return i < 0
        ? [pair.trim(), ""]
        : [pair.slice(0, i).trim(), pair.slice(i + 1).trim()];
    })
    .filter(([k]) => !!k);
}

function findContainers(blocks: Block[], name: string): Block[] {
  const found: Block[] = [];
  for (const b of blocks) {
    if (b.t !== "container") continue;
    if (b.name === name) found.push(b);
    found.push(...findContainers(b.c, name));
  }
  return found;
}

function parseReferences(blocks: Block[]): Reference[] {
  const refs: Reference[] = [];
  for (const box of findContainers(blocks, "references")) {
    if (box.t !== "container") continue;
    for (const list of box.c) {
      if (list.t !== "list") continue;
      for (const item of list.items) {
        const m = item.raw.match(/^\[([\w-]+)\]\s*(.*)$/);
        if (!m) continue;
        const [authors = "", title = "", href = "", label = "", year = ""] =
          m[2].split("|").map((p) => p.trim());
        refs.push({ id: m[1], authors, title, href, label, year });
      }
    }
  }
  return refs;
}

export function parsePost(source: string): Post {
  const { meta, rest } = parseFrontMatter(source.replace(/\r\n?/g, "\n").split("\n"));
  const blocks = parseBlocks(new Cursor(rest), false);
  const sections: Array<[string, string]> = [];
  for (const b of blocks) {
    if (b.t === "heading" && b.level === 2) sections.push([b.id, plainText(b.c)]);
  }
  return {
    meta,
    stats: parsePairs(meta.stats),
    actions: parsePairs(meta.actions),
    blocks,
    references: parseReferences(blocks),
    sections,
  };
}
