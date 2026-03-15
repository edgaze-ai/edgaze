-- Trigger: send first_sale email when creator_earnings is inserted with status = pending_claim

CREATE OR REPLACE FUNCTION public.trigger_send_pending_payout_first_sale_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_full_name text;
  v_handle text;
  v_amount_formatted text;
  v_days_remaining integer;
  v_claim_deadline_formatted text;
  v_pending_count integer;
BEGIN
  IF NEW.status <> 'pending_claim' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM public.creator_earnings
  WHERE creator_id = NEW.creator_id AND status = 'pending_claim';

  IF v_pending_count > 1 THEN
    RETURN NEW;
  END IF;

  SELECT u.email, p.full_name, p.handle
  INTO v_email, v_full_name, v_handle
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = NEW.creator_id
  LIMIT 1;

  IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) < 2 THEN
    RETURN NEW;
  END IF;

  v_amount_formatted := '$' || to_char((NEW.net_amount_cents::numeric / 100), 'FM999990.00');
  v_days_remaining := GREATEST(0, EXTRACT(day FROM (NEW.claim_deadline_at - now()))::integer);
  v_claim_deadline_formatted := to_char(NEW.claim_deadline_at AT TIME ZONE 'UTC', 'Mon DD, YYYY');

  PERFORM net.http_post(
    url := 'https://vbiobyjxhwiyvjqkwosx.supabase.co/functions/v1/send-pending-payout-email',
    body := jsonb_build_object(
      'email', v_email,
      'full_name', COALESCE(v_full_name, ''),
      'handle', COALESCE(v_handle, ''),
      'amountCents', NEW.net_amount_cents,
      'amountFormatted', v_amount_formatted,
      'daysRemaining', v_days_remaining,
      'emailType', 'first_sale',
      'claimDeadlineFormatted', v_claim_deadline_formatted
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_creator_earnings_pending_claim_send_first_sale_email ON public.creator_earnings;
CREATE TRIGGER on_creator_earnings_pending_claim_send_first_sale_email
  AFTER INSERT ON public.creator_earnings
  FOR EACH ROW
  WHEN (NEW.status = 'pending_claim')
  EXECUTE FUNCTION public.trigger_send_pending_payout_first_sale_email();
