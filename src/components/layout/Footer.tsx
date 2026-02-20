import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-8" aria-label="Site footer">
      <div className="edge-glass edge-border rounded-2xl px-4 py-4 text-xs text-white/70">
        <div className="flex items-center justify-between">
          <span>© {new Date().getFullYear()} Edgaze.ai</span>
          <nav aria-label="Footer navigation">
            <ul className="flex items-center gap-4">
              <li>
                <Link href="/marketplace" className="hover:text-white transition-colors">
                  Marketplace
                </Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-white transition-colors">
                  Docs
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-white transition-colors">
                  Help
                </Link>
              </li>
              <li>
                <Link href="/feedback" className="hover:text-white transition-colors">
                  Feedback
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
