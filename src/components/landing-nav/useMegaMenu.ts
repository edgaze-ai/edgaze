import { useCallback, useEffect, useRef, useState } from "react";

/** Enough time to cross tiny gaps between triggers and panel without tearing the menu down. */
const CLOSE_DELAY_MS = 280;

export function useMegaMenu() {
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpenId(null);
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const cancelClose = useCallback(() => {
    clearCloseTimer();
  }, [clearCloseTimer]);

  const requestOpen = useCallback(
    (id: string) => {
      clearCloseTimer();
      setOpenId(id);
    },
    [clearCloseTimer],
  );

  const closeNow = useCallback(() => {
    clearCloseTimer();
    setOpenId(null);
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNow();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId, closeNow]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  return {
    openId,
    requestOpen,
    scheduleClose,
    cancelClose,
    closeNow,
  };
}
