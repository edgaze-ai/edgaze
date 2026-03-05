-- Connect account subscriptions for platform plans
-- Stores subscription status for connected accounts (V2) subscribing to platform

CREATE TABLE IF NOT EXISTS public.connect_account_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_account_id text NOT NULL REFERENCES public.stripe_connect_accounts(stripe_account_id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'past_due', 'canceled', 'trialing', 'paused')),
  cancel_at_period_end boolean DEFAULT false,
  current_period_end timestamptz,
  price_id text,
  quantity integer DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(stripe_account_id)
);

CREATE INDEX IF NOT EXISTS idx_connect_account_subscriptions_stripe_account ON public.connect_account_subscriptions(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_connect_account_subscriptions_user ON public.connect_account_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_connect_account_subscriptions_status ON public.connect_account_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_connect_account_subscriptions_stripe_sub ON public.connect_account_subscriptions(stripe_subscription_id);

COMMENT ON TABLE public.connect_account_subscriptions IS 'Platform subscription status for connected accounts (V2)';
