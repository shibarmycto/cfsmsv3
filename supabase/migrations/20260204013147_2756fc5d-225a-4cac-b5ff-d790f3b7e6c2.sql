-- Create signal subscriptions table
CREATE TABLE public.signal_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_type text NOT NULL DEFAULT 'hourly', -- 'hourly' (24/day) or 'half_hourly' (48/day)
  credits_spent integer NOT NULL DEFAULT 50,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  signals_sent integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user wallets table for Solana
CREATE TABLE public.solana_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  encrypted_private_key text, -- encrypted storage
  public_key text,
  balance_sol numeric DEFAULT 0,
  last_balance_check timestamp with time zone,
  is_trading_enabled boolean DEFAULT false,
  auto_trade_settings jsonb DEFAULT '{"enabled": false, "max_buy": 0.1, "stop_loss": 20}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create signal access approvals
CREATE TABLE public.signal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  telegram_user_id bigint,
  telegram_username text,
  is_approved boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamp with time zone,
  can_view_signals boolean DEFAULT false,
  can_execute_trades boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create token signals table
CREATE TABLE public.token_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_name text NOT NULL,
  token_symbol text NOT NULL,
  mint_address text NOT NULL UNIQUE,
  market_cap_sol numeric,
  liquidity_sol numeric,
  price_usd numeric,
  created_time timestamp with time zone NOT NULL,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  source text DEFAULT 'pumpfun',
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create trade history table
CREATE TABLE public.signal_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_signal_id uuid REFERENCES public.token_signals(id),
  mint_address text NOT NULL,
  trade_type text NOT NULL, -- 'buy' or 'sell'
  amount_sol numeric NOT NULL,
  token_amount numeric,
  price_at_trade numeric,
  tx_signature text,
  status text DEFAULT 'pending', -- pending, success, failed
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create signal batches for tracking sent lists
CREATE TABLE public.signal_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.signal_subscriptions(id),
  tokens_included uuid[] DEFAULT '{}',
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_via text DEFAULT 'telegram', -- telegram, web
  recipient_count integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.signal_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solana_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_batches ENABLE ROW LEVEL SECURITY;

-- Signal subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON public.signal_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscriptions" ON public.signal_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all subscriptions" ON public.signal_subscriptions
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Solana wallets policies
CREATE POLICY "Users can manage own wallet" ON public.solana_wallets
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets" ON public.solana_wallets
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Signal access policies
CREATE POLICY "Users can view own access" ON public.signal_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can request access" ON public.signal_access
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all access" ON public.signal_access
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Token signals policies (admins see all, approved users see recent)
CREATE POLICY "Admins can manage signals" ON public.token_signals
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view signals" ON public.token_signals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.signal_access sa 
      WHERE sa.user_id = auth.uid() AND sa.is_approved = true
    )
  );

-- Signal trades policies
CREATE POLICY "Users can manage own trades" ON public.signal_trades
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all trades" ON public.signal_trades
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Signal batches policies
CREATE POLICY "Admins can manage batches" ON public.signal_batches
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own batches" ON public.signal_batches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.signal_subscriptions ss 
      WHERE ss.id = signal_batches.subscription_id AND ss.user_id = auth.uid()
    )
  );

-- Create index for fast token lookups
CREATE INDEX idx_token_signals_created ON public.token_signals(created_time DESC);
CREATE INDEX idx_token_signals_first_seen ON public.token_signals(first_seen_at DESC);