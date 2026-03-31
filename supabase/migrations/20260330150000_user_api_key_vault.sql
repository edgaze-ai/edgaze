-- Encrypted BYO API keys per user (OpenAI, Anthropic, Gemini).
-- Access only via service_role in API routes (RLS on, no policies for anon/authenticated).

CREATE TABLE IF NOT EXISTS public.user_api_key_vault (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini')),
  ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_api_key_vault_user_id ON public.user_api_key_vault (user_id);

COMMENT ON TABLE public.user_api_key_vault IS 'AES-GCM sealed provider API keys; plaintext only in app servers with USER_API_KEY_VAULT_KEY.';

ALTER TABLE public.user_api_key_vault ENABLE ROW LEVEL SECURITY;

-- No GRANT to anon/authenticated: table is invisible to PostgREST for user JWTs.
-- service_role bypasses RLS for server-side CRUD.
