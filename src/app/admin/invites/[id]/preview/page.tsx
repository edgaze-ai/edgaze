"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import WelcomeStep from "@/app/c/[token]/components/WelcomeStep";
import MessageStep from "@/app/c/[token]/components/MessageStep";
import { ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface Invite {
  id: string;
  creator_name: string;
  creator_photo_url: string;
  custom_message: string;
  status: string;
}

export default function InvitePreviewPage() {
  const params = useParams();
  const inviteId = params.id as string;

  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"welcome" | "message">("welcome");

  const fetchInvite = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("creator_invites")
        .select("id, creator_name, creator_photo_url, custom_message, status")
        .eq("id", inviteId)
        .single();

      if (error) {
        console.error("Failed to fetch invite:", error);
      } else if (data) {
        setInvite(data);
      }
    } catch (err) {
      console.error("Failed to fetch invite:", err);
    } finally {
      setLoading(false);
    }
  }, [inviteId]);

  useEffect(() => {
    fetchInvite();
  }, [fetchInvite]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
        <div className="text-center">
          <h1 className="mb-4 text-3xl font-bold text-white">Invite not found</h1>
          <Link
            href="/admin/invites"
            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to invites
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0A0A0B]">
      {/* Noise texture overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Preview controls */}
      <div className="fixed left-4 top-4 z-50 flex items-center gap-3">
        <Link
          href="/admin/invites"
          className="flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 backdrop-blur-xl transition-all hover:bg-white/[0.06]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.03] px-4 py-2 backdrop-blur-xl">
          <Eye className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-white/70">Preview Mode</span>
        </div>
      </div>

      {/* Step toggle */}
      <div className="fixed right-4 top-4 z-50 flex gap-2">
        <button
          onClick={() => setStep("welcome")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            step === "welcome"
              ? "bg-cyan-500 text-white"
              : "border border-white/[0.12] bg-white/[0.03] text-white/70 backdrop-blur-xl hover:bg-white/[0.06]"
          }`}
        >
          Welcome
        </button>
        <button
          onClick={() => setStep("message")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            step === "message"
              ? "bg-cyan-500 text-white"
              : "border border-white/[0.12] bg-white/[0.03] text-white/70 backdrop-blur-xl hover:bg-white/[0.06]"
          }`}
        >
          Message
        </button>
      </div>

      {/* Preview content */}
      {step === "welcome" && (
        <WelcomeStep
          creatorName={invite.creator_name}
          creatorPhotoUrl={invite.creator_photo_url}
          onContinue={() => setStep("message")}
        />
      )}

      {step === "message" && <MessageStep message={invite.custom_message} onContinue={() => {}} />}
    </div>
  );
}
