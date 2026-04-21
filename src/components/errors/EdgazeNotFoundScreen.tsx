"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { createPortal } from "react-dom";

type EdgazeNotFoundScreenProps = {
  code: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
};

export default function EdgazeNotFoundScreen({
  code,
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
}: EdgazeNotFoundScreenProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-[#050608] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(77,213,255,0.14),transparent_22%),radial-gradient(circle_at_82%_20%,rgba(255,101,176,0.12),transparent_22%),linear-gradient(180deg,#0b0d10_0%,#060709_48%,#040506_100%)]" />

      <div className="relative flex min-h-[100dvh] items-center justify-center px-5 py-8 sm:px-8 sm:py-9 lg:px-14">
        <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-12">
          <section className="order-1 max-w-xl lg:order-1">
            <div className="lg:hidden">
              <p className="text-[3.5rem] font-semibold leading-none tracking-[-0.08em] text-white sm:text-[4.6rem]">
                {code}
              </p>
              <div className="mt-2.5 flex items-center gap-2.5">
                <div className="h-px w-8 bg-white/18" />
                <p className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-white/48">
                  {eyebrow}
                </p>
              </div>
            </div>

            <h1 className="mt-4 text-[2rem] font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-[2.5rem] lg:mt-0 lg:text-[3.4rem]">
              {title}
            </h1>
            <p className="mt-4 max-w-lg text-[0.95rem] leading-7 text-white/60 sm:text-base sm:leading-7">
              {description}
            </p>

            <div className="mt-5 flex items-center gap-2">
              <Image src="/brand/edgaze-mark.png" alt="edgaze" width={28} height={28} priority />
              <div className="text-[1.1rem] font-semibold tracking-[-0.04em] text-white sm:text-[1.2rem]">
                edgaze
              </div>
            </div>

            <div className="mt-6 hidden lg:block">
              <p className="text-[4.8rem] font-semibold leading-none tracking-[-0.08em] text-white lg:text-[6.2rem]">
                {code}
              </p>
              <div className="mt-3 flex items-center gap-2.5">
                <div className="h-px w-8 bg-white/18" />
                <p className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-white/48">
                  {eyebrow}
                </p>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={primaryHref}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[0.82rem] font-semibold text-black transition hover:bg-white/90"
              >
                {primaryLabel}
              </Link>
            </div>
          </section>

          <section className="order-2 flex justify-center lg:order-2 lg:justify-end">
            <div className="relative w-full max-w-[16rem] sm:max-w-[20rem] lg:max-w-[29rem]">
              <div className="absolute inset-x-[10%] top-[12%] h-24 rounded-full bg-cyan-300/18 blur-3xl sm:h-32 lg:h-40" />
              <div className="absolute bottom-[8%] right-[12%] h-20 w-20 rounded-full bg-pink-300/10 blur-3xl sm:h-24 sm:w-24 lg:h-32 lg:w-32" />
              <div className="relative aspect-square w-full">
                <Image
                  src="/brand/404-image.png"
                  alt="Edgaze not found artwork"
                  fill
                  priority
                  sizes="(max-width: 640px) 82vw, (max-width: 1024px) 56vw, 42vw"
                  className="object-contain drop-shadow-[0_26px_70px_rgba(0,0,0,0.45)]"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
