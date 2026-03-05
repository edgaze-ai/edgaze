'use client';

/**
 * Storefront - Products for a connected account
 *
 * URL uses accountId for demo. In production, use a slug/handle (e.g. /store/@handle)
 * and resolve handle → stripe_account_id via your DB.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Package, Loader2, ShoppingCart } from 'lucide-react';

export default function StorefrontPage() {
  const params = useParams();
  const accountId = params.accountId as string;
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    if (accountId) loadProducts();
  }, [accountId]);

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/stripe/v2/products/list?accountId=${encodeURIComponent(accountId)}&limit=50`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load products');
      }
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy(productId: string, priceId: string | undefined) {
    setCheckoutLoading(productId);
    try {
      const res = await fetch('/api/stripe/v2/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectedAccountId: accountId,
          productId: priceId ? undefined : productId,
          priceId: priceId || undefined,
          quantity: 1,
          metadata: { product_id: productId },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCheckoutLoading(null);
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

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <Package className="w-16 h-16 text-white/40 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Store Unavailable</h1>
          <p className="text-white/60">{error}</p>
        </div>
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
              Store
            </span>
          </h1>
          <p className="text-white/60">Browse and purchase products</p>
        </motion.div>

        {products.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <Package className="w-16 h-16 text-white/40 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              No products yet
            </h2>
            <p className="text-white/60">This store has no active products.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition"
              >
                {p.images?.[0] ? (
                  <div className="aspect-video bg-white/5">
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-white/5 flex items-center justify-center">
                    <Package className="w-16 h-16 text-white/20" />
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="text-white/60 text-sm mb-4 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400 font-bold">
                      {p.default_price
                        ? formatCents(p.default_price.unit_amount || 0)
                        : '—'}
                    </span>
                    <button
                      onClick={() =>
                        handleBuy(p.id, p.default_price?.id)
                      }
                      disabled={!!checkoutLoading}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    >
                      {checkoutLoading === p.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="w-4 h-4" />
                      )}
                      Buy
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
