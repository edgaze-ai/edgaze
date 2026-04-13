// Full-bleed claim flow: no AppShell (sidebar / topbar). Matches invite /c/[token] treatment.
export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full overflow-y-auto overflow-x-hidden bg-[#050505]">
      {children}
    </div>
  );
}
