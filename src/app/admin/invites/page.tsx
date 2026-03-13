'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, X, AlertCircle, Upload, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthContext';

interface Invite {
  id: string;
  token_hash: string;
  raw_token: string;
  creator_name: string;
  creator_photo_url: string;
  custom_message: string;
  status: 'active' | 'claimed' | 'completed' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
  claimed_at?: string;
  completed_at?: string;
}

const cardClass = "rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]";
const inputClass = "w-full rounded-lg border border-white/[0.12] bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50";

export default function AdminInvitesPage() {
  const { authReady, getAccessToken } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ url: string; id: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  // Form state
  const [creatorName, setCreatorName] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [expiresInDays, setExpiresInDays] = useState(14);

  // Enable scrolling like other admin pages
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    main.style.overflowY = 'auto';
    main.style.overflowX = 'hidden';
    return () => {
      main.style.overflowY = '';
      main.style.overflowX = '';
    };
  }, []);

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/invites', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }
      
      const data = await res.json();
      setInvites(data.invites || []);
    } catch (err: any) {
      console.error('Failed to fetch invites:', err);
      setError(`Failed to load invites: ${err.message}`);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!authReady) return;
    fetchInvites();
  }, [authReady, fetchInvites]);

  const compressImage = async (file: File, maxSizeMB: number = 2): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const maxDimension = 1200;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              
              if (blob.size > maxSizeMB * 1024 * 1024) {
                canvas.toBlob(
                  (smallerBlob) => {
                    if (!smallerBlob) {
                      reject(new Error('Failed to compress image'));
                      return;
                    }
                    resolve(new File([smallerBlob], file.name, { type: 'image/jpeg' }));
                  },
                  'image/jpeg',
                  0.7
                );
              } else {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              }
            },
            'image/jpeg',
            0.85
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      setPhotoFile(compressed);
      const preview = URL.createObjectURL(compressed);
      setPhotoPreview(preview);
    } catch (err: any) {
      setError(`Failed to process image: ${err.message}`);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) {
      setError('Please upload a photo');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const token = await getAccessToken();
      
      // Upload photo to Supabase Storage
      const photoPath = `${Date.now()}-${photoFile.name}`;
      const formData = new FormData();
      formData.append('file', photoFile);
      formData.append('path', photoPath);
      
      const uploadRes = await fetch('/api/storage/upload', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload photo');
      }

      const { url: photoUrl } = await uploadRes.json();

      // Create invite
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          creator_name: creatorName,
          creator_photo_url: photoUrl,
          custom_message: customMessage,
          expires_in_days: expiresInDays,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create invite');
      }

      const data = await res.json();
      
      setSuccess({
        url: `${window.location.origin}${data.url}`,
        id: data.invite.id,
      });
      
      // Reset form
      setCreatorName('');
      setCustomMessage('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setExpiresInDays(14);
      setShowForm(false);
      
      // Refresh list
      await fetchInvites();
    } catch (err: any) {
      console.error('Failed to create invite:', err);
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/invites/${id}/revoke`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error('Failed to revoke invite');
      }

      setRevokeConfirm(null);
      await fetchInvites();
    } catch (err: any) {
      console.error('Failed to revoke:', err);
      setError(err.message);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusPill = (status: string) => {
    const colors = {
      active: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      claimed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      completed: 'bg-green-500/15 text-green-400 border-green-500/30',
      revoked: 'bg-red-500/15 text-red-400 border-red-500/30',
      expired: 'bg-white/10 text-white/40 border-white/20',
    };

    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${colors[status as keyof typeof colors]}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Creator Invites</h1>
          <p className="mt-1 text-sm text-white/50">Manage personalized onboarding invites</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-cyan-400"
        >
          {showForm ? 'Cancel' : 'Create Invite'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-400 mb-1">Error</h3>
              <p className="text-xs text-red-300 whitespace-pre-wrap">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-3 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-all hover:bg-red-500/30"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className={`${cardClass} overflow-hidden p-6`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15">
              <Copy className="h-5 w-5 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Invite Created!</h3>
          </div>
          <p className="mb-4 text-sm text-white/60">
            Copy the link from the table below and send it to the creator.
          </p>
          <div className="flex gap-3">
            <Link
              href={`/admin/invites/${success.id}/preview`}
              className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-center text-sm font-medium text-white/70 transition-all hover:bg-white/[0.06]"
            >
              Preview
            </Link>
            <button
              onClick={() => setSuccess(null)}
              className="ml-auto rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-all hover:bg-white/[0.06]"
            >
              Send Another
            </button>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className={`${cardClass} p-6`}>
          <h2 className="mb-6 text-xl font-bold text-white">Create New Invite</h2>

          <form onSubmit={handleCreateInvite} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">
                Creator Name *
              </label>
              <input
                type="text"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                required
                className={inputClass}
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">
                Profile Photo * <span className="text-xs text-white/40">(max 5MB, auto-compressed)</span>
              </label>
              <div
                className="group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-white/[0.12] bg-black/40 transition-all hover:border-cyan-400/50 hover:bg-black/60"
                onClick={() => document.getElementById('photo-upload')?.click()}
              >
                {photoPreview ? (
                  <>
                    <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="text-sm text-white">Click to change</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-white/40" />
                    <span className="text-sm text-white/60">Click to upload</span>
                  </div>
                )}
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">
                Custom Message *
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                required
                rows={4}
                className={inputClass}
                placeholder="We're excited to have you join Edgaze as a founding creator..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">
                Expires In (days)
              </label>
              <input
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
                min={1}
                max={90}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-cyan-400 disabled:opacity-50"
            >
              {creating ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create Invite'
              )}
            </button>
          </form>
        </div>
      )}

      {/* Invites Table */}
      <div className={cardClass}>
        <div className="border-b border-white/[0.08] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">All Invites</h2>
              <p className="mt-1 text-xs text-white/40">
                Hover over an active invite to copy its link or revoke it
              </p>
            </div>
            <span className="text-sm font-semibold text-cyan-400">
              {invites.length} in database
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        ) : invites.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-white/40">
              No invites yet. Create one above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                    Creator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/40">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr
                    key={invite.id}
                    className="group border-b border-white/[0.08] transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={invite.creator_photo_url}
                          alt={invite.creator_name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                        <span className="text-sm font-medium text-white">
                          {invite.creator_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">{getStatusPill(invite.status)}</td>
                    <td className="px-6 py-3">
                      <span className="text-sm text-white/60">
                        {new Date(invite.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-sm text-white/60">
                        {new Date(invite.expires_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        {invite.status === 'active' && (
                          <>
                            <button
                              onClick={() => handleCopyLink(`${window.location.origin}/c/${invite.raw_token}`, invite.id)}
                              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70 transition-all hover:bg-white/[0.06]"
                            >
                              {copiedId === invite.id ? 'Copied!' : 'Copy Link'}
                            </button>
                            <button
                              onClick={() => setRevokeConfirm(invite.id)}
                              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/20"
                            >
                              Revoke
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revoke Confirmation Modal */}
      {revokeConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setRevokeConfirm(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-white/[0.08] bg-[#0A0A0B] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Revoke Invite?</h3>
            </div>
            <p className="mb-6 text-sm text-white/60">
              This will permanently deactivate the invite link. The creator will no longer be able to use it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRevokeConfirm(null)}
                className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(revokeConfirm)}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-600"
              >
                Revoke Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
