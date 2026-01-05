import React from "react";
import AdminGate from "../../components/admin/AdminGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
              <div className="text-sm font-semibold tracking-wide">Admin</div>
              <div className="text-xs text-white/50">Moderation</div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/admin/moderation"
                className="text-sm px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
              >
                Reports
              </a>
              <a
                href="/marketplace"
                className="text-sm px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
              >
                Back to app
              </a>
            </div>
          </div>

          {children}
        </div>
      </div>
    </AdminGate>
  );
}
