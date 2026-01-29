"use client";

import React, { useState, useEffect } from "react";
import { X, Flag, Loader2 } from "lucide-react";
import { useAuth } from "../../components/auth/AuthContext";

type ReportReason =
  | "spam"
  | "inappropriate_content"
  | "misleading"
  | "copyright"
  | "harassment"
  | "other";

type ReportModalProps = {
  open: boolean;
  onClose: () => void;
  targetType: "prompt" | "workflow";
  targetId: string;
  targetTitle: string | null;
  targetOwnerHandle: string | null;
  targetOwnerName: string | null;
};

const REPORT_REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: "spam", label: "Spam or misleading" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "misleading", label: "Misleading or false information" },
  { value: "copyright", label: "Copyright violation" },
  { value: "harassment", label: "Harassment or hate speech" },
  { value: "other", label: "Other" },
];

export default function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
  targetTitle,
  targetOwnerHandle,
  targetOwnerName,
}: ReportModalProps) {
  const { authReady, userId, requireAuth, openSignIn, getAccessToken } = useAuth();
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(false);
  }, [open]);

  useEffect(() => {
    if (!open || !authReady || userId) return;
    openSignIn();
    onClose();
  }, [open, authReady, userId, openSignIn, onClose]);

  if (!open) return null;

  if (!authReady) {
    return (
      <div className="fixed inset-0 z-[150]">
        <div className="absolute inset-0 bg-black/80" onClick={onClose} />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="rounded-2xl border border-white/10 bg-[#0b0c10] px-6 py-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-white/70" />
            <span className="text-sm text-white/80">Checking sign-in…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!userId) return null;

  const handleSubmit = async () => {
    if (!reason) {
      setError("Please select a reason");
      return;
    }
    if (!requireAuth()) return;

    setSubmitting(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch("/api/reports/submit", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason: reason,
          details: details.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit report");
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setReason("");
        setDetails("");
        setError(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-[min(560px,94vw)] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] shadow-[0_40px_160px_rgba(0,0,0,0.85)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/15 border border-rose-400/20">
                <Flag className="h-5 w-5 text-rose-200" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-white">Report {targetType}</div>
                <div className="text-[11px] text-white/55">
                  Help us keep the marketplace safe
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80 hover:bg-white/10 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5">
            {success ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-400/20 mb-4">
                  <svg
                    className="w-8 h-8 text-emerald-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="text-base font-semibold text-white mb-2">Report submitted</div>
                <div className="text-sm text-white/60">
                  Thank you for helping keep the marketplace safe.
                </div>
              </div>
            ) : (
              <>
                {/* Product info */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4">
                  <div className="text-xs text-white/50 mb-1">Reporting</div>
                  <div className="text-sm font-semibold text-white">
                    {targetTitle || `Untitled ${targetType}`}
                  </div>
                  {targetOwnerHandle && (
                    <div className="text-xs text-white/55 mt-1">
                      by @{targetOwnerHandle}
                      {targetOwnerName && ` (${targetOwnerName})`}
                    </div>
                  )}
                </div>

                {/* Reason selection */}
                <div className="mb-4">
                  <div className="text-xs text-white/70 mb-2 font-semibold">
                    Why are you reporting this?
                  </div>
                  <div className="space-y-2">
                    {REPORT_REASONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => {
                          setReason(r.value);
                          setError(null);
                        }}
                        disabled={submitting}
                        className={`w-full text-left rounded-xl border px-3 py-2.5 text-sm transition ${
                          reason === r.value
                            ? "border-rose-400/60 bg-rose-500/10 text-white"
                            : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
                        } disabled:opacity-50`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div className="mb-4">
                  <div className="text-xs text-white/70 mb-2 font-semibold">
                    Additional details (optional)
                  </div>
                  <textarea
                    value={details}
                    onChange={(e) => {
                      setDetails(e.target.value);
                      setError(null);
                    }}
                    disabled={submitting}
                    placeholder="Please provide any additional context that might help us review this report..."
                    rows={4}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white/85 outline-none focus:border-rose-400/60 resize-none disabled:opacity-50"
                  />
                </div>

                {error && (
                  <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-100">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/10 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !reason}
                    className="flex-1 rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-500/20 to-rose-600/20 px-4 py-2.5 text-sm font-semibold text-rose-200 hover:from-rose-500/30 hover:to-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Report"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
