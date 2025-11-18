export default function Footer() {
  return (
    <footer className="mt-8">
      <div className="edge-glass edge-border rounded-2xl px-4 py-3 text-xs text-white/70 flex items-center justify-between">
        <span>© {new Date().getFullYear()} Edgaze.ai</span>
        <span className="opacity-80">Built for creators</span>
      </div>
    </footer>
  );
}
