
-- Track 24h access sessions for Solana Signals (20 credits per 24h)
CREATE TABLE public.signal_access_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  credits_charged INTEGER NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.signal_access_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
ON public.signal_access_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
ON public.signal_access_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
ON public.signal_access_sessions FOR UPDATE
USING (auth.uid() = user_id);

-- Add targeted_ca column to signal_trades to track CA-targeted scalps
ALTER TABLE public.signal_trades ADD COLUMN IF NOT EXISTS targeted_ca TEXT DEFAULT NULL;
