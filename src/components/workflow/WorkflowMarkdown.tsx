"use client";

import React, { Suspense, useMemo } from "react";
import type { Components } from "react-markdown";

import { cx } from "../../lib/cx";
import { normalizeWorkflowMarkdown } from "../../lib/markdown/normalize-workflow-markdown";

function buildComponents(theme: "light" | "dark"): Components {
  const isLight = theme === "light";

  const link = isLight
    ? "text-blue-700 underline underline-offset-2 decoration-black/20 hover:text-blue-800"
    : "text-cyan-200/90 underline underline-offset-4 decoration-white/20 hover:text-cyan-100";

  const inlineCode = isLight
    ? "rounded-md border border-black/10 bg-black/[0.04] px-1.5 py-0.5 text-[0.95em] text-black/90"
    : "rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[0.95em] text-white/90";

  const blockCode = isLight
    ? "block whitespace-pre-wrap break-words rounded-xl border border-black/10 bg-black/[0.03] p-4 text-[13px] leading-6 text-black/90"
    : "block whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/40 p-4 text-[13px] leading-6 text-white/90";

  const h1 = isLight
    ? "mt-2 text-[22px] font-semibold text-black"
    : "mt-2 text-[22px] font-semibold text-white";
  const h2 = isLight
    ? "mt-6 text-[18px] font-semibold text-black"
    : "mt-6 text-[18px] font-semibold text-white";
  const h3 = isLight
    ? "mt-5 text-[16px] font-semibold text-black"
    : "mt-5 text-[16px] font-semibold text-white";

  const p = isLight ? "my-3 text-black/90" : "my-3 text-white/90";
  const ul = isLight ? "my-3 list-disc pl-6 text-black/90" : "my-3 list-disc pl-6 text-white/90";
  const ol = isLight
    ? "my-3 list-decimal pl-6 text-black/90"
    : "my-3 list-decimal pl-6 text-white/90";
  const li = "my-1.5";

  const bq = isLight
    ? "my-4 border-l-2 border-black/15 bg-black/[0.02] pl-4 pr-3 py-2 text-black/80"
    : "my-4 border-l-2 border-white/15 bg-white/[0.03] pl-4 pr-3 py-2 text-white/80";

  const hr = isLight ? "my-6 border-black/10" : "my-6 border-white/10";

  const tableWrap = isLight
    ? "my-4 overflow-auto rounded-2xl border border-black/10"
    : "my-4 overflow-auto rounded-2xl border border-white/10";
  const table = isLight
    ? "w-full border-collapse text-sm text-black/88"
    : "w-full border-collapse text-sm text-white/88";
  const th = isLight
    ? "border-b border-black/10 bg-black/[0.03] px-3 py-2 text-left font-semibold"
    : "border-b border-white/10 bg-white/[0.04] px-3 py-2 text-left font-semibold";
  const td = isLight
    ? "border-b border-black/[0.08] px-3 py-2 align-top"
    : "border-b border-white/5 px-3 py-2 align-top";

  return {
    a: (props) => (
      <a {...props} className={cx(link, props.className)} target="_blank" rel="noreferrer" />
    ),
    code: (props) => {
      const inline =
        !("data-language" in props) && !String(props.className ?? "").includes("language-");
      if (inline) {
        return <code {...props} className={cx(inlineCode, props.className)} />;
      }
      return <code {...props} className={cx(blockCode, props.className)} />;
    },
    pre: (props) => <pre {...props} className={cx("overflow-auto", props.className)} />,
    h1: (props) => <h1 {...props} className={cx(h1, props.className)} />,
    h2: (props) => <h2 {...props} className={cx(h2, props.className)} />,
    h3: (props) => <h3 {...props} className={cx(h3, props.className)} />,
    p: (props) => <p {...props} className={cx(p, props.className)} />,
    ul: (props) => <ul {...props} className={cx(ul, props.className)} />,
    ol: (props) => <ol {...props} className={cx(ol, props.className)} />,
    li: (props) => <li {...props} className={cx(li, props.className)} />,
    blockquote: (props) => <blockquote {...props} className={cx(bq, props.className)} />,
    hr: (props) => <hr {...props} className={cx(hr, props.className)} />,
    table: (props) => (
      <div className={tableWrap}>
        <table {...props} className={cx(table, props.className)} />
      </div>
    ),
    th: (props) => <th {...props} className={cx(th, props.className)} />,
    td: (props) => <td {...props} className={cx(td, props.className)} />,
  };
}

const LazyMarkdownBody = React.lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
    import("react-markdown"),
    import("remark-gfm"),
  ]);

  function MarkdownBody({ text, theme }: { text: string; theme: "light" | "dark" }) {
    const normalized = useMemo(() => normalizeWorkflowMarkdown(text), [text]);
    const components = useMemo(() => buildComponents(theme), [theme]);
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalized}
      </ReactMarkdown>
    );
  }

  return { default: MarkdownBody };
});

export function WorkflowMarkdown({
  text,
  theme,
  className,
}: {
  text: string;
  theme: "light" | "dark";
  className?: string;
}) {
  const fallbackCls =
    theme === "light" ? "text-black/80 whitespace-pre-wrap" : "text-white/80 whitespace-pre-wrap";

  return (
    <div className={cx("markdown-content text-base leading-[1.85]", className)}>
      <Suspense fallback={<div className={fallbackCls}>{text}</div>}>
        <LazyMarkdownBody text={text} theme={theme} />
      </Suspense>
    </div>
  );
}
