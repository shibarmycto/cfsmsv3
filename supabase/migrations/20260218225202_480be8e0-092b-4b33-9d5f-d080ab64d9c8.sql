
CREATE TABLE public.volume_bot_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  wallet_public_key TEXT,
  wallet_private_key TEXT,
  trade_size_sol NUMERIC NOT NULL DEFAULT 0.005,
  cycles_completed INTEGER NOT NULL DEFAULT 0,
  max_cycles INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT false,
  total_volume_usd NUMERIC NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Only service role accesses this (edge function uses service role key)
ALTER TABLE public.volume_bot_sessions ENABLE ROW LEVEL SECURITY;

-- No public policies — only service_role can access (contains private keys)
