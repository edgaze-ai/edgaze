"use client";

import React from "react";
import Link from "next/link";

type Block =
  | { type: "h"; level: 1 | 2 | 3 | 4; text: string; id: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; lang?: string; code: string }
  | { type: "hr" };

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function parse(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (!line.trim()) {
      i++;
      continue;
    }

    if (line.trim() === "---") {
      if (blocks.length > 0) blocks.push({ type: "hr" });
      i++;
      continue;
    }

    const fence = line.match(/^```(\w+)?$/);
    if (fence) {
      const lang = fence[1];
      i++;
      const code: string[] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        if (/^```$/.test(cur)) break;
        code.push(cur);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ type: "code", lang, code: code.join("\n") });
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({
        type: "h",
        level: 1,
        text: line.slice(2).trim(),
        id: slugify(line.slice(2).trim()),
      });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({
        type: "h",
        level: 2,
        text: line.slice(3).trim(),
        id: slugify(line.slice(3).trim()),
      });
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({
        type: "h",
        level: 3,
        text: line.slice(4).trim(),
        id: slugify(line.slice(4).trim()),
      });
      i++;
      continue;
    }
    if (line.startsWith("#### ")) {
      blocks.push({
        type: "h",
        level: 4,
        text: line.slice(5).trim(),
        id: slugify(line.slice(5).trim()),
      });
      i++;
      continue;
    }

    const numMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numMatch?.[1] != null) {
      const text = numMatch[1].trim();
      const nextLine = lines[i + 1]?.trim() ?? "";
      const nextIsNumbered = /^\d+\.\s+/.test(nextLine);
      const isSubNumber = /^\d/.test(text);
      if (!nextIsNumbered && !isSubNumber && text.length > 0) {
        blocks.push({ type: "h", level: 2, text, id: slugify(text) });
        i++;
        continue;
      }
      const olItems: string[] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        const m = cur.match(/^\d+\.\s+(.+)$/);
        if (!m?.[1]) break;
        olItems.push(m[1].trim());
        i++;
      }
      if (olItems.length > 0) {
        blocks.push({ type: "ol", items: olItems });
        continue;
      }
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        if (!cur.startsWith("- ")) break;
        items.push(cur.slice(2).trim());
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    const p: string[] = [line.trim()];
    i++;
    while (i < lines.length) {
      const cur = lines[i] ?? "";
      if (!cur.trim()) break;
      if (cur.startsWith("## ") || cur.startsWith("### ") || cur.startsWith("#### ")) break;
      if (cur.startsWith("- ") || /^\d+\.\s+/.test(cur)) break;
      if (cur.startsWith("```") || cur.trim() === "---") break;
      p.push(cur.trim());
      i++;
    }
    blocks.push({ type: "p", text: p.join(" ") });
  }

  return blocks;
}

const linkClass =
  "text-cyan-400 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-500/50 transition-colors";

export default function BlogRenderer({ content }: { content: string }) {
  const blocks = parse(content);

  return (
    <div className="max-w-none blog-prose">
      {blocks.map((b, idx) => {
        if (b.type === "h") {
          const cls =
            b.level === 1
              ? "mt-14 text-3xl sm:text-4xl font-semibold tracking-tight text-white/95 scroll-mt-32"
              : b.level === 2
                ? "mt-12 text-2xl sm:text-3xl font-semibold tracking-tight text-white/95 scroll-mt-28"
                : b.level === 3
                  ? "mt-10 text-xl sm:text-2xl font-semibold tracking-tight text-white/90 scroll-mt-28"
                  : "mt-8 text-lg sm:text-xl font-semibold tracking-tight text-white/90 scroll-mt-24";

          const Tag = (
            b.level === 1 ? "h1" : b.level === 2 ? "h2" : b.level === 3 ? "h3" : "h4"
          ) as keyof React.JSX.IntrinsicElements;

          return (
            <Tag key={idx} id={b.id} className={cls}>
              {b.text}
            </Tag>
          );
        }

        if (b.type === "p") {
          const parts: (string | React.JSX.Element)[] = [];
          const text = b.text;
          let lastIndex = 0;
          const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
          const boldRegex = /\*\*(.+?)\*\*/g;
          const italicRegex = /\*([^*]+)\*/g;
          const matches: Array<{
            type: "link" | "bold" | "italic";
            start: number;
            end: number;
            text: string;
            url?: string;
          }> = [];

          let match: RegExpExecArray | null;
          linkRegex.lastIndex = 0;
          while ((match = linkRegex.exec(text)) !== null) {
            if (match[1] && match[2]) {
              matches.push({
                type: "link",
                start: match.index,
                end: match.index + match[0].length,
                text: match[1],
                url: match[2],
              });
            }
          }
          boldRegex.lastIndex = 0;
          while ((match = boldRegex.exec(text)) !== null) {
            if (match[1]) {
              matches.push({
                type: "bold",
                start: match.index,
                end: match.index + match[0].length,
                text: match[1],
              });
            }
          }
          italicRegex.lastIndex = 0;
          while ((match = italicRegex.exec(text)) !== null) {
            if (match[1]) {
              matches.push({
                type: "italic",
                start: match.index,
                end: match.index + match[0].length,
                text: match[1],
              });
            }
          }
          matches.sort((a, b) => a.start - b.start);
          const filtered: typeof matches = [];
          for (const m of matches) {
            if (!filtered.some((f) => !(m.end <= f.start || m.start >= f.end))) filtered.push(m);
          }
          for (const m of filtered) {
            if (m.start > lastIndex) parts.push(text.slice(lastIndex, m.start));
            if (m.type === "link") {
              const href = m.url ?? "#";
              const isExt = href.startsWith("http");
              if (isExt) {
                parts.push(
                  <a
                    key={m.start}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {m.text}
                  </a>,
                );
              } else {
                parts.push(
                  <Link key={m.start} href={href} className={linkClass}>
                    {m.text}
                  </Link>,
                );
              }
            } else if (m.type === "bold") {
              parts.push(
                <strong key={m.start} className="font-semibold text-white/90">
                  {m.text}
                </strong>,
              );
            } else {
              parts.push(
                <em key={m.start} className="italic text-white/75">
                  {m.text}
                </em>,
              );
            }
            lastIndex = m.end;
          }
          if (lastIndex < text.length) parts.push(text.slice(lastIndex));

          return (
            <p
              key={idx}
              className="mt-5 text-base sm:text-lg leading-[1.8] text-white/80 max-w-3xl"
            >
              {parts.length > 0 ? parts : b.text}
            </p>
          );
        }

        if (b.type === "ul") {
          return (
            <ul
              key={idx}
              className="mt-5 list-disc pl-7 space-y-2.5 text-white/80 max-w-3xl text-base leading-8"
            >
              {b.items.map((it, j) => {
                const parts: (string | React.JSX.Element)[] = [];
                let last = 0;
                const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                const boldRegex = /\*\*(.+?)\*\*/g;
                const italicRegex = /\*([^*]+)\*/g;
                const ms: Array<{
                  type: "link" | "bold" | "italic";
                  start: number;
                  end: number;
                  text: string;
                  url?: string;
                }> = [];
                let m: RegExpExecArray | null;
                linkRegex.lastIndex = 0;
                while ((m = linkRegex.exec(it)) !== null) {
                  if (m[1] && m[2])
                    ms.push({
                      type: "link",
                      start: m.index,
                      end: m.index + m[0].length,
                      text: m[1],
                      url: m[2],
                    });
                }
                boldRegex.lastIndex = 0;
                while ((m = boldRegex.exec(it)) !== null) {
                  if (m[1])
                    ms.push({
                      type: "bold",
                      start: m.index,
                      end: m.index + m[0].length,
                      text: m[1],
                    });
                }
                italicRegex.lastIndex = 0;
                while ((m = italicRegex.exec(it)) !== null) {
                  if (m[1])
                    ms.push({
                      type: "italic",
                      start: m.index,
                      end: m.index + m[0].length,
                      text: m[1],
                    });
                }
                ms.sort((a, b) => a.start - b.start);
                for (const x of ms) {
                  if (x.start > last) parts.push(it.slice(last, x.start));
                  if (x.type === "link") {
                    const h = x.url ?? "#";
                    if (h.startsWith("http")) {
                      parts.push(
                        <a
                          key={x.start}
                          href={h}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkClass}
                        >
                          {x.text}
                        </a>,
                      );
                    } else {
                      parts.push(
                        <Link key={x.start} href={h} className={linkClass}>
                          {x.text}
                        </Link>,
                      );
                    }
                  } else if (x.type === "bold") {
                    parts.push(
                      <strong key={x.start} className="font-semibold text-white/90">
                        {x.text}
                      </strong>,
                    );
                  } else {
                    parts.push(
                      <em key={x.start} className="italic text-white/75">
                        {x.text}
                      </em>,
                    );
                  }
                  last = x.end;
                }
                if (last < it.length) parts.push(it.slice(last));
                return <li key={j}>{parts.length > 0 ? parts : it}</li>;
              })}
            </ul>
          );
        }

        if (b.type === "ol") {
          return (
            <ol
              key={idx}
              className="mt-5 list-decimal pl-7 space-y-2.5 text-white/80 max-w-3xl text-base leading-8"
            >
              {b.items.map((it, j) => {
                const parts: (string | React.JSX.Element)[] = [];
                let last = 0;
                const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                const boldRegex = /\*\*(.+?)\*\*/g;
                const italicRegex = /\*([^*]+)\*/g;
                const ms: Array<{
                  type: "link" | "bold" | "italic";
                  start: number;
                  end: number;
                  text: string;
                  url?: string;
                }> = [];
                let m: RegExpExecArray | null;
                linkRegex.lastIndex = 0;
                while ((m = linkRegex.exec(it)) !== null) {
                  if (m[1] && m[2])
                    ms.push({
                      type: "link",
                      start: m.index,
                      end: m.index + m[0].length,
                      text: m[1],
                      url: m[2],
                    });
                }
                boldRegex.lastIndex = 0;
                while ((m = boldRegex.exec(it)) !== null) {
                  if (m[1])
                    ms.push({
                      type: "bold",
                      start: m.index,
                      end: m.index + m[0].length,
                      text: m[1],
                    });
                }
                italicRegex.lastIndex = 0;
                while ((m = italicRegex.exec(it)) !== null) {
                  if (m[1])
                    ms.push({
                      type: "italic",
                      start: m.index,
                      end: m.index + m[0].length,
                      text: m[1],
                    });
                }
                ms.sort((a, b) => a.start - b.start);
                for (const x of ms) {
                  if (x.start > last) parts.push(it.slice(last, x.start));
                  if (x.type === "link") {
                    const h = x.url ?? "#";
                    if (h.startsWith("http")) {
                      parts.push(
                        <a
                          key={x.start}
                          href={h}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkClass}
                        >
                          {x.text}
                        </a>,
                      );
                    } else {
                      parts.push(
                        <Link key={x.start} href={h} className={linkClass}>
                          {x.text}
                        </Link>,
                      );
                    }
                  } else if (x.type === "bold") {
                    parts.push(
                      <strong key={x.start} className="font-semibold text-white/90">
                        {x.text}
                      </strong>,
                    );
                  } else {
                    parts.push(
                      <em key={x.start} className="italic text-white/75">
                        {x.text}
                      </em>,
                    );
                  }
                  last = x.end;
                }
                if (last < it.length) parts.push(it.slice(last));
                return <li key={j}>{parts.length > 0 ? parts : it}</li>;
              })}
            </ol>
          );
        }

        if (b.type === "code") {
          return (
            <div
              key={idx}
              className="mt-8 overflow-auto rounded-2xl bg-black/60 ring-1 ring-white/10 border border-white/5"
            >
              <div className="px-5 py-3 text-sm text-white/45 border-b border-white/10 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-500/60 to-pink-500/60" />
                {b.lang || "code"}
              </div>
              <pre className="px-5 py-5 text-[15px] leading-7 text-white/85 overflow-x-auto">
                <code>{b.code}</code>
              </pre>
            </div>
          );
        }

        if (b.type === "hr") {
          return (
            <hr
              key={idx}
              className="my-12 border-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent max-w-3xl"
            />
          );
        }

        return null;
      })}
    </div>
  );
}
