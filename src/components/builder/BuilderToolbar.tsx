"use client";

import React, { useRef, useEffect } from "react";
import Image from "next/image";
import {
  Home,
  Play,
  Rocket,
  RefreshCw,
  Undo2,
  Redo2,
  Grid3X3,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  LayoutPanelLeft,
  Eye,
  Loader2,
} from "lucide-react";
import { tokens } from "../../styles/tokens";
import { cx } from "../../lib/cx";
import ProfileAvatar from "../ui/ProfileAvatar";
import type { Profile } from "../auth/AuthContext";
import type { RefObject } from "react";

export type CanvasRef = {
  current: {
    zoomIn?: () => void;
    zoomOut?: () => void;
    toggleGrid?: () => void;
    toggleLock?: () => void;
    fullscreen?: () => void;
    getShowGrid?: () => boolean;
    getLocked?: () => boolean;
    getIsFullscreen?: () => boolean;
  } | null;
};

type Props = {
  profile: Profile | null;
  name: string;
  editingName: boolean;
  onNameChange: (v: string) => void;
  onEditingNameChange: (v: boolean) => void;
  stats: { nodes: number; edges: number };
  activeDraftId: string | null;
  undoStack: unknown[];
  redoStack: unknown[];
  showGrid: boolean;
  locked: boolean;
  isFullscreen: boolean;
  windowsBlocksVisible: boolean;
  windowsInspectorVisible: boolean;
  wfLoading: boolean;
  onHome: () => void;
  onRun: () => void;
  onPublish: () => void;
  onRefresh: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleGrid: () => void;
  onToggleLock: () => void;
  onFullscreen: () => void;
  onToggleBlocks: () => void;
  onToggleInspector: () => void;
  canvasRef?: RefObject<CanvasRef["current"]>;
};

export function BuilderToolbar({
  profile,
  name,
  editingName,
  onNameChange,
  onEditingNameChange,
  stats,
  activeDraftId,
  undoStack,
  redoStack,
  showGrid,
  locked,
  isFullscreen,
  windowsBlocksVisible,
  windowsInspectorVisible,
  wfLoading,
  onHome,
  onRun,
  onPublish,
  onRefresh,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onToggleGrid,
  onToggleLock,
  onFullscreen,
  onToggleBlocks,
  onToggleInspector,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onEditingNameChange(false);
    }
    if (e.key === "Escape") {
      onEditingNameChange(false);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-between px-4 gap-4">
      {/* Left: Home + Avatar + Name + Stats */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={onHome}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: tokens.text.tertiary }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = tokens.bg.elevated;
            e.currentTarget.style.color = tokens.text.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = tokens.text.tertiary;
          }}
          title="Home"
        >
          <Home size={18} />
        </button>

        <div className="shrink-0">
          {profile ? (
            <ProfileAvatar
              name={profile.full_name}
              avatarUrl={profile.avatar_url}
              size={28}
              handle={profile.handle}
            />
          ) : (
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 border border-white/10 grid place-items-center">
              <Image
                src="/brand/edgaze-mark.png"
                alt="Edgaze"
                width={18}
                height={18}
              />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onBlur={() => onEditingNameChange(false)}
              onKeyDown={handleKeyDown}
              className="w-full text-[13px] font-medium bg-transparent border-b focus:outline-none py-0.5"
              style={{
                color: tokens.text.primary,
                borderColor: tokens.border.focus,
              }}
            />
          ) : (
            <button
              onClick={() => onEditingNameChange(true)}
              className="text-left w-full truncate text-[13px] font-medium hover:opacity-80 transition-opacity"
              style={{ color: tokens.text.primary }}
            >
              {name || "Untitled Workflow"}
            </button>
          )}
          <div
            className="text-[10px] mt-0.5"
            style={{ color: tokens.text.tertiary }}
          >
            {stats.nodes} nodes · {stats.edges} edges
          </div>
        </div>
      </div>

      {/* Center: Undo / Redo / Grid / Lock / Fullscreen */}
      <div className="hidden md:flex items-center gap-1 shrink-0">
        <button
          onClick={onUndo}
          disabled={undoStack.length === 0}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
          style={{ color: tokens.text.tertiary }}
          title="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={redoStack.length === 0}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
          style={{ color: tokens.text.tertiary }}
          title="Redo"
        >
          <Redo2 size={16} />
        </button>
        <div className="w-px h-5 mx-1" style={{ background: tokens.border.subtle }} />
        <button
          onClick={onToggleGrid}
          className={cx(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
            showGrid && "border"
          )}
          style={{
            color: showGrid ? tokens.text.primary : tokens.text.tertiary,
            background: showGrid ? tokens.bg.elevated : "transparent",
            borderColor: showGrid ? tokens.border.default : "transparent",
          }}
          title="Toggle grid"
        >
          <Grid3X3 size={16} />
        </button>
        <button
          onClick={onToggleLock}
          className={cx(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
            locked && "border"
          )}
          style={{
            color: locked ? tokens.text.primary : tokens.text.tertiary,
            background: locked ? tokens.bg.elevated : "transparent",
            borderColor: locked ? tokens.border.default : "transparent",
          }}
          title={locked ? "Unlock" : "Lock"}
        >
          {locked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>
        <button
          onClick={onFullscreen}
          className={cx(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
            isFullscreen && "border"
          )}
          style={{
            color: isFullscreen ? tokens.text.primary : tokens.text.tertiary,
            background: isFullscreen ? tokens.bg.elevated : "transparent",
            borderColor: isFullscreen ? tokens.border.default : "transparent",
          }}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 size={16} />
          ) : (
            <Maximize2 size={16} />
          )}
        </button>
      </div>

      {/* Right: Blocks / Inspector / Refresh / Run / Publish */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleBlocks}
          className={cx(
            "hidden md:flex w-8 h-8 rounded-lg items-center justify-center transition-colors",
            windowsBlocksVisible && "border"
          )}
          style={{
            color: windowsBlocksVisible ? tokens.text.primary : tokens.text.tertiary,
            background: windowsBlocksVisible ? tokens.bg.elevated : "transparent",
            borderColor: windowsBlocksVisible ? tokens.border.default : "transparent",
          }}
          title="Toggle Blocks"
        >
          <LayoutPanelLeft size={16} />
        </button>
        <button
          onClick={onToggleInspector}
          className={cx(
            "hidden md:flex w-8 h-8 rounded-lg items-center justify-center transition-colors",
            windowsInspectorVisible && "border"
          )}
          style={{
            color: windowsInspectorVisible ? tokens.text.primary : tokens.text.tertiary,
            background: windowsInspectorVisible ? tokens.bg.elevated : "transparent",
            borderColor: windowsInspectorVisible ? tokens.border.default : "transparent",
          }}
          title="Toggle Inspector"
        >
          <Eye size={16} />
        </button>
        <button
          onClick={onRefresh}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: tokens.text.tertiary }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = tokens.bg.elevated;
            e.currentTarget.style.color = tokens.text.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = tokens.text.tertiary;
          }}
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
        <button
          onClick={onRun}
          disabled={!activeDraftId || wfLoading}
          className={cx(
            "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
            !activeDraftId || wfLoading ? "opacity-50 cursor-not-allowed" : ""
          )}
          style={{
            background: "linear-gradient(135deg, rgba(34,211,238,0.2) 0%, rgba(139,92,246,0.2) 100%)",
            border: "1px solid rgba(34,211,238,0.3)",
            color: "#fff",
          }}
          title="Run"
        >
          {wfLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          <span className="hidden sm:inline">Run</span>
        </button>
        <button
          onClick={onPublish}
          disabled={!activeDraftId}
          className={cx(
            "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
            !activeDraftId ? "opacity-50 cursor-not-allowed" : ""
          )}
          style={{
            background: tokens.bg.elevated,
            border: `1px solid ${tokens.border.default}`,
            color: tokens.text.primary,
          }}
          onMouseEnter={(e) => {
            if (activeDraftId) {
              e.currentTarget.style.background = tokens.bg.surface;
              e.currentTarget.style.borderColor = tokens.border.focus;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = tokens.bg.elevated;
            e.currentTarget.style.borderColor = tokens.border.default;
          }}
          title="Publish"
        >
          <Rocket size={14} />
          <span className="hidden sm:inline">Publish</span>
        </button>
      </div>
    </div>
  );
}
