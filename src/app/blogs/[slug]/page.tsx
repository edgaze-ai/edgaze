import { redirect, notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { getAllBlogs, getBlog } from "../utils/blogs";
import { getBlogHrefForSlug } from "../utils/routes";
import BlogRenderer from "../components/BlogRenderer";
import { extractToc } from "../../docs/utils/extractToc";
import { Calendar, ArrowLeft, ArrowRight } from "lucide-react";
import { normalizeSafeSlug } from "@/lib/security/safe-values";

export function generateStaticParams() {
  return getAllBlogs().map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const blog = getBlog(slug);

  if (!blog) {
    return { title: "Blog" };
  }

  return {
    title: blog.title,
    description: blog.description || `Read ${blog.title} on the Edgaze blog`,
    openGraph: {
      title: blog.title,
      description: blog.description || `Read ${blog.title} on the Edgaze blog`,
      type: "article",
      publishedTime: blog.date,
    },
    twitter: {
      card: "summary_large_image",
      title: blog.title,
      description: blog.description || `Read ${blog.title} on the Edgaze blog`,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const safeSlug = normalizeSafeSlug(slug, { maxLength: 80 });
  const blog = getBlog(safeSlug);

  if (!blog) {
    const all = getAllBlogs();
    if (all.length > 0) {
      redirect("/blogs");
    }
    notFound();
  }

  const toc = extractToc(blog.body);
  const allBlogs = getAllBlogs();
  const upNextBlogs = allBlogs.filter((b) => b.slug !== safeSlug);

  return (
    <article className="w-full max-w-4xl">
      <Link
        href="/blogs"
        className="inline-flex items-center gap-2.5 text-base text-white/60 hover:text-white/90 mb-10 transition"
      >
        <ArrowLeft className="w-5 h-5" strokeWidth={2} />
        Back to Blog
      </Link>

      <header className="mb-12">
        {blog.date && (
          <time
            dateTime={blog.date}
            className="inline-flex items-center gap-2 text-base text-white/50 mb-5"
          >
            <Calendar className="w-5 h-5" strokeWidth={2} />
            {new Date(blog.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        )}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white/95 leading-tight">
          {blog.title}
        </h1>
        {blog.description && (
          <p className="mt-5 text-xl text-white/65 max-w-3xl leading-relaxed">{blog.description}</p>
        )}
        <div className="mt-8 h-px w-24 bg-gradient-to-r from-cyan-400/60 via-pink-500/60 to-transparent rounded-full" />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-14">
        <div className="min-w-0">
          <BlogRenderer content={blog.body} />
        </div>

        {toc.length > 0 && (
          <aside className="hidden lg:block">
            <nav className="sticky top-28" aria-label="Table of contents">
              <p className="text-xs font-medium uppercase tracking-widest text-white/40 mb-4">
                On this page
              </p>
              <ul className="space-y-2.5">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={`block text-[15px] text-white/60 hover:text-cyan-400/90 transition ${
                        item.level === 3 ? "pl-3" : item.level === 4 ? "pl-5" : ""
                      }`}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}
      </div>

      {upNextBlogs.length > 0 && (
        <section className="mt-24 pt-16 border-t border-white/[0.08]" aria-label="Up next">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/45 mb-8">
            Up Next
          </h2>
          <div className="space-y-4">
            {upNextBlogs.map((b) => (
              <Link
                key={b.slug}
                href={getBlogHrefForSlug(b.slug)}
                className="group flex items-start gap-4 rounded-xl p-5 border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-200"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white/95 group-hover:text-white transition-colors">
                    {b.title}
                  </h3>
                  {b.description && (
                    <p className="mt-1.5 text-base text-white/55 line-clamp-2">{b.description}</p>
                  )}
                  {b.date && (
                    <time dateTime={b.date} className="mt-2 inline-block text-sm text-white/40">
                      {new Date(b.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  )}
                </div>
                <ArrowRight
                  className="w-5 h-5 shrink-0 text-white/40 group-hover:text-cyan-400/90 group-hover:translate-x-0.5 transition-all mt-1"
                  strokeWidth={2}
                />
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
