import type { ReactElement } from "react";

/** 16:9 preview thumbnail for OG / social cards (matches link preview expectations). */
const OG_THUMB_W = 640;
const OG_THUMB_H = 360;
/** Mark is shown small so the PNG stays sharp without dominating the header. */
const BRAND_MARK_PX = 30;

export type ListingOgCardProps = {
  title: string;
  creatorName: string;
  priceLabel: string;
  /** Set only after URL validates as a non-SVG image — avoids Satori fetch failures. */
  imageUrl?: string | null;
  /** `data:image/png;base64,...` from `public/brand/edgaze-mark.png` (optional). */
  brandMarkSrc?: string | null;
};

export function ListingOgCard({
  title,
  creatorName,
  priceLabel,
  imageUrl,
  brandMarkSrc,
}: ListingOgCardProps): ReactElement {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#070707",
        backgroundImage: "linear-gradient(165deg, #0c0c0c 0%, #070707 55%, #050505 100%)",
        padding: "44px 52px",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {brandMarkSrc ? (
            <img
              src={brandMarkSrc}
              alt=""
              width={BRAND_MARK_PX}
              height={BRAND_MARK_PX}
              style={{
                objectFit: "contain",
                width: BRAND_MARK_PX,
                height: BRAND_MARK_PX,
                flexShrink: 0,
              }}
            />
          ) : null}
          <span
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: "#ffffff",
              letterSpacing: "-0.03em",
            }}
          >
            Edgaze
          </span>
        </div>
        {priceLabel ? (
          <span
            style={{
              fontSize: 17,
              fontWeight: 500,
              color: "rgba(255,255,255,0.72)",
              letterSpacing: "-0.02em",
            }}
          >
            {priceLabel}
          </span>
        ) : (
          <span />
        )}
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          gap: 18,
        }}
      >
        {imageUrl ? (
          <div
            style={{
              display: "flex",
              width: OG_THUMB_W,
              height: OG_THUMB_H,
              borderRadius: 14,
              overflow: "hidden",
              flexShrink: 0,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
            }}
          >
            <img
              src={imageUrl}
              alt=""
              width={OG_THUMB_W}
              height={OG_THUMB_H}
              style={{ objectFit: "cover", width: OG_THUMB_W, height: OG_THUMB_H }}
            />
          </div>
        ) : null}
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            maxWidth: 980,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "-0.035em",
            lineHeight: 1.15,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 21,
            color: "rgba(255,255,255,0.58)",
            letterSpacing: "-0.02em",
          }}
        >
          {`by ${creatorName}`}
        </div>
      </div>

      <div
        style={{
          fontSize: 15,
          color: "rgba(255,255,255,0.38)",
          letterSpacing: "-0.01em",
        }}
      >
        Create, sell, and distribute AI products
      </div>
    </div>
  );
}
