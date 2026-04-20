import type { Metadata } from "next";
import BlogShell from "./components/BlogShell";
import { getAllBlogs } from "./utils/blogs";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Edgaze Blog | AI Workflow Insights and Product Updates",
  description:
    "Read product updates, creator stories, and practical insights about building, publishing, and monetizing AI workflows with Edgaze.",
  path: "/blogs",
});

export default function BlogsLayout({ children }: { children: React.ReactNode }) {
  const blogs = getAllBlogs();
  return <BlogShell blogs={blogs}>{children}</BlogShell>;
}
