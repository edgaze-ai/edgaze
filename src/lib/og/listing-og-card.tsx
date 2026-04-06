import type { ReactElement } from "react";

export type ListingOgCardProps = {
  title: string;
  creatorName: string;
  priceLabel: string;
  /** Set only after URL validates as a non-SVG image — avoids Satori fetch failures. */
  imageUrl?: string | null;
};

export function ListingOgCard({
  title,
  creatorName,
  priceLabel,
  imageUrl,
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
        backgroundColor: "#0a0a0a",
        padding: "48px 56px",
        fontFamily: "system-ui, sans-serif",
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
        <span style={{ fontSize: 24, fontWeight: 600, color: "#22d3ee" }}>Edgaze</span>
        {priceLabel ? (
          <span style={{ fontSize: 18, color: "rgba(255,255,255,0.7)" }}>{priceLabel}</span>
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
          gap: 16,
        }}
      >
        {imageUrl ? (
          <div
            style={{
              display: "flex",
              width: 280,
              height: 280,
              borderRadius: 12,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <img
              src={imageUrl}
              alt=""
              width={280}
              height={280}
              style={{ objectFit: "cover", width: 280, height: 280 }}
            />
          </div>
        ) : null}
        <div
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            maxWidth: 900,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 22, color: "rgba(255,255,255,0.6)" }}>{`by ${creatorName}`}</div>
      </div>

      <div style={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }}>
        Create, sell, and distribute AI products
      </div>
    </div>
  );
}
