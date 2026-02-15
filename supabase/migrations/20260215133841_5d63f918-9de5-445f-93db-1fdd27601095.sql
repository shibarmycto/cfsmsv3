
-- Table to persist auto-trade session config so the bot runs in background
CREATE TABLE public.auto_trade_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trade_percent INTEGER NOT NULL DEFAULT 10,
  trade_amount_sol NUMERIC NOT NULL DEFAULT 0.03,
  mode TEXT NOT NULL DEFAULT 'auto', -- 'auto' or 'ca_scalp'
  target_ca TEXT,
  trades_completed INTEGER NOT NULL DEFAULT 0,
  total_profit_usd NUMERIC NOT NULL DEFAULT 0,
  total_loss_usd NUMERIC NOT NULL DEFAULT 0,
  last_trade_at TIMESTAMPTZ,
  last_scan_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auto_trade_sessions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own sessions
CREATE POLICY "Users can view own sessions" ON public.auto_trade_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.auto_trade_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.auto_trade_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Index for cron job to find active sessions
CREATE INDEX idx_auto_trade_sessions_active ON public.auto_trade_sessions (is_active) WHERE is_active = true;

-- Enable realtime for live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_trade_sessions;
