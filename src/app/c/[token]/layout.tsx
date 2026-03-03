// Hide sidebar for invite onboarding pages
export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full overflow-y-auto overflow-x-hidden bg-black">
      {children}
    </div>
  );
}
