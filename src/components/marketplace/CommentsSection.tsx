"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  FormEvent,
} from "react";
import {
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Pin,
  PinOff,
  Crown,
  Loader2,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";

/**
 * Expected Supabase table: prompt_comments
 *
 * Columns (names must match):
 *  - id: uuid (PK)
 *  - created_at: timestamptz
 *  - prompt_id: uuid (FK -> prompts.id)
 *  - user_id: text or uuid
 *  - user_name: text
 *  - user_handle: text
 *  - user_avatar_url: text
 *  - parent_id: uuid (nullable, for replies)
 *  - content: text
 *  - like_count: bigint/int8 (default 0)
 *  - dislike_count: bigint/int8 (default 0)
 *  - is_pinned: boolean (default false)
 *  - creator_liked: boolean (default false)
 */

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

type CommentNode = CommentRow & {
  children: CommentNode[];
};

type CommentsSectionProps = {
  listingId: string;
  listingOwnerId: string | null;
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

  rows.forEach((row) => {
    map.set(row.id, { ...row, children: [] });
  });

  rows.forEach((row) => {
    const node = map.get(row.id)!;
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // pinned first, then newest first within level
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

  const indentClass = depth > 0 ? `pl-${Math.min(depth, 4) * 4}` : "";

  return (
    <div className={cn("mt-3", depth > 0 && "border-l border-white/10 ml-4")}>
      <div
        className={cn(
          "rounded-2xl bg-white/[0.02] px-4 py-3",
          "border border-white/10",
          comment.is_pinned && "border-cyan-400/80 bg-cyan-400/5"
        )}
      >
        <div className={cn("flex items-start gap-3", indentClass)}>
          {/* Avatar */}
          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
            {comment.user_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={comment.user_avatar_url}
                alt={comment.user_name || "User avatar"}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span>
                {(comment.user_name || comment.user_handle || "U")
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1">
            {/* Header */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">
                {comment.user_name || comment.user_handle || "Anonymous"}
              </span>
              {comment.user_handle && (
                <span className="text-[11px] text-white/45">
                  @{comment.user_handle}
                </span>
              )}
              <span className="text-[11px] text-white/40">
                · {timeAgo(comment.created_at)}
              </span>
              {comment.is_pinned && (
                <span className="ml-2 rounded-full bg-cyan-500/20 px-2 py-[2px] text-[10px] font-semibold text-cyan-200">
                  Pinned by creator
                </span>
              )}
              {comment.creator_liked && creatorAvatarUrl && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-pink-500/15 px-2 py-[2px] text-[10px] text-pink-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={creatorAvatarUrl}
                    alt="Creator"
                    className="h-3.5 w-3.5 rounded-full object-cover"
                  />
                  <span>Creator liked</span>
                </span>
              )}
            </div>

            {/* Content */}
            <p className="mt-1 text-sm text-white/85">{comment.content}</p>

            {/* Actions */}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/55">
              <button
                type="button"
                onClick={() => onReact(comment.id, "like")}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-[3px] hover:border-cyan-400 hover:text-cyan-200"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>{comment.like_count ?? 0}</span>
              </button>
              <button
                type="button"
                onClick={() => onReact(comment.id, "dislike")}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-[3px] hover:border-pink-400 hover:text-pink-200"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                <span>{comment.dislike_count ?? 0}</span>
              </button>

              <button
                type="button"
                onClick={() => setReplyOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-white/65 hover:bg-white/5"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Reply</span>
              </button>

              {isCreator && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onTogglePin(comment.id, !Boolean(comment.is_pinned))
                    }
                    className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-white/65 hover:bg-white/5"
                  >
                    {comment.is_pinned ? (
                      <>
                        <PinOff className="h-3.5 w-3.5" />
                        <span>Unpin</span>
                      </>
                    ) : (
                      <>
                        <Pin className="h-3.5 w-3.5" />
                        <span>Pin</span>
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
                      "inline-flex items-center gap-1 rounded-full px-2 py-[3px]",
                      comment.creator_liked
                        ? "bg-gradient-to-r from-cyan-400 to-pink-500 text-black"
                        : "text-white/65 hover:bg-white/5"
                    )}
                  >
                    <Crown className="h-3.5 w-3.5" />
                    <span>
                      {comment.creator_liked ? "Creator liked" : "Mark as top"}
                    </span>
                  </button>
                </>
              )}
            </div>

            {/* Reply box */}
            {replyOpen && (
              <form onSubmit={handleReplySubmit} className="mt-3">
                <div className="rounded-2xl border border-white/15 bg-black/60 px-3 py-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply…"
                    className="h-16 w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setReplyOpen(false)}
                      className="text-xs text-white/45 hover:text-white/70"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !replyText.trim()}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-3 py-1.5 text-xs font-semibold text-black shadow-[0_0_18px_rgba(56,189,248,0.7)]",
                        (submitting || !replyText.trim()) &&
                          "opacity-70 cursor-not-allowed"
                      )}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Posting…</span>
                        </>
                      ) : (
                        <>
                          <span>Post reply</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {comment.children.length > 0 && (
        <div className="mt-1 space-y-1">
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
  );
}

export default function CommentsSection({
  listingId,
  listingOwnerId,
}: CommentsSectionProps) {
  const { user, requireAuth } = useAuth();

  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newContent, setNewContent] = useState("");

  const isCreator =
    !!user?.id && !!listingOwnerId && user.id === listingOwnerId;

  const creatorAvatarUrl =
    (user && isCreator && (user as any).image) || null;

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
      .eq("prompt_id", listingId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading comments", error);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as CommentRow[]);
    setLoading(false);
  }, [listingId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const tree = useMemo(() => buildCommentTree(rows), [rows]);

  const handleAddComment = async (
    parentId: string | null,
    content: string
  ): Promise<void> => {
    if (!content.trim()) return;
    if (!requireAuth()) return;
    if (!user) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("prompt_comments")
        .insert({
          prompt_id: listingId,
          user_id: user.id,
          user_name: (user as any).name ?? null,
          user_handle: (user as any).handle ?? null,
          user_avatar_url: (user as any).image ?? null,
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
        return;
      }

      if (data) {
        setRows((prev) => [...prev, data as CommentRow]);
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

  const handleReact = async (
    id: string,
    type: "like" | "dislike"
  ): Promise<void> => {
    if (!requireAuth()) return;

    const field: keyof Pick<CommentRow, "like_count" | "dislike_count"> =
      type === "like" ? "like_count" : "dislike_count";

    const target = rows.find((r) => r.id === id);
    if (!target) return;

    const newCount = (target[field] ?? 0) + 1;

    // optimistic update
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? ({ ...r, [field]: newCount } as CommentRow)
          : r
      )
    );

    const { error } = await supabase
      .from("prompt_comments")
      .update({ [field]: newCount })
      .eq("id", id);

    if (error) {
      console.error("Error updating reaction", error);
      // reload to avoid desync
      loadComments();
    }
  };

  const handleTogglePin = async (
    id: string,
    shouldPin: boolean
  ): Promise<void> => {
    if (!isCreator) return;

    // optimistic – only one pinned at a time
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
        .eq("prompt_id", listingId);
      if (clearError) {
        console.error("Error clearing existing pins", clearError);
      }
    }

    const { error } = await supabase
      .from("prompt_comments")
      .update({ is_pinned: shouldPin })
      .eq("id", id);

    if (error) {
      console.error("Error updating pin", error);
      loadComments();
    }
  };

  const handleToggleCreatorLike = async (
    id: string,
    next: boolean
  ): Promise<void> => {
    if (!isCreator) return;

    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? ({ ...r, creator_liked: next } as CommentRow)
          : r
      )
    );

    const { error } = await supabase
      .from("prompt_comments")
      .update({ creator_liked: next })
      .eq("id", id);

    if (error) {
      console.error("Error updating creator like", error);
      loadComments();
    }
  };

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-black/40 px-6 py-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Comments</h3>
          <p className="text-xs text-white/55">
            Share feedback or questions. The creator can pin a top comment and
            highlight their favourite response.
          </p>
        </div>
      </div>

      {/* New comment box */}
      <form onSubmit={handleTopLevelSubmit} className="mt-4">
        <div className="rounded-2xl border border-white/15 bg-black/70 px-3 py-2">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write a comment…"
            className="h-20 w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-white/45">
              Be constructive. This thread is visible to everyone who views this
              listing.
            </span>
            <button
              type="submit"
              disabled={submitting || !newContent.trim()}
              className={cn(
                "inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-3 py-1.5 text-xs font-semibold text-black shadow-[0_0_18px_rgba(56,189,248,0.7)]",
                (submitting || !newContent.trim()) &&
                  "opacity-70 cursor-not-allowed"
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Posting…</span>
                </>
              ) : (
                <>
                  <MessageCircle className="h-3 w-3" />
                  <span>Post comment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Comments list */}
      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading comments…</span>
          </div>
        ) : tree.length === 0 ? (
          <div className="text-xs text-white/55">
            No comments yet. Be the first to share feedback on this listing.
          </div>
        ) : (
          <div className="space-y-2">
            {tree.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={0}
                isCreator={isCreator}
                creatorAvatarUrl={creatorAvatarUrl}
                onReply={(parentId, content) =>
                  handleAddComment(parentId, content)
                }
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
