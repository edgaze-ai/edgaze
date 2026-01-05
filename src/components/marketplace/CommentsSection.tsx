"use client";

import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Pin,
  PinOff,
  Crown,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useAuth } from "../auth/AuthContext";

type CommentRow = {
  id: string;
  created_at: string;
  prompt_id: string;
  user_id: string | null;
  user_name: string | null;
  user_handle: string | null;
  user_avatar_url: string | null;
  parent_id: string | null;
  content: string;
  like_count: number | null;
  dislike_count: number | null;
  is_pinned: boolean | null;
  creator_liked: boolean | null;
};

type CommentNode = CommentRow & { children: CommentNode[] };

type CommentsSectionProps = {
  listingId: string; // prompt_id (or uuid / edgaze_code depending on caller)
  listingOwnerId: string | null; // profiles.id of creator/owner
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min > 1 ? "s" : ""} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? "s" : ""} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day > 1 ? "s" : ""} ago`;
  const week = Math.floor(day / 7);
  if (week < 4) return `${week} week${week > 1 ? "s" : ""} ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} month${month > 1 ? "s" : ""} ago`;
  const year = Math.floor(day / 365);
  return `${year} year${year > 1 ? "s" : ""} ago`;
}

function buildCommentTree(rows: CommentRow[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  rows.forEach((row) => map.set(row.id, { ...row, children: [] }));

  rows.forEach((row) => {
    const node = map.get(row.id)!;
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // pinned first, then newest
  const sortFn = (a: CommentNode, b: CommentNode) => {
    const aPinned = a.is_pinned ? 1 : 0;
    const bPinned = b.is_pinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  };

  const sortTree = (nodes: CommentNode[]) => {
    nodes.sort(sortFn);
    nodes.forEach((n) => sortTree(n.children));
  };

  sortTree(roots);
  return roots;
}

type CommentItemProps = {
  comment: CommentNode;
  depth: number;
  isCreator: boolean;
  creatorAvatarUrl: string | null;

  onReply: (parentId: string, content: string) => Promise<void>;
  onReact: (id: string, type: "like" | "dislike") => Promise<void>;
  onTogglePin: (id: string, shouldPin: boolean) => Promise<void>;
  onToggleCreatorLike: (id: string, next: boolean) => Promise<void>;
};

function CommentItem({
  comment,
  depth,
  isCreator,
  creatorAvatarUrl,
  onReply,
  onReact,
  onTogglePin,
  onToggleCreatorLike,
}: CommentItemProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReplySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onReply(comment.id, replyText.trim());
      setReplyText("");
      setReplyOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const initials = (comment.user_name || comment.user_handle || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const leftGutter = depth === 0 ? 0 : Math.min(depth, 6) * 22;

  return (
    <div className="relative">
      {/* L-shaped reply connectors */}
      {depth > 0 && (
        <>
          <div
            className="absolute top-0 bottom-0 w-px bg-white/10"
            style={{ left: leftGutter - 12 }}
          />
          <div
            className="absolute top-5 h-px bg-white/10"
            style={{ left: leftGutter - 12, width: 16 }}
          />
        </>
      )}

      <div
        className="flex gap-3 py-3"
        style={{ paddingLeft: depth === 0 ? 0 : leftGutter }}
      >
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8 text-[11px] font-semibold text-white/85 ring-1 ring-white/10">
          {comment.user_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={comment.user_avatar_url}
              alt={comment.user_name || "User avatar"}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-semibold text-white">
              {comment.user_name || comment.user_handle || "Anonymous"}
            </span>

            {comment.user_handle && (
              <span className="text-[12px] text-white/45">
                @{comment.user_handle}
              </span>
            )}

            <span className="text-[12px] text-white/40">
              · {timeAgo(comment.created_at)}
            </span>

            {comment.is_pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-[2px] text-[11px] font-semibold text-cyan-200 ring-1 ring-cyan-400/20">
                <Pin className="h-3 w-3" />
                Pinned
              </span>
            )}

            {comment.creator_liked && creatorAvatarUrl && (
              <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/12 px-2 py-[2px] text-[11px] text-pink-200 ring-1 ring-pink-400/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={creatorAvatarUrl}
                  alt="Creator"
                  className="h-3.5 w-3.5 rounded-full object-cover"
                />
                Creator liked
              </span>
            )}
          </div>

          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-white/85">
            {comment.content}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-white/55">
            <button
              type="button"
              onClick={() => onReact(comment.id, "like")}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-white/5 hover:text-cyan-200"
            >
              <ThumbsUp className="h-4 w-4" />
              <span className="tabular-nums">{comment.like_count ?? 0}</span>
            </button>

            <button
              type="button"
              onClick={() => onReact(comment.id, "dislike")}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-white/5 hover:text-pink-200"
            >
              <ThumbsDown className="h-4 w-4" />
              <span className="tabular-nums">{comment.dislike_count ?? 0}</span>
            </button>

            <button
              type="button"
              onClick={() => setReplyOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-white/5 hover:text-white/80"
            >
              <MessageCircle className="h-4 w-4" />
              Reply
            </button>

            {isCreator && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onTogglePin(comment.id, !Boolean(comment.is_pinned))
                  }
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-white/5 hover:text-white/80"
                >
                  {comment.is_pinned ? (
                    <>
                      <PinOff className="h-4 w-4" />
                      Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="h-4 w-4" />
                      Pin
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onToggleCreatorLike(
                      comment.id,
                      !Boolean(comment.creator_liked)
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1",
                    comment.creator_liked
                      ? "bg-gradient-to-r from-cyan-400 to-pink-500 text-black"
                      : "hover:bg-white/5 hover:text-white/80"
                  )}
                >
                  <Crown className="h-4 w-4" />
                  {comment.creator_liked ? "Top" : "Mark top"}
                </button>
              </>
            )}
          </div>

          {replyOpen && (
            <form onSubmit={handleReplySubmit} className="mt-3">
              <div className="rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Add a reply…"
                  className="h-16 w-full resize-none bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReplyOpen(false)}
                    className="rounded-full px-3 py-1.5 text-[12px] text-white/55 hover:bg-white/5 hover:text-white/75"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !replyText.trim()}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12px] font-semibold text-black",
                      "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500",
                      "shadow-[0_0_18px_rgba(56,189,248,0.35)]",
                      (submitting || !replyText.trim()) &&
                        "cursor-not-allowed opacity-70"
                    )}
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Posting…
                      </span>
                    ) : (
                      "Reply"
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {comment.children.length > 0 && (
            <div className="mt-1">
              {comment.children.map((child) => (
                <CommentItem
                  key={child.id}
                  comment={child}
                  depth={depth + 1}
                  isCreator={isCreator}
                  creatorAvatarUrl={creatorAvatarUrl}
                  onReply={onReply}
                  onReact={onReact}
                  onTogglePin={onTogglePin}
                  onToggleCreatorLike={onToggleCreatorLike}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommentsSection({
  listingId,
  listingOwnerId,
}: CommentsSectionProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { userId, profile, requireAuth } = useAuth();

  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [creatorAvatarUrl, setCreatorAvatarUrl] = useState<string | null>(null);

  // IMPORTANT: prompt_comments.prompt_id must match the FK target in prompts.
  // Callers may pass prompts.id OR prompts.uuid OR prompts.edgaze_code.
  // We resolve to prompts.id and use that everywhere.
  const [promptIdForComments, setPromptIdForComments] = useState<string>(listingId);

  const [toast, setToast] = useState<null | { title: string; detail?: string }>(
    null
  );

  const isCreator = !!userId && !!listingOwnerId && userId === listingOwnerId;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!listingOwnerId) {
        setCreatorAvatarUrl(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", listingOwnerId)
        .maybeSingle();

      if (!cancelled) setCreatorAvatarUrl((data as any)?.avatar_url ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [listingOwnerId, supabase]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Default: assume caller already passed the correct FK id
      let resolved = listingId;

      // 1) Does prompts.id == listingId?
      const byId = await supabase
        .from("prompts")
        .select("id")
        .eq("id", listingId)
        .maybeSingle();

      if (byId.data?.id != null) {
        resolved = String(byId.data.id);
      } else {
        // 2) Does prompts.uuid == listingId?
        const byUuid = await supabase
          .from("prompts")
          .select("id")
          .eq("uuid", listingId)
          .maybeSingle();

        if (byUuid.data?.id != null) {
          resolved = String(byUuid.data.id);
        } else {
          // 3) Does prompts.edgaze_code == listingId?
          const byCode = await supabase
            .from("prompts")
            .select("id")
            .eq("edgaze_code", listingId)
            .maybeSingle();

          if (byCode.data?.id != null) {
            resolved = String(byCode.data.id);
          }
        }
      }

      if (!cancelled) setPromptIdForComments(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, [listingId, supabase]);

  const loadComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prompt_comments")
      .select(
        [
          "id",
          "created_at",
          "prompt_id",
          "user_id",
          "user_name",
          "user_handle",
          "user_avatar_url",
          "parent_id",
          "content",
          "like_count",
          "dislike_count",
          "is_pinned",
          "creator_liked",
        ].join(",")
      )
      .eq("prompt_id", promptIdForComments)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading comments", error);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as CommentRow[]);
    setLoading(false);
  }, [promptIdForComments, supabase]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const tree = useMemo(() => buildCommentTree(rows), [rows]);

  const handleAddComment = async (parentId: string | null, content: string) => {
    if (!content.trim()) return;
    if (!requireAuth()) return;
    if (!userId) return;

    const name =
      profile?.full_name?.trim() || profile?.handle?.trim() || "Creator";
    const handle = profile?.handle?.trim() || null;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("prompt_comments")
        .insert({
          prompt_id: promptIdForComments,
          user_id: userId,
          user_name: name,
          user_handle: handle,
          user_avatar_url: profile?.avatar_url ?? null,
          parent_id: parentId,
          content: content.trim(),
        })
        .select(
          [
            "id",
            "created_at",
            "prompt_id",
            "user_id",
            "user_name",
            "user_handle",
            "user_avatar_url",
            "parent_id",
            "content",
            "like_count",
            "dislike_count",
            "is_pinned",
            "creator_liked",
          ].join(",")
        )
        .single();

      if (error) {
        console.error("Error adding comment", error);
        setToast({ title: "Failed to post comment", detail: error.message });
        return;
      }

      if (data) setRows((prev) => [...prev, data as CommentRow]);
      if (!parentId) setNewContent("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTopLevelSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await handleAddComment(null, newContent);
  };

  const handleReact = async (commentId: string, type: "like" | "dislike") => {
    if (!requireAuth()) return;

    const { data, error } = await supabase.rpc("toggle_prompt_comment_reaction", {
      p_comment_id: commentId,
      p_reaction: type,
    });

    if (error) {
      const payload = {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      };
      // This will actually print (not just show line highlight)
      console.error("Reaction RPC failed:", payload);
      console.error("Reaction RPC failed (string):", JSON.stringify(payload));

      setToast({
        title: "Like/Dislike failed",
        detail: payload.message || "Unknown error",
      });
      return;
    }

    // returns table(...) => array with 1 row
    const row = Array.isArray(data) ? data[0] : data;
    const nextLike = row?.like_count;
    const nextDislike = row?.dislike_count;

    if (typeof nextLike === "number" || typeof nextDislike === "number") {
      setRows((prev) =>
        prev.map((r) =>
          r.id === commentId
            ? ({
                ...r,
                like_count:
                  typeof nextLike === "number" ? nextLike : r.like_count,
                dislike_count:
                  typeof nextDislike === "number"
                    ? nextDislike
                    : r.dislike_count,
              } as CommentRow)
            : r
        )
      );
      return;
    }

    // fallback if Supabase returns weird shape
    loadComments();
  };

  const handleTogglePin = async (id: string, shouldPin: boolean) => {
    if (!isCreator) return;

    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? ({ ...r, is_pinned: shouldPin } as CommentRow)
          : ({ ...r, is_pinned: shouldPin ? false : r.is_pinned } as CommentRow)
      )
    );

    if (shouldPin) {
      const { error: clearError } = await supabase
        .from("prompt_comments")
        .update({ is_pinned: false })
        .eq("prompt_id", promptIdForComments);

      if (clearError) console.error("Error clearing existing pins", clearError);
    }

    const { error } = await supabase
      .from("prompt_comments")
      .update({ is_pinned: shouldPin })
      .eq("id", id);

    if (error) {
      console.error("Error updating pin", error);
      setToast({ title: "Pin failed", detail: error.message });
      loadComments();
    }
  };

  const handleToggleCreatorLike = async (id: string, next: boolean) => {
    if (!isCreator) return;

    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? ({ ...r, creator_liked: next } as CommentRow) : r
      )
    );

    const { error } = await supabase
      .from("prompt_comments")
      .update({ creator_liked: next })
      .eq("id", id);

    if (error) {
      console.error("Error updating creator like", error);
      setToast({ title: "Creator like failed", detail: error.message });
      loadComments();
    }
  };

  return (
    <section className="mt-8">
      {/* Tiny toast so you SEE the error immediately */}
      {toast && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl bg-red-500/10 p-3 text-[12px] text-red-200 ring-1 ring-red-400/20">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">{toast.title}</div>
              {toast.detail ? (
                <div className="mt-0.5 text-red-200/80">{toast.detail}</div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-full p-1 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-white">Comments</h3>
          <p className="mt-0.5 text-[12px] text-white/50">
            Public thread. Creator can pin and mark top comments.
          </p>
        </div>
      </div>

      <form onSubmit={handleTopLevelSubmit} className="mt-4">
        <div className="rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Add a comment…"
            className="h-20 w-full resize-none bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
          />
          <div className="mt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting || !newContent.trim()}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-semibold text-black",
                "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500",
                "shadow-[0_0_18px_rgba(56,189,248,0.35)]",
                (submitting || !newContent.trim()) &&
                  "cursor-not-allowed opacity-70"
              )}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Posting…
                </span>
              ) : (
                "Comment"
              )}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 text-[12px] text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : tree.length === 0 ? (
          <div className="text-[12px] text-white/55">No comments yet.</div>
        ) : (
          <div className="divide-y divide-white/8">
            {tree.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={0}
                isCreator={isCreator}
                creatorAvatarUrl={creatorAvatarUrl}
                onReply={(parentId, content) => handleAddComment(parentId, content)}
                onReact={handleReact}
                onTogglePin={handleTogglePin}
                onToggleCreatorLike={handleToggleCreatorLike}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
