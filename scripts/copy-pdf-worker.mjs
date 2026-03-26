import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Resolve pdfjs-dist from react-pdf’s dependency (must match API version). */
const reactPdfPkg = path.join(root, "node_modules", "react-pdf", "package.json");
const requireFromReactPdf = createRequire(reactPdfPkg);
const pdfjsPkgPath = requireFromReactPdf.resolve("pdfjs-dist/package.json");
const src = path.join(path.dirname(pdfjsPkgPath), "build", "pdf.worker.min.mjs");
const dst = path.join(root, "public", "pdf.worker.min.mjs");

if (fs.existsSync(src)) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
} else {
  console.warn(
    "[copy-pdf-worker] Missing worker at",
    src,
    "— run npm install if react-pdf is installed.",
  );
}
