import DocsShell from "./components/DocsShell";
import { getAllDocs } from "./utils/docs";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = getAllDocs();
  return <DocsShell docs={docs}>{children}</DocsShell>;
}
