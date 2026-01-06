// src/app/docs/components/DocRenderer.tsx
import React from "react";

type Block =
  | { type: "h"; level: 2 | 3; text: string; id: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
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
      blocks.push({ type: "hr" });
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

    if (line.startsWith("## ")) {
      const text = line.slice(3).trim();
      blocks.push({ type: "h", level: 2, text, id: slugify(text) });
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      const text = line.slice(4).trim();
      blocks.push({ type: "h", level: 3, text, id: slugify(text) });
      i++;
      continue;
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
      if (cur.startsWith("## ")) break;
      if (cur.startsWith("### ")) break;
      if (cur.startsWith("- ")) break;
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
            b.level === 2
              ? "mt-12 text-xl sm:text-2xl font-semibold tracking-tight text-white/95 scroll-mt-24"
              : "mt-8 text-lg sm:text-xl font-semibold tracking-tight text-white/95 scroll-mt-24";

          const Tag = (b.level === 2 ? "h2" : "h3") as keyof JSX.IntrinsicElements;

          return (
            <Tag key={idx} id={b.id} className={cls}>
              {b.text}
            </Tag>
          );
        }

        if (b.type === "p") {
          return (
            <p key={idx} className="mt-3 text-[15px] leading-7 text-white/75 max-w-3xl">
              {b.text}
            </p>
          );
        }

        if (b.type === "ul") {
          return (
            <ul key={idx} className="mt-3 list-disc pl-6 text-white/75 max-w-3xl">
              {b.items.map((it, j) => (
                <li key={j} className="mt-1 text-[15px] leading-7">
                  {it}
                </li>
              ))}
            </ul>
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
