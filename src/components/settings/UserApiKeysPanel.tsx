"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import type { UserApiKeyMetadata, UserApiKeyProvider } from "@lib/user-api-keys/constants";
import { USER_API_KEY_PROVIDERS } from "@lib/user-api-keys/constants";
import { bearerAuthHeaders } from "@lib/auth/bearer-headers";
import { useAuth } from "../auth/AuthContext";

const PROVIDER_LABEL: Record<UserApiKeyProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  gemini: "Google AI (Gemini)",
};

function formatProviderUpdated(at: string | null): string {
  if (!at) return "";
  try {
    return new Date(at).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

export function UserApiKeysPanel({
  heading = "API keys",
  description = "BYO keys for AI providers. Once saved, keys cannot be viewed—only replaced or removed. Stored encrypted on our servers.",
  showIntro = true,
}: {
  heading?: string;
  description?: string;
  /** When false, only the key list is shown (parent supplies section title). */
  showIntro?: boolean;
}) {
  const { getAccessToken } = useAuth();
  const [keys, setKeys] = useState<UserApiKeyMetadata[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replacing, setReplacing] = useState<UserApiKeyProvider | null>(null);
  const [newSecrets, setNewSecrets] = useState<Partial<Record<UserApiKeyProvider, string>>>({});
  const [saving, setSaving] = useState<UserApiKeyProvider | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<UserApiKeyProvider | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/user/api-keys", {
      credentials: "include",
      headers: await bearerAuthHeaders(getAccessToken),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setLoadError(typeof data.error === "string" ? data.error : "Failed to load keys");
      setKeys(null);
      return;
    }
    setKeys(data.keys as UserApiKeyMetadata[]);
  }, [getAccessToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const startReplace = (p: UserApiKeyProvider) => {
    setFormError(null);
    setReplacing(p);
    setNewSecrets((s) => ({ ...s, [p]: "" }));
  };

  const cancelReplace = () => {
    setReplacing(null);
    setFormError(null);
  };

  const saveKey = async (p: UserApiKeyProvider) => {
    const secret = (newSecrets[p] ?? "").trim();
    if (secret.length < 8) {
      setFormError("Enter a complete key (at least 8 characters).");
      return;
    }
    setSaving(p);
    setFormError(null);
    try {
      const auth = await bearerAuthHeaders(getAccessToken);
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        credentials: "include",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p, secret }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setFormError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      setKeys(data.keys as UserApiKeyMetadata[]);
      setReplacing(null);
      setNewSecrets((s) => {
        const next = { ...s };
        delete next[p];
        return next;
      });
    } finally {
      setSaving(null);
    }
  };

  const removeKey = async (p: UserApiKeyProvider) => {
    if (!confirm(`Remove saved ${PROVIDER_LABEL[p]} key from your account?`)) return;
    setRemoving(p);
    setFormError(null);
    try {
      const res = await fetch(`/api/user/api-keys?provider=${encodeURIComponent(p)}`, {
        method: "DELETE",
        credentials: "include",
        headers: await bearerAuthHeaders(getAccessToken),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setFormError(typeof data.error === "string" ? data.error : "Remove failed");
        return;
      }
      setKeys(data.keys as UserApiKeyMetadata[]);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-6">
      {showIntro && (heading || description) && (
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-white/[0.1] bg-white/[0.04] p-2.5 shrink-0">
            <KeyRound className="h-5 w-5 text-white/70" />
          </div>
          <div>
            {heading ? <h3 className="text-[16px] font-medium text-white">{heading}</h3> : null}
            {description ? (
              <p className="text-[14px] text-white/50 leading-relaxed mt-1 max-w-2xl">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {loadError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-red-400 text-[13px]">
          {loadError}
        </div>
      )}
      {formError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-red-400 text-[13px]">
          {formError}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-white/50 text-[14px]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      )}

      {!loading && keys && (
        <div className="space-y-4">
          {USER_API_KEY_PROVIDERS.map((provider) => {
            const meta = keys.find((k) => k.provider === provider);
            const configured = meta?.configured ?? false;
            const isEditing = replacing === provider;

            return (
              <div
                key={provider}
                className="rounded-xl border border-white/[0.1] bg-[#0c0c0c] p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-medium text-white/90">
                      {PROVIDER_LABEL[provider]}
                    </div>
                    <div className="text-[12px] text-white/45 mt-1">
                      {configured ? (
                        <>
                          Saved — last updated{" "}
                          {formatProviderUpdated(meta?.updatedAt ?? null) || "recently"}. You cannot
                          view this key again.
                        </>
                      ) : (
                        <>No key saved.</>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {configured && !isEditing && (
                      <button
                        type="button"
                        onClick={() => removeKey(provider)}
                        disabled={removing === provider}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/70 hover:bg-white/[0.08] disabled:opacity-50"
                      >
                        {removing === provider ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => (isEditing ? cancelReplace() : startReplace(provider))}
                      className="rounded-lg bg-white text-black px-3 py-1.5 text-[12px] font-medium hover:bg-white/90"
                    >
                      {configured ? (isEditing ? "Cancel" : "Replace key") : "Add key"}
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="pt-2 space-y-2">
                    <input
                      type="password"
                      value={newSecrets[provider] ?? ""}
                      onChange={(e) =>
                        setNewSecrets((s) => ({ ...s, [provider]: e.target.value }))
                      }
                      placeholder={configured ? "Paste new secret to replace" : "Paste secret key"}
                      autoComplete="off"
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-[13px] text-white placeholder-white/35 focus:border-cyan-500/35 focus:outline-none focus:ring-1 focus:ring-cyan-500/25"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => saveKey(provider)}
                        disabled={saving === provider}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/90 text-black px-4 py-2 text-[13px] font-medium hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {saving === provider && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save key
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
