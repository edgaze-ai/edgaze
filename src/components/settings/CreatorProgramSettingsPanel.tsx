"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/AuthContext";
import ProfileAvatar from "../ui/ProfileAvatar";
import VerifiedCreatorBadge from "../ui/VerifiedCreatorBadge";
import {
  ArrowRight,
  ExternalLink,
  Loader2,
  BadgeCheck,
  AlertTriangle,
  CircleDashed,
} from "lucide-react";

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type ConnectStatus = {
  hasAccount?: boolean;
  status?: string;
  readyForPayouts?: boolean;
  readyToProcessPayments?: boolean;
  onboardingComplete?: boolean;
  detailsSubmitted?: boolean;
  requirementsStatus?: string;
  requirementsCurrentlyDue?: string[];
  requirementsPastDue?: string[];
  requirementsEventuallyDue?: string[];
  requirementsDisabledReason?: string | null;
};

type EarningsPayload = {
  totalEarningsCents?: number;
  availableBalanceCents?: number;
  totalSales?: number;
  avgSaleCents?: number;
  recentEarnings?: number;
  nextPayout?: { amountCents?: number; arrivalDate?: string | null } | null;
  recentPayouts?: Array<{
    status?: string;
    amount_cents?: number;
    arrival_date?: string | null;
    created_at?: string | null;
    failure_message?: string | null;
  }>;
  pendingClaimCents?: number;
  claimDeadline?: string | null;
  daysRemaining?: number;
};

function SettingSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10 lg:p-12">
      <div className="mb-6">
        <h3 className="text-[16px] font-medium text-white mb-2">{title}</h3>
        <p className="text-[14px] text-white/50 leading-relaxed max-w-2xl">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function CreatorProgramSettingsPanel({
  shouldAutoRedirect = false,
}: {
  /** When true (desktop sidebar: Creator program), users who never connected Stripe are sent to /creators. Keep false on mobile layouts that render this panel alongside other sections. */
  shouldAutoRedirect?: boolean;
}) {
  const router = useRouter();
  const { userId, userEmail, profile, authReady, impersonationActive, getAccessToken } = useAuth();
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [earnings, setEarnings] = useState<EarningsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  const canReceivePayments = Boolean(profile?.can_receive_payments);
  const displayName =
    profile?.full_name || (profile?.handle ? `@${profile.handle}` : null) || userEmail || "Creator";

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const token = await getAccessToken({ eagerRefresh: true });
      const [cRes, eRes] = await Promise.all([
        fetch("/api/stripe/v2/connect/status", {
          credentials: "include",
          ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        }),
        fetch("/api/creator/earnings", {
          credentials: "include",
          ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        }),
      ]);
      if (cRes.ok) {
        const data = await cRes.json();
        setConnectStatus(data);
      } else {
        setConnectStatus({ hasAccount: false, status: "not_started" });
      }
      if (eRes.ok) {
        setEarnings(await eRes.json());
      } else {
        setEarnings(null);
      }
    } catch {
      setConnectStatus({ hasAccount: false, status: "not_started" });
      setEarnings(null);
    } finally {
      setLoading(false);
    }
  }, [userId, getAccessToken]);

  useEffect(() => {
    if (!authReady || !userId) return;
    void load();
  }, [authReady, userId, load]);

  const hasStripeAccount = Boolean(connectStatus?.hasAccount);
  const stripeReady = Boolean(
    connectStatus?.readyForPayouts ?? connectStatus?.readyToProcessPayments,
  );
  const financialsLive = canReceivePayments && stripeReady;
  const liveRequirementsCount =
    (connectStatus?.requirementsCurrentlyDue?.length ?? 0) +
    (connectStatus?.requirementsPastDue?.length ?? 0);
  const onboardingComplete = hasStripeAccount
    ? stripeReady ||
      (Boolean(connectStatus?.detailsSubmitted) &&
        liveRequirementsCount === 0 &&
        !connectStatus?.requirementsDisabledReason)
    : false;
  const requirementsLabel = connectStatus?.requirementsDisabledReason
    ? connectStatus.requirementsDisabledReason
    : liveRequirementsCount > 0
      ? `${liveRequirementsCount} pending`
      : hasStripeAccount
        ? "Clear"
        : "—";

  useEffect(() => {
    if (!shouldAutoRedirect) return;
    if (!authReady || !userId || loading || redirecting) return;
    if (impersonationActive) return;

    const notStartedProgram = !canReceivePayments && !hasStripeAccount;
    if (notStartedProgram) {
      setRedirecting(true);
      router.replace("/creators");
    }
  }, [
    shouldAutoRedirect,
    authReady,
    userId,
    loading,
    redirecting,
    impersonationActive,
    canReceivePayments,
    hasStripeAccount,
    router,
  ]);

  if (!authReady || !userId) {
    return null;
  }

  if (loading || redirecting) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-white/50 text-[15px]">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
          {redirecting ? "Taking you to the Creator Program…" : "Loading creator details…"}
        </div>
      </div>
    );
  }

  const unlockHref = hasStripeAccount ? "/creators/onboarding" : "/creators";
  const unlockLabel = hasStripeAccount ? "Resume payout setup" : "Join the Creator Program";
  const publicProfileHref = profile?.handle
    ? `/profile/${encodeURIComponent(profile.handle)}`
    : null;

  return (
    <div className="space-y-8">
      {!financialsLive && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <AlertTriangle className="h-5 w-5 text-amber-400/90 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-white/90">
                Finish setup to unlock payouts
              </p>
              <p className="text-[13px] text-white/55 mt-1 leading-relaxed">
                Earnings and payout schedules stay hidden until Stripe confirms your account can
                receive payments. Complete the Creator Program flow to activate everything below.
              </p>
            </div>
          </div>
          <Link
            href={unlockHref}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-white text-black text-[13px] font-semibold px-4 py-2.5 hover:bg-white/90 transition-colors"
          >
            {unlockLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <SettingSection
        title="Creator profile"
        description="How you appear to buyers on the marketplace. This is separate from payout activation."
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <ProfileAvatar
            name={displayName}
            avatarUrl={profile?.avatar_url ?? null}
            size={72}
            className="shrink-0 ring-2 ring-white/10 rounded-full"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[17px] font-medium text-white">
              <span>{displayName}</span>
              {profile?.is_verified_creator ? (
                <VerifiedCreatorBadge variant="pill" size="sm" className="shrink-0" />
              ) : null}
            </div>
            <div className="text-[14px] text-white/55">@{profile?.handle ?? "—"}</div>
            <div className="text-[13px] text-white/40 break-all">
              {profile?.email ?? userEmail ?? "—"}
            </div>
            {profile?.country ? (
              <div className="text-[13px] text-white/45">Country · {profile.country}</div>
            ) : null}
            {profile?.claim_status && profile.claim_status !== "claimed" ? (
              <div className="text-[12px] text-amber-400/90">
                Claim status · {profile.claim_status.replace(/_/g, " ")}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {profile?.is_verified_creator ? (
                <p className="text-[12px] text-white/45 leading-snug max-w-md">
                  Verified creators get this badge next to their name across Edgaze — marketplace,
                  comments, listing pages, and search.
                </p>
              ) : null}
              {profile?.is_founding_creator ? (
                <p className="text-[12px] text-white/45 leading-snug max-w-md">
                  OG Creator badge appears on your public profile only — it’s separate from platform
                  verification.
                </p>
              ) : null}
              {profile?.source === "admin_provisioned" ? (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
                  Partner account
                </span>
              ) : null}
            </div>
            {publicProfileHref ? (
              <Link
                href={publicProfileHref}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-cyan-400 hover:text-cyan-300 mt-2"
              >
                View public profile
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </Link>
            ) : null}
          </div>
        </div>
      </SettingSection>

      <SettingSection
        title="Payouts & Stripe"
        description="Stripe Connect powers payouts. Status is checked live against Stripe — not only from saved data."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] uppercase tracking-wide text-white/40">Program status</dt>
            <dd className="mt-1.5 flex items-center gap-2 text-[15px] text-white/90 font-medium">
              {financialsLive ? (
                <>
                  <BadgeCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  Active — ready for payouts
                </>
              ) : hasStripeAccount ? (
                <>
                  <CircleDashed className="h-5 w-5 text-amber-400/90 shrink-0" />
                  Setup in progress
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-400/90 shrink-0" />
                  Payouts not connected
                </>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] uppercase tracking-wide text-white/40">Stripe account</dt>
            <dd className="mt-1.5 text-[15px] text-white/85">
              {hasStripeAccount ? "Connected" : "Not connected"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] uppercase tracking-wide text-white/40">Onboarding</dt>
            <dd className="mt-1.5 text-[15px] text-white/85">
              {onboardingComplete ? "Complete" : "Incomplete"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] uppercase tracking-wide text-white/40">Requirements</dt>
            <dd className="mt-1.5 text-[15px] text-white/85 capitalize">
              {requirementsLabel.replace(/_/g, " ")}
            </dd>
          </div>
        </dl>
        {financialsLive ? (
          <div className="mt-6 pt-6 border-t border-white/[0.08]">
            <Link
              href="/dashboard/earnings"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-cyan-400 hover:text-cyan-300"
            >
              Open full creator dashboard
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}
      </SettingSection>

      <div
        className={
          financialsLive
            ? ""
            : "rounded-xl border border-white/[0.06] bg-black/20 p-1 pointer-events-none select-none"
        }
        aria-hidden={!financialsLive}
      >
        <div className={financialsLive ? "space-y-8" : "space-y-8 opacity-[0.38]"}>
          <SettingSection
            title="Earnings overview"
            description="Totals from marketplace sales and your withdrawable balance."
          >
            <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-[12px] uppercase tracking-wide text-white/40">
                  Lifetime earnings
                </dt>
                <dd className="mt-1.5 text-[20px] font-semibold text-white tabular-nums">
                  {formatUsd(earnings?.totalEarningsCents ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-wide text-white/40">
                  Available balance
                </dt>
                <dd className="mt-1.5 text-[20px] font-semibold text-white tabular-nums">
                  {formatUsd(earnings?.availableBalanceCents ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-wide text-white/40">Pending claim</dt>
                <dd className="mt-1.5 text-[20px] font-semibold text-white tabular-nums">
                  {formatUsd(earnings?.pendingClaimCents ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-wide text-white/40">Total sales</dt>
                <dd className="mt-1.5 text-[18px] font-medium text-white/90 tabular-nums">
                  {earnings?.totalSales ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-wide text-white/40">Avg. per sale</dt>
                <dd className="mt-1.5 text-[18px] font-medium text-white/90 tabular-nums">
                  {formatUsd(earnings?.avgSaleCents ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-wide text-white/40">
                  Sales (last 30 days)
                </dt>
                <dd className="mt-1.5 text-[18px] font-medium text-white/90 tabular-nums">
                  {earnings?.recentEarnings ?? 0}
                </dd>
              </div>
            </dl>
            {(earnings?.pendingClaimCents ?? 0) > 0 && financialsLive ? (
              <p className="mt-4 text-[13px] text-cyan-300/90">
                Claim deadline: {formatDate(earnings?.claimDeadline ?? null)}
                {typeof earnings?.daysRemaining === "number"
                  ? ` · ${earnings.daysRemaining} day${earnings.daysRemaining === 1 ? "" : "s"} remaining`
                  : ""}
              </p>
            ) : null}
          </SettingSection>

          <SettingSection
            title="Payout schedule"
            description="Automatic transfers to your bank — upcoming batch plus recent history."
          >
            <div className="space-y-6">
              <div>
                <h4 className="text-[12px] uppercase tracking-wide text-white/40 mb-2">
                  Next payout
                </h4>
                {earnings?.nextPayout ? (
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[15px] text-white/90">
                    <span className="font-semibold tabular-nums">
                      {formatUsd(earnings.nextPayout.amountCents ?? 0)}
                    </span>
                    <span className="text-white/45 mx-2">·</span>
                    <span className="text-white/55">
                      Arrives {formatDate(earnings.nextPayout.arrivalDate ?? null)}
                    </span>
                  </div>
                ) : (
                  <p className="text-[14px] text-white/45">No upcoming payout scheduled.</p>
                )}
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-wide text-white/40 mb-2">
                  Recent payouts
                </h4>
                {(earnings?.recentPayouts?.length ?? 0) === 0 ? (
                  <p className="text-[14px] text-white/45">No payout history yet.</p>
                ) : (
                  <ul className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] overflow-hidden">
                    {earnings!.recentPayouts!.map((row, i) => (
                      <li
                        key={`${row.created_at ?? ""}-${i}`}
                        className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 bg-white/[0.02] text-[14px]"
                      >
                        <span className="font-medium text-white/85 tabular-nums">
                          {formatUsd(row.amount_cents ?? 0)}
                        </span>
                        <span className="text-white/45 text-[13px] capitalize">
                          {(row.status ?? "—").replace(/_/g, " ")}
                        </span>
                        <span className="text-white/40 text-[12px] w-full sm:w-auto sm:text-right">
                          {formatDate(row.arrival_date ?? row.created_at ?? null)}
                        </span>
                        {row.failure_message ? (
                          <span className="text-[12px] text-red-400/90 w-full">
                            {row.failure_message}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </SettingSection>
        </div>
      </div>
    </div>
  );
}
