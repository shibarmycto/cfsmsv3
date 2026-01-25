-- Create enum for token status
CREATE TYPE public.token_status AS ENUM ('active', 'established', 'verified', 'graduated', 'suspended');

-- Table for user-created tokens
CREATE TABLE public.user_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_emoji TEXT DEFAULT '🪙',
  total_supply NUMERIC NOT NULL DEFAULT 999000000,
  circulating_supply NUMERIC NOT NULL DEFAULT 0,
  price_per_token NUMERIC NOT NULL DEFAULT 1,
  market_cap NUMERIC NOT NULL DEFAULT 0,
  total_volume NUMERIC NOT NULL DEFAULT 0,
  total_sales_value NUMERIC NOT NULL DEFAULT 0,
  status token_status NOT NULL DEFAULT 'active',
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Token holdings - who owns what tokens
CREATE TABLE public.token_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_id UUID NOT NULL REFERENCES public.user_tokens(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  avg_buy_price NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, token_id)
);

-- Token transactions/trades
CREATE TABLE public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.user_tokens(id) ON DELETE CASCADE,
  buyer_id UUID,
  seller_id UUID,
  transaction_type TEXT NOT NULL, -- 'buy', 'sell', 'creation'
  amount NUMERIC NOT NULL,
  price_per_token NUMERIC NOT NULL DEFAULT 1,
  total_credits NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Market news/events for economic calendar
CREATE TABLE public.token_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES public.user_tokens(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'new_listing', 'large_buy', 'large_sell', 'established', 'verified', 'graduated', 'announcement'
  title TEXT NOT NULL,
  description TEXT,
  impact TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_news ENABLE ROW LEVEL SECURITY;

-- User tokens policies
CREATE POLICY "Anyone can view active tokens"
ON public.user_tokens FOR SELECT
USING (status != 'suspended');

CREATE POLICY "Admins can view all tokens"
ON public.user_tokens FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create tokens"
ON public.user_tokens FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "System can update tokens"
ON public.user_tokens FOR UPDATE
USING (true);

CREATE POLICY "Admins can delete tokens"
ON public.user_tokens FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Token holdings policies
CREATE POLICY "Users can view own holdings"
ON public.token_holdings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all holdings"
ON public.token_holdings FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can manage holdings"
ON public.token_holdings FOR ALL
USING (true);

-- Token transactions policies
CREATE POLICY "Anyone can view transactions"
ON public.token_transactions FOR SELECT
USING (true);

CREATE POLICY "System can insert transactions"
ON public.token_transactions FOR INSERT
WITH CHECK (true);

-- Token news policies
CREATE POLICY "Anyone can view news"
ON public.token_news FOR SELECT
USING (true);

CREATE POLICY "System can manage news"
ON public.token_news FOR ALL
USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_user_tokens_updated_at
BEFORE UPDATE ON public.user_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_token_holdings_updated_at
BEFORE UPDATE ON public.token_holdings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();