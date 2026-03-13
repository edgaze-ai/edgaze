'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, ExternalLink, Share2 } from 'lucide-react';
import confetti from 'canvas-confetti';

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<any>(null);

  const sessionId = searchParams.get('session_id');
  const resourceId = searchParams.get('resource_id');
  const type = searchParams.get('type');

  useEffect(() => {
    const main = document.querySelector('main');
    if (main) {
      main.style.overflowY = 'auto';
      main.style.overflowX = 'hidden';
      return () => {
        main.style.overflowY = '';
        main.style.overflowX = '';
      };
    }
    return;
  }, []);

  useEffect(() => {
    if (!sessionId || !resourceId || !type) {
      setError('Invalid checkout session');
      setLoading(false);
      return;
    }

    pollForConfirmation();
  }, [sessionId, resourceId, type]);

  async function pollForConfirmation() {
    const maxAttempts = 30;
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;

      try {
        const res = await fetch(
          `/api/stripe/checkout/confirm?session_id=${sessionId}&resource_id=${resourceId}&type=${type}`
        );

        if (res.ok) {
          const data = await res.json();

          if (data.confirmed) {
            clearInterval(interval);
            setPurchase(data);
            setLoading(false);
            triggerConfetti();
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setError('Payment processing is taking longer than expected. Please contact support if you don\'t receive access within 5 minutes.');
            setLoading(false);
          }
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setError('Failed to confirm purchase. Please contact support.');
          setLoading(false);
        }
      } catch (err) {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setError('Network error. Please check your connection and contact support if the issue persists.');
          setLoading(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }

  function triggerConfetti() {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#22d3ee', '#e879f9', '#06b6d4', '#f472b6', '#ffffff'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#22d3ee', '#e879f9', '#06b6d4', '#f472b6', '#ffffff'],
      });
    }, 250);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] rounded-full bg-pink-500/[0.06] blur-[100px]" />
        </div>
        <div className="relative z-10 text-center">
          <Loader2 className="w-16 h-16 text-cyan-400 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">Processing your payment</h2>
          <p className="text-white/50">This usually takes just a few seconds...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 w-[400px] h-[400px] rounded-full bg-amber-500/[0.06] blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-md w-full">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-sm">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Payment processing</h1>
            <p className="text-white/60 mb-8">{error}</p>
            <button
              onClick={() => router.push('/library')}
              className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold hover:opacity-90 transition"
            >
              Go to Library
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-b from-cyan-500/10 via-pink-500/05 to-transparent blur-[140px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-pink-500/[0.06] blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] rounded-full bg-cyan-500/[0.05] blur-[80px]" />
      </div>

      <header className="relative z-10 w-full max-w-2xl flex items-center justify-between mb-12">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/edgaze-mark.png" alt="Edgaze" width={28} height={28} className="h-7 w-auto" />
          <span className="font-semibold text-white">Edgaze</span>
        </Link>
        <span className="text-white/40 text-sm">Payment complete</span>
      </header>

      <div className="relative z-10 max-w-xl w-full flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.7, bounce: 0.35 }}
          className="relative mb-8"
        >
          <div className="relative w-28 h-28 rounded-full flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 opacity-90 blur-xl animate-pulse" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-1 rounded-full bg-[#0d0d0d] flex items-center justify-center">
              <CheckCircle2 className="w-14 h-14 text-cyan-400 drop-shadow-[0_0_24px_rgba(34,211,238,0.5)]" strokeWidth={2} />
            </div>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl sm:text-5xl font-bold text-center mb-3"
        >
          <span className="bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
            Payment successful
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl text-white/60 text-center mb-12"
        >
          You now have access to this {type}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 mb-8"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Purchase details</h2>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-white/50">Transaction</span>
              <span className="text-white/90 font-mono text-xs">{sessionId?.slice(0, 24)}...</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/50">Date</span>
              <span className="text-white/90">{new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/50">Status</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/20 px-3 py-1 text-cyan-300 font-medium text-xs">
                Completed
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
        >
          <button
            onClick={() => {
              if (type === 'workflow') router.push('/library?tab=workflows');
              else router.push('/library?tab=prompts');
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500/90 to-purple-500/90 hover:from-cyan-400 hover:to-purple-400 px-6 py-4 text-white font-semibold shadow-[0_0_32px_rgba(34,211,238,0.2)] hover:shadow-[0_0_48px_rgba(34,211,238,0.3)] transition-all"
          >
            <ExternalLink className="w-5 h-5" />
            Open {type === 'workflow' ? 'workflow' : 'prompt'}
          </button>
          <button
            onClick={() => router.push('/library')}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/[0.08] px-6 py-4 text-white font-semibold transition-colors"
          >
            View in Library
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm text-white/40"
        >
          A receipt has been sent to your email
        </motion.p>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-6">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-cyan-400 animate-spin mx-auto mb-4" />
            <p className="text-white/60">Loading...</p>
          </div>
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
