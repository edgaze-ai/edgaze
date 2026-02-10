"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth/AuthContext";
import ProfileAvatar from "../../components/ui/ProfileAvatar";
import HandleChangeWarningDialog from "../../components/settings/HandleChangeWarningDialog";
import HandleCooldownBanner from "../../components/settings/HandleCooldownBanner";
import {
  ArrowLeft,
  Shield,
  Pencil,
  Loader2,
  Check,
  X,
  User,
  Bell,
  LogOut,
  Mail,
  BadgeCheck,
  LogIn,
} from "lucide-react";

function normalizeHandle(input: string) {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 24);
}

const HANDLE_REGEX = /^[a-z0-9_]{3,24}$/;

const SECTIONS = [
  { id: "account", label: "Account", icon: User },
  { id: "preferences", label: "Preferences", icon: Bell },
] as const;

// Vercel-style setting section component
function SettingSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10 lg:p-12">
      <div className="mb-6">
        <h3 className="text-[16px] font-medium text-white mb-2">{title}</h3>
        <p className="text-[14px] text-white/50 leading-relaxed max-w-2xl">{description}</p>
      </div>
      <div className="mb-6">{children}</div>
      {action && <div className="flex justify-end">{action}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { userId, userEmail, profile, isVerified, isAdmin, loading, authReady, signOut, updateProfile, openSignIn } = useAuth();
  const [handleEdit, setHandleEdit] = useState("");
  const [handleSaving, setHandleSaving] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [handleSuccess, setHandleSuccess] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("account");
  
  // Handle change cooldown state
  const [handleChangeStatus, setHandleChangeStatus] = useState<{
    canChange: boolean;
    lastChangedAt: string | null;
    nextAllowedAt: string | null;
    daysRemaining: number;
  } | null>(null);
  const [checkingHandleStatus, setCheckingHandleStatus] = useState(false);
  const [showHandleWarning, setShowHandleWarning] = useState(false);
  const [pendingHandleChange, setPendingHandleChange] = useState<string | null>(null);

  const displayName = useMemo(() => {
    if (profile?.full_name) return profile.full_name;
    if (profile?.handle) return `@${profile.handle}`;
    if (userEmail) return userEmail;
    return "Creator";
  }, [profile?.full_name, profile?.handle, userEmail]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  // Check handle change status when user is loaded
  useEffect(() => {
    if (!userId || !authReady) return;
    
    const checkHandleChangeStatus = async () => {
      setCheckingHandleStatus(true);
      try {
        const res = await fetch("/api/profile/check-handle-change");
        if (res.ok) {
          const data = await res.json();
          setHandleChangeStatus(data);
        }
      } catch (e) {
        console.error("Failed to check handle change status:", e);
      } finally {
        setCheckingHandleStatus(false);
      }
    };

    checkHandleChangeStatus();
  }, [userId, authReady]);

  // Enable scrolling (same pattern as help page)
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    const prevOverflowY = main.style.overflowY;
    const prevOverflowX = main.style.overflowX;
    const prevMinHeight = main.style.minHeight;
    const prevWebkit = main.style.getPropertyValue("-webkit-overflow-scrolling");

    main.style.overflowY = "auto";
    main.style.overflowX = "hidden";
    main.style.minHeight = "0";
    main.style.setProperty("-webkit-overflow-scrolling", "touch");

    return () => {
      main.style.overflowY = prevOverflowY;
      main.style.overflowX = prevOverflowX;
      main.style.minHeight = prevMinHeight;
      if (prevWebkit) main.style.setProperty("-webkit-overflow-scrolling", prevWebkit);
      else main.style.removeProperty("-webkit-overflow-scrolling");
    };
  }, []);

  if (loading || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[#0a0a0a]">
        <div className="flex items-center gap-3 text-white/50 text-[15px]">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
          Loading…
        </div>
      </div>
    );
  }

  // Signed out: premium sign-in CTA
  if (!userId) {
    return (
      <div className="min-h-screen w-full bg-[#0a0a0a] text-white flex flex-col items-center justify-center px-6 py-16" data-settings-page>
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-[#0a0a0a]" />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 100% 60% at 50% 0%, rgba(120,119,198,0.12), transparent 60%), radial-gradient(ellipse 80% 50% at 80% 80%, rgba(34,211,238,0.06), transparent 50%)",
            }}
          />
        </div>
        <div className="w-full max-w-md mx-auto text-center">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-10 sm:p-12 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-6">
              <User className="h-7 w-7 text-white/60" />
            </div>
            <h1 className="text-[22px] sm:text-[24px] font-semibold text-white tracking-tight">Settings</h1>
            <p className="mt-3 text-[15px] text-white/55 leading-relaxed max-w-sm mx-auto">
              Sign in to manage your account, profile, and preferences.
            </p>
            <button
              type="button"
              onClick={openSignIn}
              className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black px-6 py-4 text-[15px] font-semibold hover:bg-white/95 transition-colors"
            >
              <LogIn className="h-5 w-5" />
              Sign in
            </button>
            <Link
              href="/"
              className="mt-5 inline-block text-[14px] text-white/50 hover:text-white/70 transition-colors"
            >
              ← Back to home
            </Link>
          </div>
          <p className="mt-8 text-[12px] text-white/35">© {new Date().getFullYear()} Edgaze</p>
        </div>
      </div>
    );
  }

  const saveHandleAction = handleEdit !== "" ? (
    <button
      type="button"
      onClick={async () => {
        const normalized = normalizeHandle(handleEdit);
        setHandleError(null);
        setHandleSuccess(false);
        if (!normalized) {
          setHandleError("Handle is required.");
          return;
        }
        if (!HANDLE_REGEX.test(normalized)) {
          setHandleError("3–24 characters, letters, numbers, underscores only.");
          return;
        }
        if (normalized === profile?.handle) {
          setHandleEdit("");
          return;
        }

        // Check if handle change is allowed (60-day cooldown)
        if (handleChangeStatus && !handleChangeStatus.canChange) {
          setHandleError(`You can change your handle again in ${handleChangeStatus.daysRemaining} ${handleChangeStatus.daysRemaining === 1 ? "day" : "days"}.`);
          return;
        }

        // Check availability
        const res = await fetch(
          `/api/handle-available?handle=${encodeURIComponent(normalized)}&exclude_user_id=${encodeURIComponent(userId ?? "")}`
        );
        const data = await res.json();
        if (!data.available) {
          setHandleError(data.reason === "invalid" ? "Invalid format." : "That handle is already taken.");
          return;
        }

        // Show warning dialog before proceeding
        setPendingHandleChange(normalized);
        setShowHandleWarning(true);
      }}
      disabled={handleSaving || checkingHandleStatus}
      className="px-4 py-2 rounded-lg bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
    >
      {handleSaving ? "Saving..." : "Save"}
    </button>
  ) : null;

  // Actual handle save function (called after warning confirmation)
  const performHandleChange = async (normalized: string) => {
    setHandleSaving(true);
    setHandleError(null);
    try {
      const result = await updateProfile({ handle: normalized });
      if (!result.ok) {
        // Close modal and show error in main UI
        setShowHandleWarning(false);
        setPendingHandleChange(null);
        setHandleError(result.error ?? "Failed to update handle.");
        return;
      }
      setHandleSuccess(true);
      setHandleEdit("");
      setShowHandleWarning(false);
      setPendingHandleChange(null);
      
      // Refresh handle change status
      const res = await fetch("/api/profile/check-handle-change");
      if (res.ok) {
        const data = await res.json();
        setHandleChangeStatus(data);
      }
      
      setTimeout(() => setHandleSuccess(false), 3000);
    } finally {
      setHandleSaving(false);
    }
  };

  const handleContent = (
    <div className="space-y-4">
      {/* Show cooldown banner if user cannot change handle */}
      {handleChangeStatus && !handleChangeStatus.canChange && handleChangeStatus.lastChangedAt && handleChangeStatus.nextAllowedAt && (
        <HandleCooldownBanner
          lastChangedAt={handleChangeStatus.lastChangedAt}
          nextAllowedAt={handleChangeStatus.nextAllowedAt}
          daysRemaining={handleChangeStatus.daysRemaining}
        />
      )}

      {handleEdit === "" ? (
        <div className="flex items-center gap-3">
          <span className="text-[15px] text-white/90 font-medium">@{profile?.handle ?? "—"}</span>
          <button
            type="button"
            onClick={() => {
              if (handleChangeStatus && !handleChangeStatus.canChange) {
                setHandleError(`Handle changes are locked for ${handleChangeStatus.daysRemaining} more ${handleChangeStatus.daysRemaining === 1 ? "day" : "days"}.`);
                return;
              }
              setHandleEdit(profile?.handle ?? "");
            }}
            disabled={handleChangeStatus ? !handleChangeStatus.canChange : false}
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Edit handle"
            title={handleChangeStatus && !handleChangeStatus.canChange ? `Available in ${handleChangeStatus.daysRemaining} days` : "Edit handle"}
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-[15px] shrink-0">@</span>
            <input
              type="text"
              value={handleEdit}
              onChange={(e) => {
                setHandleError(null);
                setHandleSuccess(false);
                setHandleEdit(e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase().slice(0, 24));
              }}
              placeholder="handle"
              className="flex-1 min-w-0 rounded-lg bg-white/[0.06] border border-white/[0.10] px-4 py-2.5 text-[15px] text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/15"
            />
            <button
              type="button"
              onClick={() => {
                setHandleEdit("");
                setHandleError(null);
                setHandleSuccess(false);
              }}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {handleError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-red-400 text-[13px] font-medium">{handleError}</p>
            </div>
          )}
          {handleSuccess && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
              <p className="text-emerald-400 text-[13px] font-medium">Handle updated successfully.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#0a0a0a] text-white flex overflow-hidden" data-settings-page>
      {/* Subtle background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[#0a0a0a]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 120% 70% at 50% -30%, rgba(120,119,198,0.08), transparent 55%), radial-gradient(ellipse 80% 50% at 100% 50%, rgba(34,211,238,0.04), transparent 45%)",
          }}
        />
      </div>

      {/* Sidebar — fixed, doesn't scroll */}
      <aside className="hidden md:flex w-[240px] lg:w-[280px] shrink-0 border-r border-white/[0.08] bg-[#0a0a0a]/95 flex-col h-full overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-white/[0.08]">
          <Link
            href="/library"
            className="inline-flex items-center gap-2 text-[13px] text-white/50 hover:text-white/80 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="text-[16px] font-semibold text-white tracking-tight">Settings</h1>
          <p className="text-[12px] text-white/40 mt-1">Manage your account</p>
        </div>
        <nav className="flex-1 p-4 lg:p-6 space-y-0.5">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors ${
                activeSection === id
                  ? "bg-white/[0.08] text-white"
                  : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-70" />
              {label}
            </button>
          ))}
          {isAdmin && (
            <Link
              href="/admin/moderation"
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] text-white/50 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
            >
              <Shield className="h-4 w-4 shrink-0 opacity-70" />
              Admin
            </Link>
          )}
        </nav>
        <div className="p-4 lg:p-6 border-t border-white/[0.08]">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] text-red-400/90 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content — this scrolls, sidebar stays fixed */}
      <main className="flex-1 min-w-0 h-full flex flex-col overflow-y-auto overflow-x-hidden">
        <div className="flex-1 w-full max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 py-8 sm:py-12 lg:py-16 pb-16">
          {/* Desktop: show active section only */}
          <div className="hidden md:block">
            {activeSection === "account" && (
              <section id="account" className="space-y-8">
                <div>
                  <h2 className="text-[24px] lg:text-[28px] font-semibold text-white tracking-tight">Account</h2>
                  <p className="text-[14px] text-white/50 mt-1.5">Manage your account settings and profile</p>
                </div>

                <SettingSection
                  title="Profile Avatar"
                  description="This is your profile avatar. Click on the avatar to upload a custom one from your files. An avatar is optional but strongly recommended."
                >
                  <div className="flex items-center gap-6">
                    <ProfileAvatar
                      name={displayName}
                      avatarUrl={(profile as { avatar_url?: string | null })?.avatar_url ?? null}
                      size={80}
                      className="shrink-0 ring-2 ring-white/10 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[16px] font-medium text-white truncate">{displayName}</div>
                      <div className="flex items-center gap-2 mt-1 text-[13px] text-white/50 truncate">
                        <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span className="truncate">{userEmail ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                </SettingSection>

                <SettingSection title="Handle" description="This is your unique handle on Edgaze. It appears in your profile URL and is used to identify you across the platform. Please use 3-24 characters, letters, numbers, and underscores only. You can change your handle once every 60 days." action={saveHandleAction}>
                  {handleContent}
                </SettingSection>

                <SettingSection title="User ID" description="Your unique user identifier. This cannot be changed and is used internally by the system.">
                  <div className="text-[13px] text-white/60 break-all font-mono">{userId ?? "—"}</div>
                </SettingSection>

                <SettingSection title="Plan" description="Your current subscription plan. Upgrade to unlock more features and capabilities.">
                  <div className="text-[15px] text-white/90 font-medium">{profile?.plan ?? "Free"}</div>
                </SettingSection>

                <SettingSection title="Email Verified" description="Your email verification status. Verified emails help secure your account and enable important notifications.">
                  <div className="flex items-center gap-2">
                    {isVerified ? (
                      <>
                        <BadgeCheck className="h-5 w-5 text-emerald-400" />
                        <span className="text-[15px] text-emerald-400 font-medium">Verified</span>
                      </>
                    ) : (
                      <span className="text-[15px] text-amber-400/90 font-medium">Not verified</span>
                    )}
                  </div>
                </SettingSection>
              </section>
            )}

            {activeSection === "preferences" && (
              <section id="preferences" className="space-y-8">
                <div>
                  <h2 className="text-[24px] lg:text-[28px] font-semibold text-white tracking-tight">Preferences</h2>
                  <p className="text-[14px] text-white/50 mt-1.5">Customize your notification and update preferences</p>
                </div>

                <SettingSection title="Email Notifications" description="Receive email notifications about important updates, security alerts, and activity on your account.">
                  <div className="text-[14px] text-white/40">Coming soon</div>
                </SettingSection>

                <SettingSection title="Product Updates" description="Get notified about new features, improvements, and platform updates.">
                  <div className="text-[14px] text-white/40">Coming soon</div>
                </SettingSection>
              </section>
            )}
          </div>

          {/* Mobile: show all sections vertically with clear separators */}
          <div className="md:hidden space-y-16">
            {/* Account Section */}
            <section id="account-mobile" className="space-y-8">
              <div className="pb-4 border-b border-white/[0.12]">
                <h2 className="text-[24px] font-semibold text-white tracking-tight flex items-center gap-3">
                  <User className="h-6 w-6 text-white/60" />
                  Account
                </h2>
                <p className="text-[14px] text-white/50 mt-2">Manage your account settings and profile</p>
              </div>

              <SettingSection title="Profile Avatar" description="This is your profile avatar. An avatar is optional but strongly recommended.">
                <div className="flex items-center gap-6">
                  <ProfileAvatar
                    name={displayName}
                    avatarUrl={(profile as { avatar_url?: string | null })?.avatar_url ?? null}
                    size={80}
                    className="shrink-0 ring-2 ring-white/10 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-medium text-white truncate">{displayName}</div>
                    <div className="flex items-center gap-2 mt-1 text-[13px] text-white/50 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{userEmail ?? "—"}</span>
                    </div>
                  </div>
                </div>
              </SettingSection>

              <SettingSection title="Handle" description="Your unique handle. Please use 3-24 characters, letters, numbers, and underscores only. You can change your handle once every 60 days." action={saveHandleAction}>
                {handleContent}
              </SettingSection>

              <SettingSection title="User ID" description="Your unique user identifier. This cannot be changed.">
                <div className="text-[13px] text-white/60 break-all font-mono">{userId ?? "—"}</div>
              </SettingSection>

              <SettingSection title="Plan" description="Your current subscription plan.">
                <div className="text-[15px] text-white/90 font-medium">{profile?.plan ?? "Free"}</div>
              </SettingSection>

              <SettingSection title="Email Verified" description="Your email verification status.">
                <div className="flex items-center gap-2">
                  {isVerified ? (
                    <>
                      <BadgeCheck className="h-5 w-5 text-emerald-400" />
                      <span className="text-[15px] text-emerald-400 font-medium">Verified</span>
                    </>
                  ) : (
                    <span className="text-[15px] text-amber-400/90 font-medium">Not verified</span>
                  )}
                </div>
              </SettingSection>
            </section>

            {/* Preferences Section */}
            <section id="preferences-mobile" className="space-y-8">
              <div className="pb-4 border-b border-white/[0.12]">
                <h2 className="text-[24px] font-semibold text-white tracking-tight flex items-center gap-3">
                  <Bell className="h-6 w-6 text-white/60" />
                  Preferences
                </h2>
                <p className="text-[14px] text-white/50 mt-2">Customize your notification and update preferences</p>
              </div>

              <SettingSection title="Email Notifications" description="Receive email notifications about important updates, security alerts, and activity on your account.">
                <div className="text-[14px] text-white/40">Coming soon</div>
              </SettingSection>

              <SettingSection title="Product Updates" description="Get notified about new features, improvements, and platform updates.">
                <div className="text-[14px] text-white/40">Coming soon</div>
              </SettingSection>
            </section>
          </div>
        </div>

        <footer className="border-t border-white/[0.08] py-6 px-6 sm:px-8 lg:px-12">
          <p className="text-[12px] text-white/30">© {new Date().getFullYear()} Edgaze</p>
        </footer>
      </main>

      {/* Handle Change Warning Dialog */}
      <HandleChangeWarningDialog
        isOpen={showHandleWarning}
        onClose={() => {
          setShowHandleWarning(false);
          setPendingHandleChange(null);
        }}
        onConfirm={() => {
          if (pendingHandleChange) {
            performHandleChange(pendingHandleChange);
          }
        }}
        currentHandle={profile?.handle ?? ""}
        newHandle={pendingHandleChange ?? ""}
        isProcessing={handleSaving}
      />
    </div>
  );
}
