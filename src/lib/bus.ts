// Lightweight event bus for cross-component comms.
type Handler<T = any> = (payload: T) => void;

const listeners = new Map<string, Set<Handler>>();

export function on<T = any>(evt: string, fn: Handler<T>) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt)!.add(fn as Handler);
  return () => listeners.get(evt)?.delete(fn as Handler);
}

export function emit<T = any>(evt: string, payload?: T) {
  listeners.get(evt)?.forEach((fn) => fn(payload as T));
  // Also mirror to DOM to let non-React code hook in if needed
  const ce = new CustomEvent(evt, { detail: payload });
  window.dispatchEvent(ce);
  document.dispatchEvent(ce);
}
