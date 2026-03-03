'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Upload, Check, X, Loader2 } from 'lucide-react';
import debounce from 'lodash.debounce';

interface ProfileStepProps {
  userId: string;
  onContinue: () => void;
}

export default function ProfileStep({ userId, onContinue }: ProfileStepProps) {
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [handleChecking, setHandleChecking] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const supabase = createSupabaseBrowserClient();

  // Check handle availability
  const checkHandleAvailability = useCallback(
    debounce(async (handleValue: string) => {
      if (!handleValue || handleValue.length < 3) {
        setHandleAvailable(null);
        return;
      }

      setHandleChecking(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('handle')
          .ilike('handle', handleValue)
          .maybeSingle();

        setHandleAvailable(!data);
      } catch (err) {
        console.error('Handle check error:', err);
        setHandleAvailable(null);
      } finally {
        setHandleChecking(false);
      }
    }, 400),
    []
  );

  useEffect(() => {
    if (handle) {
      checkHandleAvailability(handle);
    }
  }, [handle, checkHandleAvailability]);

  const handleAvatarUpload = async (file: File) => {
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBannerUpload = async (file: File) => {
    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setBannerUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadToStorage = async (file: File, bucket: string, path: string): Promise<string> => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
    });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let finalAvatarUrl = avatarUrl;
      let finalBannerUrl = bannerUrl;

      // Upload avatar if new file
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const path = `${userId}/avatar-${Date.now()}.${ext}`;
        finalAvatarUrl = await uploadToStorage(avatarFile, 'avatars', path);
      }

      // Upload banner if new file
      if (bannerFile) {
        const ext = bannerFile.name.split('.').pop();
        const path = `${userId}/banner-${Date.now()}.${ext}`;
        finalBannerUrl = await uploadToStorage(bannerFile, 'banners', path);
      }

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: displayName,
          handle: handle.toLowerCase(),
          avatar_url: finalAvatarUrl,
          banner_url: finalBannerUrl,
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Update onboarding state
      await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'stripe',
          profile_completed: true,
        }),
      });

      onContinue();
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
      setLoading(false);
    }
  };

  const isFormValid = displayName && handle && handleAvailable && avatarUrl;

  return (
    <motion.div
      initial="enter"
      animate="center"
      exit="exit"
      variants={{
        enter: { opacity: 0, y: 24 },
        center: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
        exit: { opacity: 0, y: -16, transition: { duration: 0.3, ease: 'easeIn' } },
      }}
      className="min-h-[100dvh] px-4 py-12"
    >
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2">
        {/* Left: Form */}
        <div>
          <h2 className="mb-2 text-3xl font-bold text-white">Set up your profile</h2>
          <p className="mb-8 text-sm opacity-50">
            This is how you'll appear on the marketplace
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 font-dm-sans text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Photo */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">
                Profile Photo *
              </label>
              <div
                className="group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-white/[0.12] bg-black/40 transition-all hover:border-cyan-400/50 hover:bg-black/60"
                onClick={() => document.getElementById('avatar-upload')?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-white/40" />
                    <span className="text-sm text-white/60">Click to upload</span>
                  </div>
                )}
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                />
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">
                Display Name *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full rounded-lg border border-white/[0.12] bg-black/40 px-4 py-3 text-sm text-white transition-all focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                placeholder="Your name"
                style={{ fontSize: '16px' }}
              />
            </div>

            {/* Handle */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">
                Handle *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/40">
                  @
                </span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  required
                  minLength={3}
                  className="w-full rounded-lg border border-white/[0.12] bg-black/40 px-4 py-3 pl-8 text-sm text-white transition-all focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                  placeholder="yourhandle"
                  style={{ fontSize: '16px' }}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {handleChecking && <Loader2 className="h-4 w-4 animate-spin text-white/40" />}
                  {!handleChecking && handleAvailable === true && (
                    <Check className="h-4 w-4 text-onboarding-teal" />
                  )}
                  {!handleChecking && handleAvailable === false && (
                    <X className="h-4 w-4 text-red-400" />
                  )}
                </div>
              </div>
              {handleAvailable === false && (
                <p className="mt-1 text-xs text-red-400">Handle is already taken</p>
              )}
              {handleAvailable === true && (
                <p className="mt-1 text-xs text-cyan-400">Handle is available</p>
              )}
            </div>

            {/* Banner (optional) */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">
                Banner <span className="opacity-50">(Optional)</span>
              </label>
              <div
                className="group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-white/[0.12] bg-black/40 transition-all hover:border-cyan-400/50 hover:bg-black/60"
                onClick={() => document.getElementById('banner-upload')?.click()}
              >
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Banner preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-white/40" />
                    <span className="text-sm text-white/60">Click to upload</span>
                  </div>
                )}
                <input
                  id="banner-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleBannerUpload(e.target.files[0])}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="w-full rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ minHeight: '52px' }}
            >
              {loading ? 'Saving...' : 'Save & Continue →'}
            </button>
          </form>
        </div>

        {/* Right: Live Preview */}
        <div className="hidden md:block">
          <div className="sticky top-8">
            <p className="mb-4 text-xs uppercase tracking-wider text-white/40">
              Your marketplace card
            </p>
            <motion.div
              layout
              className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03]"
            >
              {/* Banner */}
              <motion.div layout className="relative h-32 bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
                {bannerUrl && (
                  <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
                )}
              </motion.div>

              {/* Avatar overlapping banner */}
              <div className="relative px-6 pb-6">
                <motion.div layout className="-mt-12 mb-4">
                  <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-[#070708] bg-black">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-cyan-500/10">
                        <span className="text-2xl text-cyan-400/40">?</span>
                      </div>
                    )}
                  </div>
                </motion.div>

                <motion.h3 layout className="mb-1 text-lg font-semibold text-white">
                  {displayName || 'Your Name'}
                </motion.h3>
                <motion.p layout className="text-sm text-white/50">
                  @{handle || 'yourhandle'}
                </motion.p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Mobile preview toggle */}
        <div className="md:hidden">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full rounded-lg border border-white/[0.12] bg-black/40 px-4 py-3 text-sm font-medium text-white/70"
          >
            {showPreview ? 'Hide' : 'Preview your profile'}
          </button>

          <AnimatePresence>
            {showPreview && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 overflow-hidden"
              >
                <motion.div
                  layout
                  className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03]"
                >
                  <motion.div layout className="relative h-32 bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
                    {bannerUrl && (
                      <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
                    )}
                  </motion.div>

                  <div className="relative px-6 pb-6">
                    <motion.div layout className="-mt-12 mb-4">
                      <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-[#070708] bg-black">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-cyan-500/10">
                            <span className="text-2xl text-cyan-400/40">?</span>
                          </div>
                        )}
                      </div>
                    </motion.div>

                    <motion.h3 layout className="mb-1 text-lg font-semibold text-white">
                      {displayName || 'Your Name'}
                    </motion.h3>
                    <motion.p layout className="text-sm text-white/50">
                      @{handle || 'yourhandle'}
                    </motion.p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
