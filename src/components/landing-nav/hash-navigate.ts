export const LANDING_SCROLL_OFFSET_PX = 92;

export function scrollToHashId(
  scroller: HTMLDivElement | null,
  hash: string,
  offsetPx: number = LANDING_SCROLL_OFFSET_PX,
) {
  if (!hash.startsWith("#")) return false;
  const id = hash.slice(1);
  const el = document.getElementById(id);
  if (!el) return false;

  if (!scroller) {
    const top = window.scrollY + el.getBoundingClientRect().top - offsetPx;
    window.history.pushState(null, "", hash);
    window.scrollTo({ top, behavior: "smooth" });
    return true;
  }

  const scrollerTop = scroller.getBoundingClientRect().top;
  const elTop = el.getBoundingClientRect().top;
  const top = elTop - scrollerTop + scroller.scrollTop - offsetPx;

  window.history.pushState(null, "", hash);
  scroller.scrollTo({ top, behavior: "smooth" });
  return true;
}
