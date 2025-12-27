"use client";

import React, { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: any;
  }
}

export default function TurnstileWidget({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const cbRef = useRef(onToken);

  const [status, setStatus] = useState<
    "missing_key" | "loading" | "ready" | "blocked" | "rendered"
  >("loading");

  // keep latest callback without re-rendering widget
  useEffect(() => {
    cbRef.current = onToken;
  }, [onToken]);

  // load script once
  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) {
      setStatus("missing_key");
      return;
    }

    const src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);

    if (existing) {
      setStatus("ready");
      return;
    }

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => setStatus("ready");
    s.onerror = () => setStatus("blocked");
    document.body.appendChild(s);
  }, []);

  // render widget once, with retry until window.turnstile is actually available
  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return;
    if (!mountRef.current) return;
    if (widgetIdRef.current) return;

    let tries = 0;
    let timer: any = null;

    const tryRender = () => {
      tries += 1;

      // If script is blocked by adblock/CSP, we will never get window.turnstile
      if (!window.turnstile) {
        if (tries >= 40) {
          setStatus("blocked");
          return;
        }
        timer = setTimeout(tryRender, 100);
        return;
      }

      try {
        setStatus("ready");
        widgetIdRef.current = window.turnstile.render(mountRef.current, {
          sitekey: siteKey,
          theme: "dark",
          callback: (token: string) => cbRef.current(token),
          "expired-callback": () => cbRef.current(""),
          "error-callback": () => cbRef.current(""),
        });
        setStatus("rendered");
      } catch {
        if (tries >= 40) {
          setStatus("blocked");
          return;
        }
        timer = setTimeout(tryRender, 150);
      }
    };

    tryRender();

    return () => {
      if (timer) clearTimeout(timer);
      try {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
        }
      } catch {}
      widgetIdRef.current = null;
    };
  }, [status]);

  if (status === "missing_key") {
    return (
      <div className="text-xs text-white/55">
        Captcha not configured: missing NEXT_PUBLIC_TURNSTILE_SITE_KEY
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={mountRef} className="min-h-[65px]" />
      {status === "loading" || status === "ready" ? (
        <div className="text-xs text-white/45">Loading captcha…</div>
      ) : null}
      {status === "blocked" ? (
        <div className="text-xs text-red-300">
          Captcha blocked. Disable adblock / allow Cloudflare Turnstile, and ensure your domain is added
          in Turnstile settings.
        </div>
      ) : null}
    </div>
  );
}
