"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Send,
  UserCircle,
  Ban,
  Copy,
  ExternalLink,
  Eye,
  Wallet,
  BadgePercent,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { DEFAULT_AVATAR_SRC } from "@/config/branding";

const cardClass =
  "rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]";
const inputClass =
  "w-full rounded-lg border border-white/[0.12] bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50";

type ClaimLink = {
  id: string;
  status: string;
  target_email: string | null;
  sent_at: string;
  expires_at: string;
  consumed_at: string | null;
  revoked_at: string | null;
};

type AuditEv = {
  id: string;
  action: string;
  actor_mode: string;
  actor_user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type ImpRow = {
  id: string;
  admin_user_id: string;
  status: string;
  reason: string;
  started_at: string;
  ended_at: string | null;
  expires_at: string;
};

type ConnectAccountSummary = {
  stripe_account_id: string;
  account_status: string | null;
  payouts_enabled: boolean | null;
  charges_enabled: boolean | null;
  details_submitted: boolean | null;
  onboarding_completed_at: string | null;
  updated_at: string | null;
} | null;

type PendingClaimSummary = {
  pendingClaimCents: number;
  claimCount: number;
  claimDeadline: string | null;
  daysRemaining: number;
  firstSaleEmailSentAt: string | null;
} | null;

type FeeOverrideRow = {
  id: string;
  platform_fee_percentage: number;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_at?: string;
  revoked_at?: string | null;
};

function linkRecipientLabel(email: string | null) {
  if (!email?.trim()) return "Open link (first sign-in wins)";
  const [u, d] = email.split("@");
  if (!d) return "***";
  const prefix = (u ?? "").slice(0, 2);
  return `${prefix}***@${d}`;
}

export default function AdminCreatorDetailPage() {
  const params = useParams();
  const profileId = params.profileId as string;
  const { authReady, getAccessToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [claimLinks, setClaimLinks] = useState<ClaimLink[]>([]);
  const [audits, setAudits] = useState<AuditEv[]>([]);
  const [impSessions, setImpSessions] = useState<ImpRow[]>([]);
  const [connectAccount, setConnectAccount] = useState<ConnectAccountSummary>(null);
  const [pendingClaimSummary, setPendingClaimSummary] = useState<PendingClaimSummary>(null);
  const [activeFeeOverride, setActiveFeeOverride] = useState<FeeOverrideRow | null>(null);
  const [feeOverrideHistory, setFeeOverrideHistory] = useState<FeeOverrideRow[]>([]);

  const [saveBusy, setSaveBusy] = useState(false);
  const [draft, setDraft] = useState({
    full_name: "",
    handle: "",
    bio: "",
    avatar_url: "",
    banner_url: "",
  });

  const [claimOpen, setClaimOpen] = useState(false);
  const [claimDays, setClaimDays] = useState(14);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimUrl, setClaimUrl] = useState<string | null>(null);

  const [impOpen, setImpOpen] = useState(false);
  const [impReason, setImpReason] = useState("Support / onboarding");
  const [impBusy, setImpBusy] = useState(false);
  const [feeOverrideBusy, setFeeOverrideBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/creators/${profileId}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const p = data.profile;
      setProfile(p);
      setClaimLinks(data.claim_links || []);
      setAudits(data.audit_events || []);
      setImpSessions(data.impersonation_sessions || []);
      setConnectAccount(data.connect_account || null);
      setPendingClaimSummary(data.pending_claim_summary || null);
      setActiveFeeOverride(data.active_fee_override || null);
      setFeeOverrideHistory(data.fee_override_history || []);
      if (p) {
        setDraft({
          full_name: p.full_name || "",
          handle: p.handle || "",
          bio: p.bio || "",
          avatar_url: p.avatar_url || "",
          banner_url: p.banner_url || "",
        });
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, profileId]);

  useEffect(() => {
    if (!authReady) return;
    void load();
  }, [authReady, load]);

  const saveProfile = async () => {
    setSaveBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/creators/${profileId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaveBusy(false);
    }
  };

  const sendClaim = async () => {
    setClaimBusy(true);
    setClaimUrl(null);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/creators/${profileId}/claim-links`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          expires_in_days: claimDays,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setClaimUrl(data.claimUrl || null);
      setClaimOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to generate claim link");
    } finally {
      setClaimBusy(false);
    }
  };

  const revokeClaim = async () => {
    if (!confirm("Revoke the active claim link for this profile?")) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/creators/${profileId}/claim-links`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: any) {
      setError(e?.message || "Revoke failed");
    }
  };

  const startImpersonation = async () => {
    setImpBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const path = `/admin/creators/${profileId}`;
      const res = await fetch(`/api/admin/creators/${profileId}/impersonation/start`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          reason: impReason.slice(0, 500),
          return_to_admin_path: path,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setImpOpen(false);
      window.location.assign("/profile");
    } catch (e: any) {
      setError(e?.message || "Impersonation failed");
    } finally {
      setImpBusy(false);
    }
  };

  const grantFeeHoliday = async () => {
    setFeeOverrideBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/creators/${profileId}/fee-override`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          durationDays: 90,
          reason: "Admin launch fee holiday",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to grant fee holiday");
    } finally {
      setFeeOverrideBusy(false);
    }
  };

  const revokeFeeHoliday = async () => {
    setFeeOverrideBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/creators/${profileId}/fee-override`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to revoke fee holiday");
    } finally {
      setFeeOverrideBusy(false);
    }
  };

  const publicUrl =
    typeof window !== "undefined" && profile?.handle
      ? `${window.location.origin}/profile/${profile.handle}`
      : "";

  if (loading && !profile) {
    return (
      <div className="flex justify-center py-24 text-white/50">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16 text-white/50">
        {error || "Not found"}{" "}
        <Link href="/admin/creators" className="text-cyan-300 underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 mx-auto max-w-4xl">
      <Link
        href="/admin/creators"
        className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Creators
      </Link>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {claimUrl && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <div className="font-semibold mb-1">Claim link (copy once — not stored)</div>
          <code className="break-all text-xs block text-white/80">{claimUrl}</code>
        </div>
      )}

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10">
          <Image
            src={profile.avatar_url || DEFAULT_AVATAR_SRC}
            alt=""
            fill
            className="object-cover"
            sizes="96px"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-white truncate">
            {profile.full_name || "Unnamed"}
          </h1>
          <div className="text-white/50">@{profile.handle}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                profile.claim_status === "claimed"
                  ? "bg-emerald-500/15 text-emerald-200"
                  : "bg-amber-500/15 text-amber-100"
              }`}
            >
              {profile.claim_status}
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/70">
              {profile.source}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => setClaimOpen(true)}
            disabled={profile.claim_status === "claimed"}
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/[0.1] disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            Generate claim link
          </button>
          <button
            type="button"
            onClick={() => setImpOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/15"
          >
            <Eye className="h-3.5 w-3.5" />
            Impersonate
          </button>
          <button
            type="button"
            onClick={() => void revokeClaim()}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/15"
          >
            <Ban className="h-3.5 w-3.5" />
            Revoke link
          </button>
          {publicUrl ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(publicUrl);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-xs font-semibold text-white/80"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy URL
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-xs font-semibold text-white/80"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Public profile
              </a>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${cardClass} p-4 sm:p-6 space-y-4`}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wallet className="h-4 w-4 text-cyan-300" />
            Payout status
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/45">Program</div>
              <div className={profile.can_receive_payments ? "text-emerald-200" : "text-amber-100"}>
                {profile.can_receive_payments ? "Active and payout-ready" : "Needs onboarding"}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/45">Stripe</div>
              <div className="text-white/75">
                {connectAccount?.account_status || "Not connected"}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/45">Pending claim</div>
              <div className="text-white">
                ${((pendingClaimSummary?.pendingClaimCents || 0) / 100).toFixed(2)}
                {" · "}
                {pendingClaimSummary?.claimCount || 0} item
                {(pendingClaimSummary?.claimCount || 0) === 1 ? "" : "s"}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/45">
                Reminder email
              </div>
              <div className="text-white/75">
                {pendingClaimSummary?.firstSaleEmailSentAt
                  ? new Date(pendingClaimSummary.firstSaleEmailSentAt).toLocaleString()
                  : "Not sent yet"}
              </div>
            </div>
          </div>
          {pendingClaimSummary && pendingClaimSummary.pendingClaimCents > 0 ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-50">
              <div className="font-medium">
                Pending claim is being held safely for this creator.
              </div>
              <div className="mt-1 text-amber-100/70">
                They are emailed after the first sale and through reminder cron runs, and the funds
                transfer automatically once Stripe onboarding is completed.
                {pendingClaimSummary.claimDeadline
                  ? ` Claim deadline: ${new Date(
                      pendingClaimSummary.claimDeadline,
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })} (${pendingClaimSummary.daysRemaining} days left).`
                  : ""}
              </div>
            </div>
          ) : null}
        </div>

        <div className={`${cardClass} p-4 sm:p-6 space-y-4`}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <BadgePercent className="h-4 w-4 text-cyan-300" />
            Fee holiday
          </h2>
          {activeFeeOverride ? (
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-4">
              <div className="text-sm font-semibold text-cyan-100">
                Creator keeps 100% until{" "}
                {new Date(activeFeeOverride.ends_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <p className="mt-2 text-sm text-cyan-50/75">
                Marketplace fee is currently 0% for new purchases routed to this creator.
              </p>
              <button
                type="button"
                disabled={feeOverrideBusy}
                onClick={() => void revokeFeeHoliday()}
                className="mt-4 rounded-xl border border-white/12 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {feeOverrideBusy ? "Updating…" : "End fee holiday"}
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-4">
              <div className="text-sm font-semibold text-white">
                Default marketplace fee applies
              </div>
              <p className="mt-2 text-sm text-white/55">
                Grant a 90-day 0% fee window so this creator keeps 100% of paid sales while the
                override is active.
              </p>
              <button
                type="button"
                disabled={feeOverrideBusy}
                onClick={() => void grantFeeHoliday()}
                className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {feeOverrideBusy ? "Applying…" : "Grant 0% fee for 90 days"}
              </button>
            </div>
          )}
          <div className="space-y-2 text-xs text-white/55">
            {feeOverrideHistory.length === 0 ? (
              <p className="text-white/40">No fee override history.</p>
            ) : (
              feeOverrideHistory.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
                >
                  <div className="text-white/75">
                    {row.platform_fee_percentage}% from{" "}
                    {new Date(row.starts_at).toLocaleDateString("en-US")} to{" "}
                    {new Date(row.ends_at).toLocaleDateString("en-US")}
                  </div>
                  <div className="text-white/40">
                    {row.revoked_at
                      ? `Revoked ${new Date(row.revoked_at).toLocaleString()}`
                      : "Active"}
                    {row.reason ? ` · ${row.reason}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={`${cardClass} p-4 sm:p-6 space-y-4`}>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-cyan-300" />
          Public fields
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-[11px] font-medium text-white/50">Display name</label>
            <input
              className={inputClass}
              value={draft.full_name}
              onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-white/50">Handle</label>
            <input
              className={inputClass}
              value={draft.handle}
              onChange={(e) => setDraft((d) => ({ ...d, handle: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-medium text-white/50">Bio</label>
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={draft.bio}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-medium text-white/50">Avatar URL</label>
            <input
              className={inputClass}
              value={draft.avatar_url}
              onChange={(e) => setDraft((d) => ({ ...d, avatar_url: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-medium text-white/50">Banner URL</label>
            <input
              className={inputClass}
              value={draft.banner_url}
              onChange={(e) => setDraft((d) => ({ ...d, banner_url: e.target.value }))}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void saveProfile()}
          disabled={saveBusy}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
        >
          {saveBusy ? "Saving…" : "Save profile"}
        </button>
      </div>

      <div className={`${cardClass} p-4 sm:p-6`}>
        <h2 className="text-sm font-semibold text-white mb-3">Claim links</h2>
        <div className="space-y-2 text-sm">
          {claimLinks.length === 0 ? (
            <p className="text-white/40">No links yet.</p>
          ) : (
            claimLinks.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
              >
                <span className="font-mono text-xs text-white/60">
                  {linkRecipientLabel(l.target_email)}
                </span>
                <span className="text-[11px] text-white/45">{l.status}</span>
                <span className="text-[11px] text-white/35">
                  {new Date(l.sent_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`${cardClass} p-4 sm:p-6`}>
        <h2 className="text-sm font-semibold text-white mb-3">Impersonation history</h2>
        <div className="space-y-2 text-xs text-white/60">
          {impSessions.length === 0 ? (
            <p className="text-white/40">No sessions logged.</p>
          ) : (
            impSessions.map((s) => (
              <div key={s.id} className="border-b border-white/[0.04] pb-2">
                <div>{s.status}</div>
                <div className="text-white/40">{s.reason}</div>
                <div className="text-white/35">{new Date(s.started_at).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`${cardClass} p-4 sm:p-6`}>
        <h2 className="text-sm font-semibold text-white mb-3">Recent audit</h2>
        <div className="max-h-64 overflow-y-auto space-y-2 text-xs font-mono text-white/55">
          {audits.length === 0 ? (
            <p className="text-white/40">No events.</p>
          ) : (
            audits.map((a) => (
              <div key={a.id} className="border-b border-white/[0.04] pb-1">
                {a.action} · {a.actor_mode} · {new Date(a.created_at).toISOString()}
              </div>
            ))
          )}
        </div>
      </div>

      {claimOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`${cardClass} w-full max-w-md p-6 space-y-4`}>
            <h3 className="text-lg font-semibold text-white">Generate claim link</h3>
            <p className="text-xs text-white/45 leading-relaxed">
              Anyone with the link can sign in and claim this workspace once. After a successful
              claim, the link stops working. Active links for this profile are revoked when you
              create a new one.
            </p>
            <div>
              <label className="text-[11px] text-white/50">Expires in (days)</label>
              <input
                className={inputClass}
                type="number"
                min={1}
                max={90}
                value={claimDays}
                onChange={(e) => setClaimDays(Number(e.target.value) || 14)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setClaimOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={claimBusy}
                onClick={() => void sendClaim()}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {claimBusy ? "Generating…" : "Generate link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {impOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`${cardClass} w-full max-w-md p-6 space-y-4`}>
            <h3 className="text-lg font-semibold text-white">Start impersonation</h3>
            <p className="text-sm text-amber-200/90">
              You will act in this creator workspace. A banner stays visible; actions are audited.
            </p>
            <div>
              <label className="text-[11px] text-white/50">Reason</label>
              <input
                className={inputClass}
                value={impReason}
                onChange={(e) => setImpReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setImpOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-white/70"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={impBusy}
                onClick={() => void startImpersonation()}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {impBusy ? "Starting…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
