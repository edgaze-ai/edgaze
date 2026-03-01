'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Download, ExternalLink, Share2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<any>(null);

  const sessionId = searchParams.get('session_id');
  const resourceId = searchParams.get('resource_id');
  const type = searchParams.get('type');

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
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

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
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Processing Your Payment</h2>
          <p className="text-white/60">This usually takes just a few seconds...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Processing</h1>
          <p className="text-white/60 mb-6">{error}</p>
          <button
            onClick={() => router.push('/library')}
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition"
          >
            Go to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <CheckCircle2 className="w-12 h-12 text-white" />
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-ping opacity-20" />
          </div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl font-bold mb-4"
          >
            <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              Payment Successful!
            </span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl text-white/60"
          >
            You now have access to this {type}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-6"
        >
          <h2 className="text-xl font-bold text-white mb-4">Purchase Details</h2>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Transaction ID</span>
              <span className="text-white font-mono">{sessionId?.slice(0, 20)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Date</span>
              <span className="text-white">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Status</span>
              <span className="text-green-400 font-semibold">Completed</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-2 gap-4 mb-6"
        >
          <button
            onClick={() => {
              if (type === 'workflow') {
                router.push(`/library?tab=workflows`);
              } else {
                router.push(`/library?tab=prompts`);
              }
            }}
            className="px-6 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-5 h-5" />
            Open {type === 'workflow' ? 'Workflow' : 'Prompt'}
          </button>
          
          <button
            onClick={() => router.push('/library')}
            className="px-6 py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-lg hover:bg-white/10 transition flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            View in Library
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          <p className="text-sm text-white/40 mb-4">
            A receipt has been sent to your email
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => {
                const url = window.location.href;
                navigator.clipboard.writeText(url);
              }}
              className="text-sm text-cyan-400 hover:underline flex items-center gap-1"
            >
              <Share2 className="w-4 h-4" />
              Share your purchase
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
