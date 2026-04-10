import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";

export const metadata: Metadata = {
  title: "Library",
  description:
    "Your created and purchased prompts and workflows in one place. Run, manage, and share your Edgaze library.",
  openGraph: {
    title: "Library",
    description:
      "Your created and purchased prompts and workflows in one place. Run, manage, and share your Edgaze library.",
    url: "https://edgaze.ai/library",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Library",
    description:
      "Your created and purchased prompts and workflows in one place. Run, manage, and share your Edgaze library.",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
};

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
