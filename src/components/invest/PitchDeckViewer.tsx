"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

/** Same-origin worker avoids CDN / CSP issues; file copied from pdfjs-dist at build setup. */
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

/** iOS Safari often corrupts/overlays text & annotation layers on canvas PDFs — disable on narrow viewports. */
function useNarrowViewport() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return narrow;
}

function useSafePdfWidth(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const vw =
        typeof window !== "undefined"
          ? Math.min(
              window.innerWidth,
              window.visualViewport?.width ?? window.innerWidth,
            )
          : rect.width;
      // Clamp so canvas never exceeds the actual screen (avoids horizontal “zoomed crop” on mobile).
      const raw = Math.min(rect.width, vw);
      const padded = Math.max(0, raw - 2);
      const rounded = Math.floor(padded);
      if (rounded > 0) setW(rounded);
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener("orientationchange", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [containerRef]);

  return w;
}

export type PitchDeckViewerProps = {
  pdfPath: string;
};

export default function PitchDeckViewer({ pdfPath }: PitchDeckViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useSafePdfWidth(containerRef);
  const narrow = useNarrowViewport();
  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const dprCap =
    typeof window !== "undefined"
      ? Math.min(window.devicePixelRatio || 1, narrow ? 2 : 3)
      : 1;

  const onLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setLoadError(null);
  }, []);

  const onLoadError = useCallback((err: Error) => {
    setLoadError(err.message || "Could not load PDF");
  }, []);

  const renderLayers = !narrow;

  return (
    <div
      ref={containerRef}
      className="w-full min-h-[200px] max-w-full min-w-0 touch-pan-y overflow-x-hidden [&_.react-pdf__Document]:flex [&_.react-pdf__Document]:min-w-0 [&_.react-pdf__Document]:max-w-full [&_.react-pdf__Document]:flex-col [&_.react-pdf__Document]:items-stretch [&_.react-pdf__Page]:max-w-full [&_.react-pdf__Page]:min-w-0 [&_.react-pdf__Page]:overflow-hidden [&_.react-pdf__Page]:shadow-none"
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
          className="flex min-w-0 max-w-full flex-col gap-4 sm:gap-5"
        >
          {numPages > 0
            ? Array.from({ length: numPages }, (_, i) => (
                <div
                  key={`wrap_${i + 1}`}
                  className="relative w-full min-w-0 max-w-full overflow-hidden [contain:paint]"
                >
                  <Page
                    pageNumber={i + 1}
                    width={containerWidth}
                    devicePixelRatio={dprCap}
                    renderTextLayer={renderLayers}
                    renderAnnotationLayer={renderLayers}
                    canvasBackground="transparent"
                    className="bg-transparent [&_canvas]:mx-auto [&_canvas]:box-border [&_canvas]:h-auto [&_canvas]:max-w-full [&_canvas]:[image-rendering:auto]"
                  />
                </div>
              ))
            : null}
        </Document>
      )}
    </div>
  );
}
