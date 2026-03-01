'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Download,
  ExternalLink,
  Loader2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export default function EarningsDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      const [earningsRes, transactionsRes, analyticsRes] = await Promise.all([
        fetch('/api/creator/earnings'),
        fetch('/api/creator/transactions?limit=10'),
        fetch(`/api/creator/analytics?period=${period}`)
      ]);

      if (earningsRes.ok) {
        const data = await earningsRes.json();
        setEarnings(data);
      }

      if (transactionsRes.ok) {
        const data = await transactionsRes.json();
        setTransactions(data.transactions || []);
      }

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to load earnings data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function openStripeDashboard() {
    try {
      const res = await fetch('/api/stripe/connect/dashboard', {
        method: 'POST'
      });

      if (res.ok) {
        const data = await res.json();
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Failed to open Stripe dashboard:', error);
    }
  }

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Your Earnings
            </span>
          </h1>
          <p className="text-white/60">Track your sales, earnings, and payouts</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-white/60 text-sm mb-1">Total Earnings</h3>
            <p className="text-3xl font-bold text-white">
              {formatCents(earnings?.totalEarningsCents || 0)}
            </p>
            <p className="text-sm text-white/40 mt-2">
              {earnings?.totalSales || 0} sales
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-white/60 text-sm mb-1">Available Balance</h3>
            <p className="text-3xl font-bold text-white">
              {formatCents(earnings?.availableBalanceCents || 0)}
            </p>
            <p className="text-sm text-white/40 mt-2">Ready for payout</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-white/60 text-sm mb-1">Next Payout</h3>
            <p className="text-3xl font-bold text-white">
              {earnings?.nextPayout 
                ? formatCents(earnings.nextPayout.amountCents)
                : 'N/A'}
            </p>
            <p className="text-sm text-white/40 mt-2">
              {earnings?.nextPayout?.arrivalDate || 'Every Monday'}
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Recent Transactions</h2>
              <button className="text-sm text-cyan-400 hover:underline">
                View All
              </button>
            </div>

            <div className="space-y-4">
              {transactions.length === 0 ? (
                <p className="text-white/40 text-center py-8">No transactions yet</p>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition"
                  >
                    <div>
                      <p className="text-white font-medium">{tx.title}</p>
                      <p className="text-sm text-white/60">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">
                        {formatCents(tx.netAmountCents)}
                      </p>
                      <p className="text-xs text-white/40">
                        {tx.status === 'paid' ? '✓ Paid' : tx.status}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Top Products</h2>
            </div>

            <div className="space-y-4">
              {analytics?.topProducts?.length === 0 ? (
                <p className="text-white/40 text-center py-8">No sales yet</p>
              ) : (
                analytics?.topProducts?.map((product: any, index: number) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-4 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition"
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{product.title}</p>
                      <p className="text-sm text-white/60">{product.salesCount} sales</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">
                        {formatCents(product.totalEarnings)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6"
        >
          <h2 className="text-xl font-bold text-white mb-4">Manage Your Account</h2>
          <p className="text-white/60 mb-6">
            Access your Stripe Express Dashboard to update bank details, view tax forms, and manage your account settings.
          </p>
          <button
            onClick={openStripeDashboard}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center gap-2"
          >
            <ExternalLink className="w-5 h-5" />
            Open Stripe Dashboard
          </button>
        </motion.div>
      </div>
    </div>
  );
}
