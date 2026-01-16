import { redirect } from "next/navigation";

export default function DocsIndex() {
  redirect("/docs/changelog");
}
export const metadata = {
  title: "Docs",
  description: "Find all the documentation you need to get started with Edgaze.",
};