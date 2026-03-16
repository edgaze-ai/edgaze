import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Library",
  description:
    "Your created and purchased prompts and workflows in one place. Run, manage, and share your Edgaze library.",
  openGraph: {
    title: "Library | Edgaze",
    description:
      "Your created and purchased prompts and workflows in one place. Run, manage, and share your Edgaze library.",
    url: "https://edgaze.ai/library",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Library | Edgaze",
    description:
      "Your created and purchased prompts and workflows in one place. Run, manage, and share your Edgaze library.",
    images: ["/og.png"],
  },
};

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
