"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../components/auth/AuthContext";

type ProfileData = {
  displayName: string;
  handle: string;
  bio: string;

  website: string;
  youtube: string;
  tiktok: string;
  instagram: string;
  twitter: string;
  linkedin: string;
  twitch: string;
  github: string;
  discord: string;
  newsletter: string;
};

const DEFAULT_PROFILE = (name?: string, email?: string | null): ProfileData => {
  const guessedHandle =
    (email && email.split("@")[0]) ||
    (name && name.toLowerCase().replace(/\s+/g, "")) ||
    "";

  return {
    displayName: name ?? "Edgaze creator",
    handle: guessedHandle,
    bio: "This is your bio. You can edit this.",

    website: "",
    youtube: "",
    tiktok: "",
    instagram: "",
    twitter: "",
    linkedin: "",
    twitch: "",
    github: "",
    discord: "",
    newsletter: "",
  };
};

export default function ProfilePage() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const storageKey = user ? `edgaze_profile_${user.id}` : null;

  // Load profile after user is available
  useEffect(() => {
    if (!user || !storageKey) return;

    try {
      const raw =
        typeof window !== "undefined"
          ? localStorage.getItem(storageKey)
          : null;

      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ProfileData>;
        setProfile({
          ...DEFAULT_PROFILE(user.name ?? undefined, user.email ?? null),
          ...parsed,
        });
      } else {
        setProfile(DEFAULT_PROFILE(user.name ?? undefined, user.email ?? null));
      }
    } catch {
      setProfile(DEFAULT_PROFILE(user.name ?? undefined, user.email ?? null));
    }
  }, [user, storageKey]);

  // Auto-clear "Copied" state
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const handleChange = (field: keyof ProfileData, rawValue: string) => {
    if (!editing || !profile) return; // strict: ignore if not editing

    let value = rawValue;

    if (field === "handle") {
      // Normalise handle: strip leading @, remove spaces + weird chars
      value = value.replace(/^@+/, "");
      value = value.replace(/[^a-zA-Z0-9_.-]/g, "");
      value = value.toLowerCase();
    }

    setProfile({ ...profile, [field]: value });
  };

  const handleSave = () => {
    if (!editing || !profile || !storageKey) return;

    setSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(profile));
      setSavedAt(new Date().toLocaleTimeString());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleEditToggle = () => {
    if (!editing) {
      setEditing(true);
    } else {
      handleSave();
    }
  };

  const handleFollowClick = () => {
    // Placeholder for future follow system
    console.log("Follow clicked (placeholder)");
  };

  if (!user || !profile) {
    return (
      <div className="p-6 text-white/70">
        Loading profile…
      </div>
    );
  }

  const avatarSrc = user.image ?? "/brand/edgaze-mark.png";

  // Base app URL for public links
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  const publicProfileUrl =
    profile.handle && appUrl
      ? `${appUrl.replace(/\/$/, "")}/profile/@${profile.handle}`
      : "";

  const handleCopyLink = async () => {
    if (!publicProfileUrl) return;
    try {
      await navigator.clipboard.writeText(publicProfileUrl);
      setCopied(true);
    } catch (err) {
      console.error("Failed to copy profile link", err);
    }
  };

  // Build social link list for view mode
  const socialEntries = [
    { key: "website", label: "Website", value: profile.website },
    { key: "youtube", label: "YouTube", value: profile.youtube },
    { key: "tiktok", label: "TikTok", value: profile.tiktok },
    { key: "instagram", label: "Instagram", value: profile.instagram },
    { key: "twitter", label: "X (Twitter)", value: profile.twitter },
    { key: "linkedin", label: "LinkedIn", value: profile.linkedin },
    { key: "twitch", label: "Twitch", value: profile.twitch },
    { key: "github", label: "GitHub", value: profile.github },
    { key: "discord", label: "Discord", value: profile.discord },
    {
      key: "newsletter",
      label: "Newsletter / Substack",
      value: profile.newsletter,
    },
  ];

  const filledSocials = socialEntries.filter(
    (s) => s.value && s.value.trim().length > 0
  );

  return (
    <div className="flex flex-col w-full overflow-y-auto bg-[#050505] text-white">
      {/* Banner */}
      <div className="relative w-full h-40 bg-gradient-to-r from-purple-700 via-cyan-600 to-blue-500">
        {editing && (
          <button
            type="button"
            className="absolute right-6 bottom-3 rounded-full bg-black/40 border border-white/30 px-3 py-1 text-xs text-white hover:bg-black/70"
          >
            Change banner (coming soon)
          </button>
        )}
      </div>

      {/* Profile header */}
      <div className="px-6 py-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#050505]">
        <div className="flex items-center gap-6">
          <div className="relative">
            <img
              src={avatarSrc}
              alt={profile.displayName}
              className="h-24 w-24 rounded-full object-cover border-4 border-[#050505]"
            />
            {editing && (
              <button
                type="button"
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 border border-white/40 px-2 py-0.5 text-[10px] text-white hover:bg-black/90"
              >
                Change photo (coming soon)
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {editing ? (
              <>
                <input
                  value={profile.displayName}
                  onChange={(e) =>
                    handleChange("displayName", e.target.value)
                  }
                  className="text-lg sm:text-2xl font-semibold leading-tight bg-transparent border-b border-white/20 focus:border-cyan-400 outline-none px-0 py-0.5"
                />
                <div className="flex items-center gap-1 text-xs text-white/60">
                  <span className="text-white/40">@</span>
                  <input
                    value={profile.handle}
                    onChange={(e) => handleChange("handle", e.target.value)}
                    className="bg-transparent border-b border-white/20 focus:border-cyan-400 outline-none px-0 py-0.5 text-xs"
                    placeholder="handle"
                  />
                </div>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold leading-tight">
                  {profile.displayName}
                </h1>
                {profile.handle && (
                  <p className="text-xs text-white/60">@{profile.handle}</p>
                )}
              </>
            )}
            <p className="text-white/60 text-sm">{user.email}</p>
            <p className="text-white/45 text-xs">Plan: {user.plan}</p>

            {/* Public link row */}
            {profile.handle && publicProfileUrl && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                <span className="truncate max-w-xs sm:max-w-sm">
                  Public profile:{" "}
                  <span className="text-white/80">
                    /profile/@{profile.handle}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-white/80 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end text-[11px] text-white/45">
          {savedAt && <span>Saved at {savedAt}</span>}
          {editing && saving && <span>Saving…</span>}
        </div>
      </div>

      {/* ACTION ROW: big buttons */}
      <div className="px-6 pt-4 pb-2 flex flex-col sm:flex-row gap-3">
        {/* Follow: solid blue */}
        <button
          type="button"
          onClick={handleFollowClick}
          className="flex-1 rounded-full bg-sky-500 px-4 py-2.5 text-center text-sm font-medium text-black hover:bg-sky-400 transition-colors"
        >
          Follow
        </button>

        {/* Edit: gradient border */}
        <button
          type="button"
          onClick={handleEditToggle}
          disabled={saving}
          className="flex-1 rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 p-[1px] disabled:opacity-60"
        >
          <div className="w-full rounded-full bg-[#050505] px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-[#080808] transition-colors">
            {editing ? "Save profile" : "Edit profile"}
          </div>
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-6 space-y-8">
        {/* Bio */}
        <section>
          <h2 className="text-lg font-semibold mb-2">Bio</h2>
          {editing ? (
            <textarea
              value={profile.bio}
              onChange={(e) => handleChange("bio", e.target.value)}
              rows={3}
              className="w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 resize-none"
            />
          ) : (
            <div className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-sm text-white/80 min-h-[72px]">
              {profile.bio?.trim() ? (
                profile.bio
              ) : (
                <span className="text-white/40">No bio yet.</span>
              )}
            </div>
          )}
        </section>

        {/* Social links */}
        {editing ? (
          <section>
            <h2 className="text-lg font-semibold mb-2">Social links</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InputField
                label="Website"
                placeholder="https://your-site.com"
                value={profile.website}
                onChange={(v) => handleChange("website", v)}
              />
              <InputField
                label="YouTube"
                placeholder="Channel URL or handle"
                value={profile.youtube}
                onChange={(v) => handleChange("youtube", v)}
              />
              <InputField
                label="TikTok"
                placeholder="@yourhandle"
                value={profile.tiktok}
                onChange={(v) => handleChange("tiktok", v)}
              />
              <InputField
                label="Instagram"
                placeholder="@yourhandle"
                value={profile.instagram}
                onChange={(v) => handleChange("instagram", v)}
              />
              <InputField
                label="X / Twitter"
                placeholder="@yourhandle"
                value={profile.twitter}
                onChange={(v) => handleChange("twitter", v)}
              />
              <InputField
                label="LinkedIn"
                placeholder="Profile or page URL"
                value={profile.linkedin}
                onChange={(v) => handleChange("linkedin", v)}
              />
              <InputField
                label="Twitch"
                placeholder="Channel URL"
                value={profile.twitch}
                onChange={(v) => handleChange("twitch", v)}
              />
              <InputField
                label="GitHub"
                placeholder="github.com/yourname"
                value={profile.github}
                onChange={(v) => handleChange("github", v)}
              />
              <InputField
                label="Discord"
                placeholder="Server invite or username"
                value={profile.discord}
                onChange={(v) => handleChange("discord", v)}
              />
              <InputField
                label="Newsletter / Substack"
                placeholder="Newsletter URL"
                value={profile.newsletter}
                onChange={(v) => handleChange("newsletter", v)}
              />
            </div>
          </section>
        ) : (
          filledSocials.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-2">Social links</h2>
              <div className="flex flex-wrap gap-2">
                {filledSocials.map((s) => (
                  <SocialPill key={s.key} label={s.label} value={s.value} />
                ))}
              </div>
            </section>
          )
        )}

        {/* Metrics */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Creator metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard label="Followers" value="0" />
            <MetricCard label="Workflows" value="0" />
            <MetricCard label="Prompts" value="0" />
          </div>
        </section>

        {/* Creations */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Your creations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/5 h-32 flex items-center justify-center text-white/40"
              >
                Coming soon…
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-5 flex flex-col items-center">
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-sm text-white/60">{label}</span>
    </div>
  );
}

function InputField(props: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { label, placeholder, value, onChange } = props;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-white/65">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400"
      />
    </div>
  );
}

function SocialPill({ label, value }: { label: string; value: string }) {
  const isUrl = value.startsWith("http://") || value.startsWith("https://");

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/85">
      <span className="font-medium text-white/75">{label}:</span>
      {isUrl ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-white/40 underline-offset-2 hover:text-cyan-300"
        >
          {value}
        </a>
      ) : (
        <span className="text-white/75">{value}</span>
      )}
    </div>
  );
}
