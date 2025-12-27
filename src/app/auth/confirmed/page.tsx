"use client";

export default function AuthConfirmedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/12 bg-white/[0.03] p-6 text-center">
        <div className="text-2xl font-semibold">Email verified 🎉</div>
        <div className="mt-3 text-sm text-white/60">
          Your email has been successfully verified.
          <br />
          You can now return to the original tab and sign in.
        </div>
      </div>
    </div>
  );
}
