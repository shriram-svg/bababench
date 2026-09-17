import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { world, worlds } from "./content/data";
import { parsePost, plainText } from "./content/post";
import type { Block, Inline, ListItem } from "./content/post";
import postSource from "./content/post.md?raw";
import { Leaderboard, TradeoffChart, OutcomeChart } from "./components/Results";
import { TranslatorFigure } from "./components/TranslatorFigure";

const REPO = "https://github.com/shriram-svg/bababench";

/* The article text lives in src/content/post.md (edit it with `pnpm post`).
   It is parsed once at module load so the SSR prerender stays deterministic. */
const POST = parsePost(postSource);
const VARS: Record<string, string> = { case_id: world.case_id, repo: REPO };
const expand = (s: string) =>
  s.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_m, k: string) => VARS[k] ?? "");
const isExternal = (href: string) => /^https?:\/\//.test(href);

const withoutLongDashes = (text: string) =>
  text
    .replace(/(\d)[\u2013\u2014](\d)/g, "$1 to $2")
    .replace(/\s*[\u2013\u2014]\s*/g, ", ");

/* ---- headings with copyable anchors ---- */

function Heading({
  level,
  id,
  children,
}: {
  level: 2 | 3;
  id: string;
  children: ReactNode;
}) {
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag id={id}>
      {children}
      <a className="anchor" href={`#${id}`} aria-label="Link to this section">
        #
      </a>
    </Tag>
  );
}

/* ---- citations: inline markers with margin notes ---- */

const REFERENCES = POST.references;

/* Inline citation marker for `[^id]` in post.md. */
function Cite({ id }: { id: string }) {
  const n = REFERENCES.findIndex((r) => r.id === id) + 1;
  if (!n) return null;
  return (
    <sup className="citeMarker" id={`cite-${id}`} data-cite={id}>
      <a href={`#ref-${id}`} aria-label={`Reference ${n}`}>
        {n}
      </a>
    </sup>
  );
}

function ReferenceList() {
  return (
    <ol>
      {REFERENCES.map((ref) => (
        <li key={ref.id} id={`ref-${ref.id}`}>
          {ref.authors}. {ref.title}.{" "}
          <a href={ref.href} target="_blank" rel="noreferrer">
            {ref.label}
          </a>
          , {ref.year}.
        </li>
      ))}
    </ol>
  );
}

/* ---- reading position: progress line + active section ---- */

const SECTIONS = POST.sections;
const CONTENTS = POST.blocks.flatMap((block) =>
  block.t === "heading"
    ? [{ id: block.id, label: block.id === "intro" ? "Introduction" : plainText(block.c), level: block.level }]
    : [],
);

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion() {
  return window.matchMedia(REDUCED_MOTION).matches;
}

function useReadingPosition() {
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(SECTIONS[0][0]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const scrollable = document.body.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0);
      setScrolled(window.scrollY > 240);
      let current = SECTIONS[0][0];
      const line = Math.min(240, window.innerHeight * 0.3);
      for (const { id } of CONTENTS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      const atEnd =
        window.scrollY + window.innerHeight >= document.body.scrollHeight - 4;
      setActive(atEnd ? CONTENTS[CONTENTS.length - 1].id : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return { progress, active, scrolled };
}

/* ---- scroll-reveal: blocks rise into place once, never on the way out ---- */

const REVEAL = [
  ".article > section > h2",
  ".article figure",
  ".note",
  ".brief",
  ".glossary",
  ".funnel",
  ".stage",
  ".claim",
  ".levers",
  ".trace > li",
  ".cta",
  ".quote",
  "ol.gates > li",
  "ol.walk > li",
  ".article > section > .codeblock",
].join(", ");

function useReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(REVEAL));
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("animIn");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    for (const node of nodes) {
      node.classList.add("animPrep");
      if (node.getBoundingClientRect().top < window.innerHeight * 0.92) {
        node.classList.add("animIn");
      } else {
        observer.observe(node);
      }
    }

    return () => observer.disconnect();
  }, []);
}

/* ---- share links ---- */

const SHARE_TEXT =
  "BabaBench: 47 simulated cases for the administrative work of patient advocacy";

function useShareLinks() {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href.split("#")[0]), []);
  const encoded = encodeURIComponent(url);
  return {
    x: `https://x.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encoded}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
  };
}

function ShareLinks({ className = "share" }: { className?: string }) {
  const share = useShareLinks();
  return (
    <div className={className}>
      <span className="tocLabel">Share</span>
      <div className="shareIcons">
        <a
          href={share.x}
          target="_blank"
          rel="noreferrer"
          aria-label="Share on X"
          title="Share on X"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              fill="currentColor"
              d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
            />
          </svg>
        </a>
        <a
          href={share.linkedin}
          target="_blank"
          rel="noreferrer"
          aria-label="Share on LinkedIn"
          title="Share on LinkedIn"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M3 9h4v12H3zm7 0h3.83v1.64h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.76V21h-4v-5.66c0-1.35-.03-3.08-1.95-3.08-1.96 0-2.26 1.46-2.26 2.98V21h-4z"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}

function ContentsLinks({ active, onNavigate }: { active: string; onNavigate?: () => void }) {
  let section = 0;
  return (
    <ol className="contentsList">
      {CONTENTS.map(({ id, label, level }) => {
        if (level === 2) section += 1;
        return (
          <li key={id} className={level === 3 ? "contentsSubsection" : undefined}>
            <a
              href={`#${id}`}
              onClick={onNavigate}
              className={active === id ? "tocOn" : undefined}
              aria-current={active === id ? "location" : undefined}
            >
              {level === 2 && <span className="contentsNumber" aria-hidden="true">{String(section).padStart(2, "0")}</span>}
              <span>{label}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

function Toc({ active }: { active: string }) {
  return (
    <nav className="toc" aria-label="Table of contents">
      <a className="tocLabel" href="#top">On this page</a>
      <ContentsLinks active={active} />
    </nav>
  );
}

function MobileContents({ active }: { active: string }) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && details.current && !details.current.contains(event.target)) {
        details.current.open = false;
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return (
    <details className="contentsMobile" ref={details} onKeyDown={(event) => {
      if (event.key === "Escape" && details.current) {
        details.current.open = false;
        details.current.querySelector("summary")?.focus();
      }
    }}>
      <summary>Contents <Chevron /></summary>
      <nav aria-label="Table of contents">
        <ContentsLinks active={active} onNavigate={() => {
          if (details.current) details.current.open = false;
        }} />
      </nav>
    </details>
  );
}

function TableWrap({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="tableScroll">
      <div className="tableWrap" tabIndex={0} role="region" aria-label={label}>
        {children}
      </div>
      <span className="tableHint" aria-hidden="true">
        Scroll table horizontally &rarr;
      </span>
    </div>
  );
}

/* ---- the shape of the benchmark, in four stages ---- */

type StageRow = [string, string, string]; // name, tag, detail

function Stages({ rows }: { rows: StageRow[] }) {
  return (
      <ol className="stages">
        {rows.map(([name, tag, detail], i) => (
          <li className="stage" key={name} style={{ "--d": `${i * 90}ms` } as CSSProperties}>
            <span className="stageNum">{String(i + 1).padStart(2, "0")}</span>
            <b className="stageName">{name}</b>
            <span className="stageTag">{tag}</span>
            <span className="stageDetail">{detail}</span>
          </li>
        ))}
      </ol>
  );
}

/* ---- what a certified route actually looks like ---- */

function Witness({ rows }: { rows: Array<[string, string]> }) {
  return (
      <ol className="trace">
        {rows.map(([tag, text], i) => (
          <li key={tag} style={{ "--d": `${i * 70}ms` } as CSSProperties}>
            <span className="traceTag">{tag}</span>
            <span className="traceText">{text}</span>
          </li>
        ))}
      </ol>
  );
}

/* ---- friction, added to a proven world and re-proven ---- */

type Lever = {
  name: string;
  party: string;
  field: string;
  value: string;
  note: string;
};

function Friction({ rows, proof }: { rows: Lever[]; proof: ReactNode }) {
  return (
      <div className="levers">
        {rows.map((lever, i) => (
          <div
            className="lever"
            key={lever.name}
            style={{ "--d": `${i * 80}ms` } as CSSProperties}
          >
            <span className="leverName">{lever.name}</span>
            <span className="leverSpec">
              <b>{lever.party}</b>
              <span className="leverField">{lever.field}</span>
              <span className="leverValue">{lever.value}</span>
            </span>
            <span className="leverNote">{lever.note}</span>
          </div>
        ))}
        <p className="leverProof">
          <span className="leverProofMark" aria-hidden="true">
            &#10003;
          </span>
          {proof}
        </p>
      </div>
  );
}

/* ---- the browsable world index ---- */

function Chevron() {
  return (
    <svg className="wChevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path
        d="M3 4.5 6 7.5 9 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WorldIndex() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [wide, setWide] = useState(false);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? worlds.filter((w) =>
        `${w.title} ${w.brief} ${w.contacts.join(" ")}`
          .toLowerCase()
          .includes(needle),
      )
    : worlds;

  return (
    <div className={wide ? "wIndex wIndexWide" : "wIndex"}>
      <div className="wBar">
        <span className="wCount">
          <b>{shown.length}</b>
          {shown.length === worlds.length ? " cases" : ` of ${worlds.length} cases`}
        </span>
        <input
          className="wSearch"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by condition, payer, party…"
          aria-label="Filter the 47 simulated cases"
        />
        <button
          type="button"
          className="wWidenBtn"
          onClick={() => setWide((v) => !v)}
          aria-pressed={wide}
        >
          {wide ? "Narrow" : "Widen"}
        </button>
      </div>
      <ul className="wList">
        {shown.map((w, i) => {
          const open = openId === w.case_id;
          return (
            <li className={open ? "wItem wItemOpen" : "wItem"} key={w.case_id}>
              <button
                type="button"
                className="wRow"
                aria-expanded={open}
                aria-controls={`world-${w.case_id}`}
                onClick={() => setOpenId(open ? null : w.case_id)}
              >
                <span className="wNum">{String(i + 1).padStart(2, "0")}</span>
                <span className="wTitle">{withoutLongDashes(w.title)}</span>
                <span className="wStat">
                  {w.parties} parties
                </span>
                <Chevron />
              </button>
              <div className="wPanel" id={`world-${w.case_id}`} hidden={!open}>
                <p className="wBrief">{withoutLongDashes(w.brief)}</p>
                <div className="wContacts">
                  <h4>Initially reachable</h4>
                  <ul>
                    {w.contacts.map((name) => (
                      <li key={name}>{withoutLongDashes(name)}</li>
                    ))}
                  </ul>
                </div>
                <span className="wId">Case {w.case_id}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? (
        <p className="wEmpty">No simulated case matches that filter.</p>
      ) : null}
    </div>
  );
}

/* ---- discovery map ---- */

function DiscoveryMap() {
  const dayOne = world.entities.filter((e) => e.day_one);
  const hidden = world.entities.filter((e) => !e.day_one);
  return (
    <div className="dmap">
        <div className="dmapCol">
          <h4>Initially reachable</h4>
          {dayOne.map((e, i) => (
            <div
              className="dmapNode dmapOpen"
              key={e.id}
              style={{ "--d": `${i * 60}ms` } as CSSProperties}
            >
              {e.name}
            </div>
          ))}
        </div>
        <div className="dmapArrow" aria-hidden="true">
          <span>discovery</span>
          <svg viewBox="0 0 48 8" width="48" height="8" focusable="false">
            <path d="M0 4h40" stroke="currentColor" strokeWidth="1.5" />
            <path d="M40 0.5 47 4 40 7.5Z" fill="currentColor" />
          </svg>
        </div>
        <div className="dmapCol">
          <h4>Hidden until discovered</h4>
          {hidden.map((e, i) => (
            <div
              className="dmapNode dmapHidden"
              key={e.id}
              style={{ "--d": `${140 + i * 60}ms` } as CSSProperties}
            >
              {e.name}
            </div>
          ))}
        </div>
    </div>
  );
}

/* ---- day-one brief ---- */

function Brief() {
  const heldDocs = world.documents.filter((d) => d.day_one);
  return (
    <div className="brief">
      <span className="briefLabel">Initial case brief</span>
      {withoutLongDashes(world.brief)
        .replace(/"([^"]*)"/g, "“$1”")
        .replace(/GOAL:/, "\nGOAL:")
        .split("\n")
        .map((para) => (
          <p key={para.slice(0, 24)}>{para}</p>
        ))}
      <div className="briefCols">
        <div>
          <h4>Documents in hand</h4>
          <ul>
            {heldDocs.map((d) => (
              <li key={d.id}>{d.title}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---- post renderer: post.md blocks -> the article markup ---- */

type RenderCtx = {
  tableLabel?: string; // aria label for a table inside `::: figure label="..."`
};

/* Component directives available to post.md as `<Name />`. */
const COMPONENTS: Record<
  string,
  (attrs: Record<string, string>, ctx: RenderCtx) => ReactNode
> = {
  Leaderboard: () => <Leaderboard />,
  TradeoffChart: () => <TradeoffChart />,
  OutcomeChart: () => <OutcomeChart />,
  TranslatorFigure: () => <TranslatorFigure />,
  WorldIndex: () => <WorldIndex />,
  DiscoveryMap: () => <DiscoveryMap />,
  Brief: () => <Brief />,
  ReferenceList: () => <ReferenceList />,
};

/* `- a | b | c` list items -> trimmed cell arrays. */
function rowsOf(blocks: Block[]): string[][] {
  const rows: string[][] = [];
  for (const b of blocks) {
    if (b.t !== "list") continue;
    for (const item of b.items) rows.push(item.raw.split("|").map((x) => x.trim()));
  }
  return rows;
}

function renderInlines(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return n.v;
      case "code":
        return <code key={i}>{n.v}</code>;
      case "strong":
        return <b key={i}>{renderInlines(n.c)}</b>;
      case "em":
        return <i key={i}>{renderInlines(n.c)}</i>;
      case "cite":
        return <Cite key={i} id={n.id} />;
      case "var":
        return VARS[n.name] ?? "";
      case "link": {
        const href = expand(n.href);
        const ext = isExternal(href);
        return (
          <a
            key={i}
            href={href}
            target={ext ? "_blank" : undefined}
            rel={ext ? "noreferrer" : undefined}
          >
            {renderInlines(n.c)}
          </a>
        );
      }
    }
  });
}

/* `**Title** rest` -> <b>Title</b><span>rest</span>, used by gates and pipe. */
function renderTitledItem(item: ListItem): ReactNode {
  const [first, ...rest] = item.c;
  if (!first || first.t !== "strong") return <span>{renderInlines(item.c)}</span>;
  if (rest[0]?.t === "text") rest[0] = { t: "text", v: rest[0].v.replace(/^\s+/, "") };
  return (
    <>
      <b>{renderInlines(first.c)}</b>
      <span>{renderInlines(rest)}</span>
    </>
  );
}

type ListStyle = { ol?: string; ul?: string; li?: string; titled?: boolean };

const LIST_STYLES: Record<string, ListStyle> = {
  leadList: { ul: "leadList" },
  workList: { ul: "workList" },
  gates: { ol: "gates", titled: true },
  pipe: { ol: "pipe", li: "pipeStage", titled: true },
};

function renderList(
  block: Extract<Block, { t: "list" }>,
  style: ListStyle = {},
  key?: number,
) {
  const Tag = block.ordered ? "ol" : "ul";
  const className = block.ordered ? style.ol : style.ul;
  return (
    <Tag key={key} className={className}>
      {block.items.map((item, i) => (
        <li key={i} className={style.li}>
          {style.titled ? renderTitledItem(item) : renderInlines(item.c)}
        </li>
      ))}
    </Tag>
  );
}

function collectLinks(blocks: Block[]): Array<Extract<Inline, { t: "link" }>> {
  const links: Array<Extract<Inline, { t: "link" }>> = [];
  for (const b of blocks) {
    if (b.t === "para") {
      for (const n of b.c) if (n.t === "link") links.push(n);
    }
  }
  return links;
}

function renderContainer(
  block: Extract<Block, { t: "container" }>,
  key: number,
  ctx: RenderCtx,
): ReactNode {
  const { name, c } = block;
  switch (name) {
    case "figure": {
      const hero = block.flags.includes("hero");
      const inner: RenderCtx = { tableLabel: block.attrs.label };
      const last = c[c.length - 1];
      const caption = last?.t === "para" ? last : null;
      const body = caption ? c.slice(0, -1) : c;
      return (
        <figure key={key} className={hero ? "heroFig" : undefined}>
          {renderBlocks(body, inner)}
          {caption ? <figcaption>{renderInlines(caption.c)}</figcaption> : null}
        </figure>
      );
    }
    case "note":
      return (
        <div key={key} className="note">
          <b>{block.arg}</b>
          <span>
            {c.map((b, i) =>
              b.t === "para" ? (
                <Fragment key={i}>{renderInlines(b.c)}</Fragment>
              ) : (
                renderBlock(b, i, ctx)
              ),
            )}
          </span>
        </div>
      );
    case "cta":
      return (
        <div key={key} className="cta">
          {collectLinks(c).map((link, i) => {
            const href = expand(link.href);
            const ext = isExternal(href);
            return (
              <a
                key={i}
                className={i === 0 ? "ctaPrimary" : "ctaSecondary"}
                href={href}
                target={ext ? "_blank" : undefined}
                rel={ext ? "noreferrer" : undefined}
              >
                {renderInlines(link.c)}
              </a>
            );
          })}
        </div>
      );
    case "walk":
      return (
        <ol key={key} className="walk">
          {c.map((step, i) => {
            if (step.t !== "container" || step.name !== "step") {
              return renderBlock(step, i, ctx);
            }
            const [title = "", actor = ""] = step.arg.split("|").map((s) => s.trim());
            let seenCode = false;
            return (
              <li key={i}>
                <div className="walkHead">
                  <b>{title}</b>
                  <span className={actor === "model call" ? "tagModel" : "tagPlain"}>
                    {actor}
                  </span>
                </div>
                {step.c.map((b, j) => {
                  if (b.t === "code") {
                    seenCode = true;
                    return renderBlock(b, j, ctx);
                  }
                  if (b.t === "para") {
                    return (
                      <p key={j} className={seenCode ? "walkNote" : undefined}>
                        {renderInlines(b.c)}
                      </p>
                    );
                  }
                  return renderBlock(b, j, ctx);
                })}
              </li>
            );
          })}
        </ol>
      );
    case "stages":
      return (
        <Stages
          key={key}
          rows={rowsOf(c).map(([name = "", tag = "", detail = ""]) => [name, tag, detail])}
        />
      );
    case "witness":
      return (
        <Witness key={key} rows={rowsOf(c).map(([tag = "", text = ""]) => [tag, text])} />
      );
    case "levers": {
      const proof = c.find((b) => b.t === "para");
      return (
        <Friction
          key={key}
          rows={rowsOf(c).map(([name = "", party = "", field = "", value = "", note = ""]) => ({
            name,
            party,
            field,
            value,
            note,
          }))}
          proof={proof && proof.t === "para" ? renderInlines(proof.c) : null}
        />
      );
    }
    case "references":
      return <ReferenceList key={key} />;
    default: {
      const style = LIST_STYLES[name];
      if (style && c.length === 1 && c[0].t === "list") {
        return renderList(c[0], style, key);
      }
      return (
        <div key={key} className={name}>
          {renderBlocks(c, ctx)}
        </div>
      );
    }
  }
}

function renderBlock(block: Block, key: number, ctx: RenderCtx): ReactNode {
  switch (block.t) {
    case "heading":
      return (
        <Heading key={key} level={block.level} id={block.id}>
          {renderInlines(block.c)}
        </Heading>
      );
    case "para":
      return <p key={key}>{renderInlines(block.c)}</p>;
    case "list":
      return renderList(block, {}, key);
    case "quote":
      return (
        <blockquote key={key} className="quote">
          {renderInlines(block.c)}
        </blockquote>
      );
    case "code":
      return (
        <div key={key} className="codeblock">
          <pre>{block.v}</pre>
        </div>
      );
    case "table":
      return (
        <TableWrap key={key} label={ctx.tableLabel ?? "Table"}>
          <table>
            <thead>
              <tr>
                {block.head.map((cell, i) => (
                  <th key={i} scope="col">
                    {renderInlines(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{renderInlines(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      );
    case "component": {
      const render = COMPONENTS[block.name];
      return render ? (
        <Fragment key={key}>{render(block.attrs, ctx)}</Fragment>
      ) : (
        <p key={key} className="walkNote">
          Unknown component: {block.name}
        </p>
      );
    }
    case "container":
      return renderContainer(block, key, ctx);
  }
}

function renderBlocks(blocks: Block[], ctx: RenderCtx): ReactNode[] {
  return blocks.map((b, i) => renderBlock(b, i, ctx));
}

/* Groups top-level blocks into <section> elements, one per h2. */
type Group = { id: string | null; blocks: Block[] };

function groupSections(blocks: Block[]): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  for (const b of blocks) {
    if (b.t === "heading" && b.level === 2) {
      current = { id: b.id, blocks: [b] };
      groups.push(current);
      continue;
    }
    if (!current) {
      current = { id: null, blocks: [] };
      groups.push(current);
    }
    current.blocks.push(b);
  }
  return groups;
}

function Article() {
  return (
    <>
      {groupSections(POST.blocks).map((g, i) => (
        <section key={i} className={g.id === "refs" ? "refs" : undefined}>
          {renderBlocks(g.blocks, {})}
        </section>
      ))}
    </>
  );
}

export default function App() {
  const { progress, active, scrolled } = useReadingPosition();
  const meta = POST.meta;
  useReveal();

  const activeHeading = CONTENTS.findIndex(({ id }) => id === active);
  const activeIndex = Math.max(0, CONTENTS.slice(0, activeHeading + 1).filter(({ level }) => level === 2).length - 1);
  const activeLabel = CONTENTS[activeHeading]?.label ?? "Introduction";

  return (
    <>
      <a className="skipLink" href="#intro">
        Skip to content
      </a>

      <div className="topbar">
        <div className="topbarInner">
          <a className="topbarBrand" href="#top" aria-label="BabaBench, top of page">BabaBench</a>
          <div
            className={scrolled ? "topbarWhere on" : "topbarWhere"}
            aria-hidden={!scrolled}
          >
            <span className="topbarStep">
              {String(activeIndex + 1).padStart(2, "0")}
              <i>/{String(SECTIONS.length).padStart(2, "0")}</i>
            </span>
            <span className="topbarSection">{activeLabel}</span>
            <span className="topbarPct">{Math.round(progress * 100)}%</span>
          </div>
          <MobileContents active={active} />
        </div>
        <div
          className="topbarProgress"
          style={{ transform: `scaleX(${progress})` }}
          aria-hidden="true"
        />
      </div>

      <Toc active={active} />

      <main className="article">
        <header className="postHeader" id="top">
          {meta.kicker ? <span className="postKicker">{meta.kicker}</span> : null}
          <h1 className="postTitle">{meta.title}</h1>
          <p className="postDek">{meta.dek}</p>
          <div className="heroMeta">
            <p className="postByline">
              {meta.byline}
            </p>
          </div>
          {POST.actions.length > 0 ? (
            <nav className="postLinks" aria-label="Article links">
              {POST.actions.map(([label, href]) => {
                const url = expand(href);
                const ext = isExternal(url);
                return (
                  <a
                    key={label}
                    href={url}
                    target={ext ? "_blank" : undefined}
                    rel={ext ? "noreferrer" : undefined}
                  >
                    {label}
                  </a>
                );
              })}
            </nav>
          ) : null}
        </header>

        <Article />

        <footer className="docFooter">
          <span>BabaBench</span>
          <span>Baba Research</span>
          <a href="#intro">Back to top</a>
          <ShareLinks className="share shareFooter" />
        </footer>
      </main>
    </>
  );
}
