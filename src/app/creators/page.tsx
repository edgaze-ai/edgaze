"use client";

import React, { useEffect } from "react";
import CreatorsHero from "./components/CreatorsHero";
import CreatorTrustBar from "./components/CreatorTrustBar";
import CreatorBenefits from "./components/CreatorBenefits";
import CreatorFlow from "./components/CreatorFlow";
import CreatorOnboardingPanel from "./components/CreatorOnboardingPanel";
import CreatorFaq from "./components/CreatorFaq";
import CreatorFinalCta from "./components/CreatorFinalCta";
import Footer from "src/components/layout/Footer";

function Gradients() {
  return (
    <>
      <div className="fixed inset-0 -z-10 bg-[#050505]" />
      <div
        className="fixed inset-0 -z-10 opacity-60"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 15%, rgba(34,211,238,0.12), transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(236,72,153,0.1), transparent 50%),
            radial-gradient(circle at 50% 85%, rgba(34,211,238,0.06), transparent 50%)`,
        }}
      />
      <div
        className="fixed inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
        }}
      />
      <div
        className="fixed inset-0 -z-10 opacity-30"
        style={{
          background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.03), transparent 50%)",
        }}
      />
    </>
  );
}

export default function CreatorsPage() {
  useEffect(() => {
    const main = document.querySelector("main");
    if (main) {
      main.style.overflowY = "auto";
      main.style.overflowX = "hidden";
      return () => {
        main.style.overflowY = "";
        main.style.overflowX = "";
      };
    }
    return;
  }, []);

  return (
    <div className="relative min-h-screen text-white">
      <Gradients />

      <main>
        <CreatorsHero />
        <CreatorTrustBar />

        <section id="onboarding" className="scroll-mt-24 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <CreatorOnboardingPanel />
          </div>
        </section>

        <CreatorBenefits />
        <CreatorFlow />
        <CreatorFaq />
        <CreatorFinalCta />

        <footer className="pt-12 pb-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Footer />
          </div>
        </footer>
      </main>
    </div>
  );
}
