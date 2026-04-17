import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
  tone?: "default" | "muted" | "brand";
};

const STROKE = 1.7;

function toneColor(tone: IconProps["tone"]) {
  if (tone === "muted") return "currentColor";
  if (tone === "brand") return "url(#edgaze-icon-grad)";
  return "currentColor";
}

function defs() {
  return (
    <defs>
      <linearGradient
        id="edgaze-icon-grad"
        x1="0"
        y1="0"
        x2="18"
        y2="18"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#78E9FF" />
        <stop offset="0.54" stopColor="#B68CFF" />
        <stop offset="1" stopColor="#FF6DB2" />
      </linearGradient>
    </defs>
  );
}

function IconBase({
  size = 18,
  tone = "default",
  children,
  ...rest
}: IconProps & { children: React.ReactNode }) {
  const stroke = toneColor(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true" {...rest}>
      {tone === "brand" ? defs() : null}
      <g stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.2 8.3 9 3.3l5.8 5" />
      <path d="M5.2 7.9V14.2c0 .9.7 1.6 1.6 1.6h4.4c.9 0 1.6-.7 1.6-1.6V7.9" />
    </IconBase>
  );
}

export function IconDocs(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 3.7h6.7c.9 0 1.6.7 1.6 1.6v9.4c0 .9-.7 1.6-1.6 1.6H5" />
      <path d="M5 3.7c-.9 0-1.6.7-1.6 1.6v9.4c0 .9.7 1.6 1.6 1.6" />
      <path d="M6.3 6.2h5.3" />
      <path d="M6.3 8.8h4.2" />
      <path d="M6.3 11.4h5.1" />
    </IconBase>
  );
}

export function IconRun(props: IconProps) {
  return (
    <IconBase {...props}>
      {/* play mark (custom: tighter, more centered, reads clean at 18–20px) */}
      <path d="M6.55 5.15 13.4 9 6.55 12.85c-.75.42-1.7-.12-1.7-.98V6.13c0-.86.95-1.4 1.7-.98Z" />
    </IconBase>
  );
}

export function IconPublish(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 2.9 12 6.0 9 9.1 6 6.0Z" />
      <path d="M9 9.1v6" />
      <path d="M4.2 13.7c1.2.9 2.8 1.4 4.8 1.4 2 0 3.6-.5 4.8-1.4" />
    </IconBase>
  );
}

export function IconRocket(props: IconProps) {
  return (
    <IconBase {...props}>
      {/* nose + body */}
      <path d="M9 2.7c2.4 1.1 3.9 3.6 3.9 6.5v.4c0 1.3-.3 2.6-.9 3.7L9 15.3l-3-2c-.6-1.1-.9-2.4-.9-3.7v-.4c0-2.9 1.5-5.4 3.9-6.5Z" />
      {/* window */}
      <path d="M9 6.7h.1" />
      {/* fins */}
      <path d="M6.2 10.4 4.6 11.4" />
      <path d="M11.8 10.4l1.6 1" />
      {/* flame */}
      <path d="M9 15.3c.7.7 1.1 1.3 1.1 2 0 .9-.9 1.7-2.1 1.7S5.9 18.2 5.9 17.3c0-.7.4-1.3 1.1-2" />
    </IconBase>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14.1 8.1a5.6 5.6 0 0 0-9.8-2.3" />
      <path d="M3.9 5.1h2.9v-3" />
      <path d="M3.9 9.9a5.6 5.6 0 0 0 9.8 2.3" />
      <path d="M14.1 12.9h-2.9v3" />
    </IconBase>
  );
}

export function IconUndo(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.5 6.3 3.7 9l2.8 2.7" />
      <path d="M4.2 9h6.4c2.2 0 3.7 1.5 3.7 3.7" />
    </IconBase>
  );
}

export function IconRedo(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M11.5 6.3 14.3 9l-2.8 2.7" />
      <path d="M13.8 9H7.4c-2.2 0-3.7 1.5-3.7 3.7" />
    </IconBase>
  );
}

export function IconZoomIn(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 7.1v3.8" />
      <path d="M6.1 9h3.8" />
      <path d="M12.2 12.2 15 15" />
      <path d="M11.3 4.7a5.3 5.3 0 1 0 0 7.5 5.3 5.3 0 0 0 0-7.5Z" />
    </IconBase>
  );
}

export function IconZoomOut(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.1 9h3.8" />
      <path d="M12.2 12.2 15 15" />
      <path d="M11.3 4.7a5.3 5.3 0 1 0 0 7.5 5.3 5.3 0 0 0 0-7.5Z" />
    </IconBase>
  );
}

/** Fit / frame content to viewport (workflow canvas). */
export function IconFitView(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.2 6.3V4.2h2.1" />
      <path d="M11.7 4.2h2.1v2.1" />
      <path d="M4.2 11.7v2.1h2.1" />
      <path d="M13.8 13.8v-2.1h2.1" />
      <rect x="6.8" y="6.8" width="4.4" height="4.4" rx="0.9" fill="none" />
    </IconBase>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.2 4.2h3.7v3.7H4.2Z" />
      <path d="M10.1 4.2h3.7v3.7h-3.7Z" />
      <path d="M4.2 10.1h3.7v3.7H4.2Z" />
      <path d="M10.1 10.1h3.7v3.7h-3.7Z" />
    </IconBase>
  );
}

export function IconLock(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5.4 8.4V6.8a3.6 3.6 0 0 1 7.2 0v1.6" />
      <path d="M5.1 8.4h7.8c.7 0 1.2.5 1.2 1.2v4.4c0 .7-.5 1.2-1.2 1.2H5.1c-.7 0-1.2-.5-1.2-1.2V9.6c0-.7.5-1.2 1.2-1.2Z" />
    </IconBase>
  );
}

export function IconUnlock(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.3 8.4V6.8a3.3 3.3 0 0 1 6.6 0" />
      <path d="M5.1 8.4h7.8c.7 0 1.2.5 1.2 1.2v4.4c0 .7-.5 1.2-1.2 1.2H5.1c-.7 0-1.2-.5-1.2-1.2V9.6c0-.7.5-1.2 1.2-1.2Z" />
    </IconBase>
  );
}

export function IconFullscreen(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.2 3.8H4.1c-.7 0-1.2.5-1.2 1.2v2.1" />
      <path d="M11.8 3.8h2.1c.7 0 1.2.5 1.2 1.2v2.1" />
      <path d="M6.2 14.2H4.1c-.7 0-1.2-.5-1.2-1.2v-2.1" />
      <path d="M11.8 14.2h2.1c.7 0 1.2-.5 1.2-1.2v-2.1" />
    </IconBase>
  );
}

export function IconExitFullscreen(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 4.2H4.2V7" />
      <path d="M11 4.2h2.8V7" />
      <path d="M7 13.8H4.2V11" />
      <path d="M11 13.8h2.8V11" />
    </IconBase>
  );
}

export function IconPanels(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.2 4.3h9.6c.8 0 1.4.6 1.4 1.4v6.6c0 .8-.6 1.4-1.4 1.4H4.2c-.8 0-1.4-.6-1.4-1.4V5.7c0-.8.6-1.4 1.4-1.4Z" />
      <path d="M6.6 4.3v9.4" />
    </IconBase>
  );
}

export function IconInspector(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7.2 6.2h3.6" />
      <path d="M7.2 9h2.8" />
      <path d="M4.6 3.9h8.8c.9 0 1.6.7 1.6 1.6v7c0 .9-.7 1.6-1.6 1.6H4.6c-.9 0-1.6-.7-1.6-1.6v-7c0-.9.7-1.6 1.6-1.6Z" />
    </IconBase>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10.8 10.8 14.9 14.9" />
      <path d="M11.2 7.5a3.7 3.7 0 1 0-7.4 0 3.7 3.7 0 0 0 7.4 0Z" />
    </IconBase>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 2.8l1.1 3.1 3.1 1.1-3.1 1.1L9 11.2 7.9 8.1 4.8 7 7.9 5.9 9 2.8Z" />
      <path d="M13.2 10.2l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </IconBase>
  );
}

export function IconCore(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 3.2v2.1" />
      <path d="M9 12.7v2.1" />
      <path d="M3.2 9h2.1" />
      <path d="M12.7 9h2.1" />
      <path d="M6 6l.9.9" />
      <path d="M12 12l.9.9" />
      <path d="M12 6l-.9.9" />
      <path d="M6 12l-.9.9" />
      <path d="M9 6.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z" />
    </IconBase>
  );
}

export function IconLLM(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.1 5.2h9.8c.8 0 1.4.6 1.4 1.4v4.5c0 .8-.6 1.4-1.4 1.4H9.2l-2.7 2.2v-2.2H4.1c-.8 0-1.4-.6-1.4-1.4V6.6c0-.8.6-1.4 1.4-1.4Z" />
      <path d="M6 8.2h.1" />
      <path d="M9 8.2h.1" />
      <path d="M12 8.2h.1" />
    </IconBase>
  );
}

export function IconIntegrations(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.9 6.3 5.4 4.8a2.2 2.2 0 0 0-3.1 3.1l1.5 1.5" />
      <path d="M11.1 11.7l1.5 1.5a2.2 2.2 0 0 0 3.1-3.1l-1.5-1.5" />
      <path d="M7.5 10.5 10.5 7.5" />
      <path d="M10.5 10.5 7.5 7.5" />
    </IconBase>
  );
}

export function IconConditions(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.2 5.2h5.2v4.2H4.2Z" />
      <path d="M8.6 8.2h5.2v4.2H8.6Z" />
      <path d="M9.4 7.4 12 5.2" />
      <path d="M9.4 10.6 12 12.8" />
    </IconBase>
  );
}

export function IconLoops(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5.1 6.1h6.6c1.9 0 3.4 1.5 3.4 3.4 0 1.9-1.5 3.4-3.4 3.4H7.2" />
      <path d="M5.1 6.1 3.1 8.1 5.1 10.1" />
      <path d="M7.2 12.9 5.2 10.9 7.2 8.9" />
    </IconBase>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <IconBase {...props}>
      {/* split-plus (slightly more branded/technical) */}
      <path d="M9 4.3v4.1" />
      <path d="M9 9.6v4.1" />
      <path d="M4.3 9h4.1" />
      <path d="M9.6 9h4.1" />
    </IconBase>
  );
}

export function IconClose(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5.2 5.2 12.8 12.8" />
      <path d="M12.8 5.2 5.2 12.8" />
    </IconBase>
  );
}

export function IconBack(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.7 5.2 3.5 9l3.2 3.8" />
      <path d="M4 9h10.5" />
    </IconBase>
  );
}
