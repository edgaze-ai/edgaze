// src/app/docs/components/DocRenderer.tsx
"use client";

import React from "react";
import Link from "next/link";

type Block =
  | { type: "h"; level: 1 | 2 | 3 | 4; text: string; id: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; rows: string[][] }
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

    // Treat leading or repeated --- more gently to avoid double lines at top
    if (line.trim() === "---") {
      // Skip a horizontal rule if it's the very first block
      if (blocks.length > 0) {
        blocks.push({ type: "hr" });
      }
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

      // consume closing fence if present
      if (i < lines.length) i++;

      blocks.push({ type: "code", lang, code: code.join("\n") });
      continue;
    }

    // Headings — use trimmed line so leading spaces don't break parsing
    const t = line.trim();
    if (t.startsWith("# ")) {
      const text = t.slice(2).trim();
      blocks.push({ type: "h", level: 1, text, id: slugify(text) });
      i++;
      continue;
    }
    if (t.startsWith("## ")) {
      const text = t.slice(3).trim();
      blocks.push({ type: "h", level: 2, text, id: slugify(text) });
      i++;
      continue;
    }
    if (t.startsWith("### ")) {
      const text = t.slice(4).trim();
      blocks.push({ type: "h", level: 3, text, id: slugify(text) });
      i++;
      continue;
    }
    if (t.startsWith("#### ")) {
      const text = t.slice(5).trim();
      blocks.push({ type: "h", level: 4, text, id: slugify(text) });
      i++;
      continue;
    }

    // Numbered section heading (e.g. "1. Purpose of This Policy") when standalone; skip "4.1" style
    const numMatch = t.match(/^\d+\.\s+(.+)$/);
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
      // Otherwise treat as ordered list: collect all consecutive numbered lines
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

    // Markdown tables: | col | col | or |---|---|
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableRows: string[][] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        const t = cur.trim();
        if (!t.startsWith("|") || !t.endsWith("|")) break;
        // Skip separator row (only -, :, |, spaces)
        if (/^[\|\s\-:]+$/.test(t)) {
          i++;
          continue;
        }
        const cells = t
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        if (cells.length > 0) tableRows.push(cells);
        i++;
      }
      if (tableRows.length > 0) {
        blocks.push({ type: "table", rows: tableRows });
        continue;
      }
    }

    const p: string[] = [line.trim()];
    i++;

    while (i < lines.length) {
      const cur = lines[i] ?? "";

      if (!cur.trim()) break;
      if (cur.startsWith("## ")) break;
      if (cur.startsWith("### ")) break;
      if (cur.startsWith("#### ")) break;
      if (cur.startsWith("- ")) break;
      if (/^\d+\.\s+/.test(cur)) break;
      if (cur.trim().startsWith("|") && cur.trim().endsWith("|")) break;
      if (cur.startsWith("```")) break;
      if (cur.trim() === "---") break;

      p.push(cur.trim());
      i++;
    }

    blocks.push({ type: "p", text: p.join(" ") });
  }

  return blocks;
}

export default function DocRenderer({ content }: { content: string }) {
  const blocks = parse(content);

  return (
    <div className="max-w-none">
      {blocks.map((b, idx) => {
        if (b.type === "h") {
          const cls =
            b.level === 1
              ? "mt-12 text-2xl sm:text-3xl font-semibold tracking-tight text-white/95 scroll-mt-28"
              : b.level === 2
              ? "mt-10 text-xl sm:text-2xl font-semibold tracking-tight text-white/95 scroll-mt-24"
              : b.level === 3
              ? "mt-8 text-lg sm:text-xl font-semibold tracking-tight text-white/95 scroll-mt-24"
              : "mt-6 text-base sm:text-lg font-semibold tracking-tight text-white/95 scroll-mt-24";

          const Tag =
            (b.level === 1
              ? "h1"
              : b.level === 2
              ? "h2"
              : b.level === 3
              ? "h3"
              : "h4") as keyof React.JSX.IntrinsicElements;

          return (
            <Tag key={idx} id={b.id} className={cls}>
              {b.text}
            </Tag>
          );
        }

        if (b.type === "p") {
          // Convert **text** to <strong>text</strong> and [text](url) to <Link>
          const parts: (string | React.JSX.Element)[] = [];
          const text = b.text;
          let lastIndex = 0;
          
          // Process both bold and links - links first to avoid conflicts
          const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
          const boldRegex = /\*\*(.+?)\*\*/g;
          
          // Collect all matches with their positions
          const matches: Array<{ type: "link" | "bold"; start: number; end: number; text: string; url?: string }> = [];
          
          let match: RegExpExecArray | null;
          linkRegex.lastIndex = 0; // Reset regex
          while ((match = linkRegex.exec(text)) !== null) {
            const linkText = match[1];
            const linkUrl = match[2];
            const matchIndex = match.index;
            const matchLength = match[0]?.length;
            if (linkText && linkUrl && matchIndex !== undefined && matchLength !== undefined) {
              matches.push({
                type: "link",
                start: matchIndex,
                end: matchIndex + matchLength,
                text: linkText,
                url: linkUrl,
              });
            }
          }
          
          boldRegex.lastIndex = 0; // Reset regex
          while ((match = boldRegex.exec(text)) !== null) {
            const boldText = match[1];
            const matchIndex = match.index;
            const matchLength = match[0]?.length;
            if (boldText && matchIndex !== undefined && matchLength !== undefined) {
              matches.push({
                type: "bold",
                start: matchIndex,
                end: matchIndex + matchLength,
                text: boldText,
              });
            }
          }
          
          // Sort by position
          matches.sort((a, b) => a.start - b.start);
          
          // Remove overlapping matches (prefer links over bold)
          const filteredMatches: typeof matches = [];
          for (const m of matches) {
            const overlaps = filteredMatches.some(
              (f) => !(m.end <= f.start || m.start >= f.end)
            );
            if (!overlaps) {
              filteredMatches.push(m);
            }
          }
          
          // Build parts
          for (const m of filteredMatches) {
            // Add text before match
            if (m.start > lastIndex) {
              const beforeText = text.slice(lastIndex, m.start);
              parts.push(beforeText);
            }
            
            // Add the match
            if (m.type === "link") {
              const href = m.url || "#";
              const isExternal = href.startsWith("http");
              if (isExternal) {
                parts.push(
                  <a
                    key={m.start}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
                  >
                    {m.text}
                  </a>
                );
              } else {
                parts.push(
                  <Link
                    key={m.start}
                    href={href}
                    className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
                  >
                    {m.text}
                  </Link>
                );
              }
            } else {
              parts.push(
                <strong key={m.start} className="font-semibold text-white/90">
                  {m.text}
                </strong>
              );
            }
            
            lastIndex = m.end;
          }
          
          // Add remaining text
          if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
          }

          return (
            <p key={idx} className="mt-3 text-[15px] leading-7 text-white/75 max-w-3xl">
              {parts.length > 0 ? parts : b.text}
            </p>
          );
        }

        if (b.type === "ul") {
          return (
            <ul key={idx} className="mt-3 list-disc pl-6 text-white/75 max-w-3xl">
              {b.items.map((it, j) => {
                // Convert **text** to <strong>text</strong> and [text](url) to <Link> for list items
                const parts: (string | React.JSX.Element)[] = [];
                let lastIndex = 0;
                
                // Process both bold and links
                const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                const boldRegex = /\*\*(.+?)\*\*/g;
                
                const matches: Array<{ type: "link" | "bold"; start: number; end: number; text: string; url?: string }> = [];
                
                let match: RegExpExecArray | null;
                linkRegex.lastIndex = 0; // Reset regex
                while ((match = linkRegex.exec(it)) !== null) {
                  const linkText = match[1];
                  const linkUrl = match[2];
                  const matchIndex = match.index;
                  const matchLength = match[0]?.length;
                  if (linkText && linkUrl && matchIndex !== undefined && matchLength !== undefined) {
                    matches.push({
                      type: "link",
                      start: matchIndex,
                      end: matchIndex + matchLength,
                      text: linkText,
                      url: linkUrl,
                    });
                  }
                }
                
                boldRegex.lastIndex = 0; // Reset regex
                while ((match = boldRegex.exec(it)) !== null) {
                  const boldText = match[1];
                  const matchIndex = match.index;
                  const matchLength = match[0]?.length;
                  if (boldText && matchIndex !== undefined && matchLength !== undefined) {
                    matches.push({
                      type: "bold",
                      start: matchIndex,
                      end: matchIndex + matchLength,
                      text: boldText,
                    });
                  }
                }
                
                matches.sort((a, b) => a.start - b.start);
                
                const filteredMatches: typeof matches = [];
                for (const m of matches) {
                  const overlaps = filteredMatches.some(
                    (f) => !(m.end <= f.start || m.start >= f.end)
                  );
                  if (!overlaps) {
                    filteredMatches.push(m);
                  }
                }
                
                for (const m of filteredMatches) {
                  if (m.start > lastIndex) {
                    parts.push(it.slice(lastIndex, m.start));
                  }
                  
                  if (m.type === "link") {
                    const href = m.url || "#";
                    const isExternal = href.startsWith("http");
                    if (isExternal) {
                      parts.push(
                        <a
                          key={m.start}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
                        >
                          {m.text}
                        </a>
                      );
                    } else {
                      parts.push(
                        <Link
                          key={m.start}
                          href={href}
                          className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
                        >
                          {m.text}
                        </Link>
                      );
                    }
                  } else {
                    parts.push(
                      <strong key={m.start} className="font-semibold text-white/90">
                        {m.text}
                      </strong>
                    );
                  }
                  
                  lastIndex = m.end;
                }
                
                if (lastIndex < it.length) {
                  parts.push(it.slice(lastIndex));
                }

                return (
                  <li key={j} className="mt-1 text-[15px] leading-7">
                    {parts.length > 0 ? parts : it}
                  </li>
                );
              })}
            </ul>
          );
        }

        if (b.type === "ol") {
          return (
            <ol key={idx} className="mt-3 list-decimal pl-6 text-white/75 max-w-3xl space-y-1">
              {b.items.map((it, j) => {
                const parts: (string | React.JSX.Element)[] = [];
                let lastIndex = 0;
                const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                const boldRegex = /\*\*(.+?)\*\*/g;
                const matches: Array<{ type: "link" | "bold"; start: number; end: number; text: string; url?: string }> = [];
                let match: RegExpExecArray | null;
                linkRegex.lastIndex = 0;
                while ((match = linkRegex.exec(it)) !== null) {
                  const linkText = match[1];
                  const linkUrl = match[2];
                  const matchIndex = match.index;
                  const matchLength = match[0]?.length;
                  if (linkText && linkUrl && matchIndex !== undefined && matchLength !== undefined) {
                    matches.push({ type: "link", start: matchIndex, end: matchIndex + matchLength, text: linkText, url: linkUrl });
                  }
                }
                boldRegex.lastIndex = 0;
                while ((match = boldRegex.exec(it)) !== null) {
                  const boldText = match[1];
                  const matchIndex = match.index;
                  const matchLength = match[0]?.length;
                  if (boldText && matchIndex !== undefined && matchLength !== undefined) {
                    matches.push({ type: "bold", start: matchIndex, end: matchIndex + matchLength, text: boldText });
                  }
                }
                matches.sort((a, b) => a.start - b.start);
                const filteredMatches: typeof matches = [];
                for (const m of matches) {
                  const overlaps = filteredMatches.some((f) => !(m.end <= f.start || m.start >= f.end));
                  if (!overlaps) filteredMatches.push(m);
                }
                for (const m of filteredMatches) {
                  if (m.start > lastIndex) parts.push(it.slice(lastIndex, m.start));
                  if (m.type === "link") {
                    const href = m.url || "#";
                    const isExternal = href.startsWith("http");
                    if (isExternal) {
                      parts.push(<a key={m.start} href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline transition-colors">{m.text}</a>);
                    } else {
                      parts.push(<Link key={m.start} href={href} className="text-cyan-400 hover:text-cyan-300 underline transition-colors">{m.text}</Link>);
                    }
                  } else {
                    parts.push(<strong key={m.start} className="font-semibold text-white/90">{m.text}</strong>);
                  }
                  lastIndex = m.end;
                }
                if (lastIndex < it.length) parts.push(it.slice(lastIndex));
                return (
                  <li key={j} className="text-[15px] leading-7 pl-1">
                    {parts.length > 0 ? parts : it}
                  </li>
                );
              })}
            </ol>
          );
        }

        if (b.type === "table") {
          const renderCell = (text: string, isTh: boolean) => {
            const parts: (string | React.JSX.Element)[] = [];
            const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            const boldRegex = /\*\*(.+?)\*\*/g;
            const matches: Array<{ type: "link" | "bold"; start: number; end: number; text: string; url?: string }> = [];
            let match: RegExpExecArray | null;
            linkRegex.lastIndex = 0;
            while ((match = linkRegex.exec(text)) !== null) {
              if (match[1] && match[2]) matches.push({ type: "link", start: match.index, end: match.index + match[0].length, text: match[1], url: match[2] });
            }
            boldRegex.lastIndex = 0;
            while ((match = boldRegex.exec(text)) !== null) {
              if (match[1]) matches.push({ type: "bold", start: match.index, end: match.index + match[0].length, text: match[1] });
            }
            matches.sort((a, b) => a.start - b.start);
            let lastIndex = 0;
            for (const m of matches) {
              if (m.start > lastIndex) parts.push(text.slice(lastIndex, m.start));
              if (m.type === "link" && m.url) {
                const isExt = m.url.startsWith("http");
                parts.push(isExt ? <a key={m.start} href={m.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">{m.text}</a> : <Link key={m.start} href={m.url} className="text-cyan-400 hover:text-cyan-300 underline">{m.text}</Link>);
              } else parts.push(<strong key={m.start} className="font-semibold text-white/90">{m.text}</strong>);
              lastIndex = m.end;
            }
            if (lastIndex < text.length) parts.push(text.slice(lastIndex));
            return parts.length > 0 ? parts : text;
          };
          const [header, ...bodyRows] = b.rows;
          return (
            <div key={idx} className="mt-6 overflow-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[280px] text-left text-[14px]">
                {header && header.some((c) => c) && (
                  <thead>
                    <tr className="border-b border-white/15">
                      {header.map((cell, j) => (
                        <th key={j} className="px-4 py-3 font-semibold text-white/95 bg-white/[0.03]">
                          {renderCell(cell, true)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {bodyRows.map((row, ri) => (
                    <tr key={ri} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-4 py-3 text-white/75">
                          {renderCell(cell, false)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (b.type === "code") {
          return (
            <div key={idx} className="mt-6 overflow-auto rounded-2xl bg-black/35 ring-1 ring-white/10">
              <div className="px-4 py-2 text-xs text-white/45 border-b border-white/10">{b.lang || "code"}</div>
              <pre className="px-4 py-4 text-[13px] leading-6 text-white/85">
                <code>{b.code}</code>
              </pre>
            </div>
          );
        }

        if (b.type === "hr") {
          return <hr key={idx} className="my-10 border-white/10 max-w-3xl" />;
        }

        return null;
      })}
    </div>
  );
}
