'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  Plus,
  Loader2,
  ExternalLink,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

export default function CreatorProductsPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    priceInCents: 0,
    currency: 'usd',
  });

  useEffect(() => {
    loadProducts();
    loadSubscription();
  }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/v2/products/list?limit=50');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        const accRes = await fetch('/api/stripe/v2/connect/status');
        if (accRes.ok) {
          const acc = await accRes.json();
          setAccountId(acc.accountId || null);
        }
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSubscription() {
    try {
      const res = await fetch('/api/stripe/v2/subscription/status');
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
      }
    } catch (err) {
      console.error('Failed to load subscription:', err);
    }
  }

  async function openSubscriptionCheckout() {
    setSubLoading(true);
    try {
      const res = await fetch('/api/stripe/v2/subscription/checkout', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubLoading(false);
    }
  }

  async function openBillingPortal() {
    setSubLoading(true);
    try {
      const res = await fetch('/api/stripe/v2/subscription/portal', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (data.url) window.open(data.url, '_blank');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/v2/products/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create product');
      setCreateOpen(false);
      setForm({ name: '', description: '', priceInCents: 0, currency: 'usd' });
      loadProducts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Your Products
            </span>
          </h1>
          <p className="text-white/60">
            Create and manage products for your store. Customers buy through your
            storefront.
          </p>
        </motion.div>

        {subscription?.status === 'active' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <span className="text-white font-medium">
                Platform subscription active
                {subscription.cancelAtPeriodEnd && (
                  <span className="text-yellow-400 text-sm ml-2">
                    (cancels at period end)
                  </span>
                )}
              </span>
            </div>
            <button
              onClick={openBillingPortal}
              disabled={subLoading}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm hover:bg-white/10 disabled:opacity-50 flex items-center gap-2"
            >
              {subLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              Manage billing
            </button>
          </motion.div>
        )}

        {(!subscription || subscription.status !== 'active') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-white/5 border border-cyan-500/30 rounded-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-white font-semibold mb-1">
                  Subscribe to platform plan
                </h3>
                <p className="text-white/60 text-sm">
                  Unlock premium features with a platform subscription
                </p>
              </div>
              <button
                onClick={openSubscriptionCheckout}
                disabled={subLoading}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {subLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CreditCard className="w-5 h-5" />
                )}
                Subscribe
              </button>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button
            onClick={() => setCreateOpen(true)}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Product
          </button>
          {accountId && (
            <Link
              href={`/store/${accountId}`}
              target="_blank"
              className="px-6 py-3 bg-white/5 border border-white/10 text-white font-semibold rounded-lg hover:bg-white/10 transition flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-5 h-5" />
              View Storefront
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
        </div>

        {products.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center"
          >
            <Package className="w-16 h-16 text-white/40 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              No products yet
            </h2>
            <p className="text-white/60 mb-6">
              Create your first product to start selling
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90"
            >
              Create Product
            </button>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            {products.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <h3 className="text-lg font-semibold text-white">{p.name}</h3>
                  {p.description && (
                    <p className="text-white/60 text-sm mt-1 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                  {p.default_price && (
                    <p className="text-cyan-400 font-medium mt-2">
                      {formatCents(p.default_price.unit_amount || 0)}{' '}
                      {p.default_price.currency?.toUpperCase()}
                    </p>
                  )}
                </div>
                {accountId && (
                  <Link
                    href={`/store/${accountId}?highlight=${p.id}`}
                    target="_blank"
                    className="text-sm text-white/60 hover:text-cyan-400 flex items-center gap-1"
                  >
                    View on store <ExternalLink className="w-4 h-4" />
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {createOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-md w-full"
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                Create Product
              </h2>
              <form onSubmit={handleCreate} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Product name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40"
                    placeholder="e.g. Premium AI Workflow"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 resize-none"
                    placeholder="Describe your product..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Price (cents, e.g. 999 = $9.99)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.priceInCents || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        priceInCents: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40"
                    placeholder="999"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(false)}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Create'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
