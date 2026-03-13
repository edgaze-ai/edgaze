import type { Metadata } from "next";
import BlogShell from "./components/BlogShell";
import { getAllBlogs } from "./utils/blogs";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Edgaze blog—product updates, creator stories, and insights from the AI workflow economy.",
};

export default function BlogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const blogs = getAllBlogs();
  return <BlogShell blogs={blogs}>{children}</BlogShell>;
}
