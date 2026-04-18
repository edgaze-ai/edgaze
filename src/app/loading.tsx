// Returning null keeps the previous route's UI visible while the next segment
// streams in, instead of flashing a Suspense fallback on every navigation.
// Page-level loading is handled inside individual pages where useful.
export default function Loading() {
  return null;
}
