// src/components/marketplace/WorkflowCommentsSection.tsx
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
  workflow_id: string;
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

function isCommentRow(v: any): v is CommentRow {
  return (
    v &&
    typeof v === "object" &&
    typeof v.id === "string" &&
    typeof v.created_at !== "undefined" &&
    typeof v.workflow_id !== "undefined" &&
    typeof v.user_id !== "undefined" &&
    typeof v.content === "string"
  );
}

function normalizeCommentRows(data: unknown): CommentRow[] {
  if (!Array.isArray(data)) return [];
  return (data as any[]).filter(isCommentRow);
}

type CommentNode = CommentRow & { children: CommentNode[] };

type WorkflowCommentsSectionProps = {
  listingId: string; // workflow_id (uuid)
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

  // pinned first, then time
  roots.sort((a, b) => {
    const ap = a.is_pinned ? 1 : 0;
    const bp = b.is_pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return roots;
}

function initialsFromName(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

function Avatar({
  name,
  avatarUrl,
  size = 28,
}: {
  name: string | null | undefined;
  avatarUrl: string | null | undefined;
  size?: number;
}) {
  const initials = initialsFromName(name);
  return (
    <div
      className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] grid place-items-center overflow-hidden"
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name || "User"}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-[11px] font-semibold text-white/75">
          {initials}
        </span>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  depth,
  isCreator,
  creatorAvatarUrl,
  onReply,
  onReact,
  onTogglePin,
  onToggleCreatorLike,
}: {
  comment: CommentNode;
  depth: number;
  isCreator: boolean;
  creatorAvatarUrl: string | null;
  onReply: (parentId: string, content: string) => Promise<void>;
  onReact: (commentId: string, type: "like" | "dislike") => Promise<void>;
  onTogglePin: (id: string, shouldPin: boolean) => Promise<void>;
  onToggleCreatorLike: (id: string, next: boolean) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");

  const padLeft = Math.min(depth, 4) * 14;

  const authorLabel =
    comment.user_handle?.trim()
      ? `@${comment.user_handle.trim()}`
      : comment.user_name?.trim() || "User";

  const canShowCreatorBadges = isCreator;

  return (
    <div className="py-4">
      <div className="flex gap-3" style={{ paddingLeft: padLeft }}>
        <Avatar name={comment.user_name} avatarUrl={comment.user_avatar_url} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="truncate text-[12px] font-semibold text-white/85">
                  {authorLabel}
                </div>
                <div className="text-[11px] text-white/40">
                  {timeAgo(comment.created_at)}
                </div>

                {comment.is_pinned ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/70">
                    <Pin className="h-3 w-3" />
                    Pinned
                  </span>
                ) : null}

                {comment.creator_liked ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/70">
                    <Crown className="h-3 w-3" />
                    Creator liked
                  </span>
                ) : null}
              </div>
            </div>

            {canShowCreatorBadges ? (
              <div className="shrink-0 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onTogglePin(comment.id, !comment.is_pinned)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10"
                >
                  {comment.is_pinned ? (
                    <>
                      <PinOff className="h-3.5 w-3.5" />
                      Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="h-3.5 w-3.5" />
                      Pin
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onToggleCreatorLike(comment.id, !comment.creator_liked)
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10"
                >
                  <Crown className="h-3.5 w-3.5" />
                  {comment.creator_liked ? "Unmark" : "Top"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-1 text-[13px] leading-relaxed text-white/80 whitespace-pre-wrap">
            {comment.content}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onReact(comment.id, "like")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/75 hover:bg-white/[0.06]"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              {comment.like_count ?? 0}
            </button>

            <button
              type="button"
              onClick={() => onReact(comment.id, "dislike")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/75 hover:bg-white/[0.06]"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              {comment.dislike_count ?? 0}
            </button>

            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/75 hover:bg-white/[0.06]"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Reply
            </button>
          </div>

          {replying ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const text = replyText.trim();
                if (!text) return;
                await onReply(comment.id, text);
                setReplyText("");
                setReplying(false);
              }}
              className="mt-3"
            >
              <div className="rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply…"
                  className="h-18 w-full resize-none bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReplying(false);
                      setReplyText("");
                    }}
                    className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/80 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12px] font-semibold text-black",
                      "bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500",
                      "shadow-[0_0_18px_rgba(56,189,248,0.35)]",
                      !replyText.trim() && "cursor-not-allowed opacity-70"
                    )}
                  >
                    Reply
                  </button>
                </div>
              </div>
            </form>
          ) : null}

          {comment.children.length > 0 ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function WorkflowCommentsSection({
  listingId,
  listingOwnerId,
}: WorkflowCommentsSectionProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { userId, profile, requireAuth } = useAuth();

  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [creatorAvatarUrl, setCreatorAvatarUrl] = useState<string | null>(null);

  const [workflowIdForComments] = useState<string>(listingId);

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

  const loadComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("workflow_comments")
      .select(
        [
          "id",
          "created_at",
          "workflow_id",
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
      .eq("workflow_id", workflowIdForComments)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading workflow comments", error);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(normalizeCommentRows(data));
    setLoading(false);
  }, [workflowIdForComments, supabase]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const tree = useMemo(() => buildCommentTree(rows), [rows]);

  const handleAddComment = async (parentId: string | null, content: string) => {
    if (!content.trim()) return;
    if (!requireAuth()) return;
    if (!userId) return;

    const name =
      (profile as any)?.full_name?.trim() ||
      (profile as any)?.handle?.trim() ||
      "Creator";
    const handle = (profile as any)?.handle?.trim() || null;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("workflow_comments")
        .insert({
          workflow_id: workflowIdForComments,
          user_id: String(userId), // workflow_comments.user_id is text
          user_name: name,
          user_handle: handle,
          user_avatar_url: (profile as any)?.avatar_url ?? null,
          parent_id: parentId,
          content: content.trim(),
        })
        .select(
          [
            "id",
            "created_at",
            "workflow_id",
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
        console.error("Error adding workflow comment", error);
        setToast({ title: "Failed to post comment", detail: error.message });
        return;
      }

      if (data && isCommentRow(data)) {
        setRows((prev) => [...prev, data]);
      } else if (data) {
        loadComments();
      }

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

    const { data, error } = await supabase.rpc(
      "toggle_workflow_comment_reaction",
      {
        p_comment_id: commentId,
        p_reaction: type,
      }
    );

    if (error) {
      const payload = {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      };
      console.error("Reaction RPC failed:", payload);
      console.error("Reaction RPC failed (string):", JSON.stringify(payload));

      setToast({
        title: "Like/Dislike failed",
        detail: payload.message || "Unknown error",
      });
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const nextLike = row?.like_count;
    const nextDislike = row?.dislike_count;

    if (typeof nextLike === "number" || typeof nextDislike === "number") {
      setRows((prev) =>
        prev.map((r) =>
          r.id === commentId
            ? ({
                ...r,
                like_count: typeof nextLike === "number" ? nextLike : r.like_count,
                dislike_count:
                  typeof nextDislike === "number" ? nextDislike : r.dislike_count,
              } as CommentRow)
            : r
        )
      );
      return;
    }

    loadComments();
  };

  const handleTogglePin = async (id: string, shouldPin: boolean) => {
    if (!isCreator) return;
  
    // optimistic UI
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? ({ ...r, is_pinned: shouldPin } as CommentRow)
          : ({ ...r, is_pinned: shouldPin ? false : r.is_pinned } as CommentRow)
      )
    );
  
    // Clear existing pins first (only if pinning)
    if (shouldPin) {
      const { error: clearError } = await supabase
        .from("workflow_comments")
        .update({ is_pinned: false })
        .eq("workflow_id", workflowIdForComments)
        .eq("is_pinned", true);
  
      if (clearError) {
        const payload = {
          message: clearError.message,
          details: (clearError as any).details,
          hint: (clearError as any).hint,
          code: (clearError as any).code,
        };
        console.error("Error clearing workflow pins:", payload);
        console.error("Error clearing workflow pins (string):", JSON.stringify(payload));
  
        setToast({ title: "Pin failed", detail: payload.message || "RLS denied" });
        loadComments();
        return;
      }
    }
  
    // Now apply the pin/unpin
    const { error } = await supabase
      .from("workflow_comments")
      .update({ is_pinned: shouldPin })
      .eq("id", id);
  
    if (error) {
      const payload = {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      };
      console.error("Error updating workflow pin:", payload);
      console.error("Error updating workflow pin (string):", JSON.stringify(payload));
  
      setToast({ title: "Pin failed", detail: payload.message || "RLS denied" });
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
      .from("workflow_comments")
      .update({ creator_liked: next })
      .eq("id", id);

    if (error) {
      console.error("Error updating workflow creator like", error);
      setToast({ title: "Creator like failed", detail: error.message });
      loadComments();
    }
  };

  return (
    <section className="mt-8">
      {toast ? (
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
      ) : null}

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
