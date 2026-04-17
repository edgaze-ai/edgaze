import Link from "next/link";
import { BLOG_ROUTE_ORDER, getAllBlogs } from "./utils/blogs";
import { Calendar } from "lucide-react";

export default function BlogsHomePage() {
  const blogs = getAllBlogs();

  return (
    <div className="w-full">
      {/* Hero */}
      <header className="mb-16 sm:mb-20">
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-semibold tracking-tight text-white/95 max-w-4xl leading-[1.08]">
          Product updates, creator stories, and{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-pink-400 bg-clip-text text-transparent">
            insights
          </span>{" "}
          from the AI workflow economy
        </h1>
        <p className="mt-8 text-xl sm:text-2xl text-white/65 max-w-3xl leading-relaxed">
          What we&apos;re building, how creators use Edgaze, and where the platform is headed.
        </p>
      </header>

      {/* Gradient accent line */}
      <div className="h-px w-32 mb-16 bg-gradient-to-r from-cyan-400/80 via-pink-500/80 to-transparent rounded-full" />

      {/* Blog list */}
      <section className="space-y-8 sm:space-y-10">
        {blogs.map((blog, index) => {
          const href = BLOG_ROUTE_ORDER[index] ?? "/blogs";
          return (
            <Link key={`${blog.date ?? "undated"}-${index}`} href={href} className="block group">
              <article className="rounded-2xl p-8 sm:p-10 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300 group-hover:shadow-[0_0_40px_-12px_rgba(34,211,238,0.08),0_0_40px_-12px_rgba(236,72,153,0.06)]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  {blog.date && (
                    <time
                      dateTime={blog.date}
                      className="inline-flex items-center gap-2 text-sm text-white/45"
                    >
                      <Calendar className="w-4 h-4" strokeWidth={2} />
                      {new Date(blog.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-white/95 group-hover:text-white transition-colors">
                  {blog.title}
                </h2>
                {blog.description && (
                  <p className="mt-3 text-base sm:text-lg text-white/65 leading-relaxed max-w-3xl">
                    {blog.description}
                  </p>
                )}
                <span className="mt-6 inline-flex items-center gap-2 text-base font-medium text-cyan-400/90 group-hover:text-cyan-400 transition-colors">
                  Read more
                  <svg
                    className="w-5 h-5 transition-transform group-hover:translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </article>
            </Link>
          );
        })}
      </section>

      {blogs.length === 0 && (
        <p className="text-white/50 text-center py-16">No posts yet. Check back soon.</p>
      )}
    </div>
  );
}
