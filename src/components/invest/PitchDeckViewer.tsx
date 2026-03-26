"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

/** Same-origin worker avoids CDN / CSP issues; file copied from pdfjs-dist at build setup. */
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export type PitchDeckViewerProps = {
  pdfPath: string;
};

export default function PitchDeckViewer({ pdfPath }: PitchDeckViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setContainerWidth(Math.floor(w));
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setLoadError(null);
  }, []);

  const onLoadError = useCallback((err: Error) => {
    setLoadError(err.message || "Could not load PDF");
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full min-h-[200px] [&_.react-pdf__Document]:flex [&_.react-pdf__Document]:flex-col [&_.react-pdf__Document]:items-stretch [&_.react-pdf__Page]:shadow-none"
    >
      {containerWidth === null ? (
        <div
          className="flex min-h-[240px] w-full items-center justify-center rounded-[10px] bg-white/[0.04] sm:min-h-[280px]"
          aria-hidden
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
        </div>
      ) : loadError ? (
        <div className="rounded-[10px] border border-white/10 bg-white/[0.04] px-4 py-8 text-center">
          <p className="text-sm text-white/70">{loadError}</p>
          <a
            href={pdfPath}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
          >
            Open PDF in new tab
          </a>
        </div>
      ) : (
        <Document
          file={pdfPath}
          onLoadSuccess={onLoadSuccess}
          onLoadError={onLoadError}
          loading={
            <div className="flex min-h-[240px] w-full items-center justify-center rounded-[10px] bg-white/[0.04] sm:min-h-[280px]">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
            </div>
          }
          className="flex flex-col gap-4 sm:gap-5"
        >
          {numPages > 0
            ? Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={`page_${i + 1}`}
                  pageNumber={i + 1}
                  width={containerWidth}
                  renderTextLayer
                  renderAnnotationLayer
                  className="bg-transparent [&_canvas]:mx-auto [&_canvas]:h-auto [&_canvas]:max-w-full"
                />
              ))
            : null}
        </Document>
      )}
    </div>
  );
}
