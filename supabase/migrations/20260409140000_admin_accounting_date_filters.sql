-- Extend admin_marketplace_transactions_page with optional created_at range (for PDF export / reporting).
-- Drops the previous 4-argument overload so PostgREST exposes a single RPC signature.

DROP FUNCTION IF EXISTS public.admin_marketplace_transactions_page(integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.admin_marketplace_transactions_page(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_purchase_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  purchase_id uuid,
  purchase_type text,
  resource_id uuid,
  buyer_id uuid,
  creator_id uuid,
  status text,
  amount_cents integer,
  platform_fee_cents integer,
  creator_net_cents integer,
  currency text,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  payment_method_type text,
  created_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  resource_title text,
  edgaze_code text,
  creator_handle text,
  creator_email text,
  buyer_handle text,
  buyer_email text,
  earning_id uuid,
  earning_status text,
  claim_deadline_at timestamptz,
  stripe_account_id_on_earning text,
  stripe_transfer_id text,
  earning_created_at timestamptz,
  earning_paid_at timestamptz,
  earning_refunded_at timestamptz,
  connect_stripe_account_id text,
  connect_account_status text,
  connect_charges_enabled boolean,
  connect_payouts_enabled boolean,
  first_sale_email_sent_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.purchase_id,
    u.purchase_type,
    u.resource_id,
    u.buyer_id,
    u.creator_id,
    u.status,
    u.amount_cents,
    u.platform_fee_cents,
    u.creator_net_cents,
    u.currency,
    u.stripe_payment_intent_id,
    u.stripe_checkout_session_id,
    u.payment_method_type,
    u.created_at,
    u.refunded_at,
    u.disputed_at,
    u.resource_title,
    u.edgaze_code,
    u.creator_handle,
    u.creator_email,
    u.buyer_handle,
    u.buyer_email,
    u.earning_id,
    u.earning_status,
    u.claim_deadline_at,
    u.stripe_account_id_on_earning,
    u.stripe_transfer_id,
    u.earning_created_at,
    u.earning_paid_at,
    u.earning_refunded_at,
    u.connect_stripe_account_id,
    u.connect_account_status,
    u.connect_charges_enabled,
    u.connect_payouts_enabled,
    u.first_sale_email_sent_at
  FROM (
    SELECT
      wp.id AS purchase_id,
      'workflow'::text AS purchase_type,
      wp.workflow_id AS resource_id,
      wp.buyer_id,
      w.owner_id AS creator_id,
      wp.status,
      wp.amount_cents,
      wp.platform_fee_cents,
      wp.creator_net_cents,
      coalesce(ce.currency, 'usd'::text) AS currency,
      wp.stripe_payment_intent_id,
      wp.stripe_checkout_session_id,
      wp.payment_method_type,
      wp.created_at,
      wp.refunded_at,
      wp.disputed_at,
      w.title AS resource_title,
      w.edgaze_code,
      cprof.handle AS creator_handle,
      cprof.email AS creator_email,
      bprof.handle AS buyer_handle,
      bprof.email AS buyer_email,
      ce.id AS earning_id,
      ce.status AS earning_status,
      ce.claim_deadline_at,
      ce.stripe_account_id AS stripe_account_id_on_earning,
      ce.stripe_transfer_id,
      ce.created_at AS earning_created_at,
      ce.paid_at AS earning_paid_at,
      ce.refunded_at AS earning_refunded_at,
      sca.stripe_account_id AS connect_stripe_account_id,
      sca.account_status AS connect_account_status,
      sca.charges_enabled AS connect_charges_enabled,
      sca.payouts_enabled AS connect_payouts_enabled,
      (
        SELECT ecl.sent_at
        FROM public.creator_pending_claim_email_log ecl
        WHERE ecl.creator_earning_id = ce.id
          AND ecl.email_type = 'first_sale'::text
        ORDER BY ecl.sent_at ASC
        LIMIT 1
      ) AS first_sale_email_sent_at
    FROM public.workflow_purchases wp
    JOIN public.workflows w ON w.id = wp.workflow_id
    LEFT JOIN public.profiles cprof ON cprof.id = w.owner_id
    LEFT JOIN public.profiles bprof ON bprof.id = wp.buyer_id
    LEFT JOIN public.creator_earnings ce ON ce.stripe_payment_intent_id = wp.stripe_payment_intent_id
    LEFT JOIN public.stripe_connect_accounts sca ON sca.user_id = w.owner_id
    WHERE wp.stripe_payment_intent_id IS NOT NULL

    UNION ALL

    SELECT
      pp.id,
      'prompt'::text,
      pp.prompt_id,
      pp.buyer_id,
      p.owner_id,
      pp.status,
      pp.amount_cents,
      pp.platform_fee_cents,
      pp.creator_net_cents,
      coalesce(ce2.currency, 'usd'::text),
      pp.stripe_payment_intent_id,
      pp.stripe_checkout_session_id,
      pp.payment_method_type,
      pp.created_at,
      pp.refunded_at,
      pp.disputed_at,
      p.title,
      p.edgaze_code,
      cprof2.handle,
      cprof2.email,
      bprof2.handle,
      bprof2.email,
      ce2.id,
      ce2.status,
      ce2.claim_deadline_at,
      ce2.stripe_account_id,
      ce2.stripe_transfer_id,
      ce2.created_at,
      ce2.paid_at,
      ce2.refunded_at,
      sca2.stripe_account_id,
      sca2.account_status,
      sca2.charges_enabled,
      sca2.payouts_enabled,
      (
        SELECT ecl2.sent_at
        FROM public.creator_pending_claim_email_log ecl2
        WHERE ecl2.creator_earning_id = ce2.id
          AND ecl2.email_type = 'first_sale'::text
        ORDER BY ecl2.sent_at ASC
        LIMIT 1
      )
    FROM public.prompt_purchases pp
    JOIN public.prompts p ON p.id = pp.prompt_id
    LEFT JOIN public.profiles cprof2 ON cprof2.id = p.owner_id
    LEFT JOIN public.profiles bprof2 ON bprof2.id = pp.buyer_id
    LEFT JOIN public.creator_earnings ce2 ON ce2.stripe_payment_intent_id = pp.stripe_payment_intent_id
    LEFT JOIN public.stripe_connect_accounts sca2 ON sca2.user_id = p.owner_id
    WHERE pp.stripe_payment_intent_id IS NOT NULL
  ) u
  WHERE
    (p_purchase_type IS NULL OR u.purchase_type = p_purchase_type)
    AND (p_status IS NULL OR u.status = p_status)
    AND (p_from IS NULL OR u.created_at >= p_from)
    AND (p_to IS NULL OR u.created_at <= p_to)
  ORDER BY u.created_at DESC
  LIMIT least(coalesce(p_limit, 50), 5000)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.admin_marketplace_transactions_page(integer, integer, text, text, timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_marketplace_transactions_page(integer, integer, text, text, timestamptz, timestamptz) TO service_role;
