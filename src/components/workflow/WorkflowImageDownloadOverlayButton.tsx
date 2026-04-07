"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cx } from "../../lib/cx";
import { downloadWorkflowImageFromUrl } from "../../lib/workflow/client-image-download";

type Props = {
  imageUrl: string;
  className?: string;
  buttonClassName?: string;
  title?: string;
  iconClassName?: string;
};

/**
 * Icon-only download control for image previews; shows a spinner while fetch/save runs.
 */
export function WorkflowImageDownloadOverlayButton({
  imageUrl,
  className,
  buttonClassName,
  title = "Download image",
  iconClassName,
}: Props) {
  const [busy, setBusy] = useState(false);

  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy || !imageUrl}
        title={busy ? "Downloading…" : title}
        aria-busy={busy}
        aria-label={busy ? "Downloading image" : title}
        onClick={(e) => {
          e.stopPropagation();
          if (!imageUrl || busy) return;
          setBusy(true);
          void (async () => {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            try {
              await downloadWorkflowImageFromUrl(imageUrl);
            } catch {
              const link = document.createElement("a");
              link.href = imageUrl;
              link.download = `image-${Date.now()}.png`;
              link.target = "_blank";
              link.rel = "noreferrer";
              document.body.appendChild(link);
              link.click();
              link.remove();
            } finally {
              setBusy(false);
            }
          })();
        }}
        className={cx(
          "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border p-2 transition disabled:cursor-not-allowed disabled:opacity-60",
          buttonClassName,
        )}
      >
        {busy ? (
          <Loader2 className={cx("h-4 w-4 shrink-0 animate-spin", iconClassName)} />
        ) : (
          <Download className={cx("h-4 w-4 shrink-0", iconClassName)} />
        )}
      </button>
    </div>
  );
}
