
-- Bundler access control table
CREATE TABLE public.bundler_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bundler_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bundler access" ON public.bundler_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can request bundler access" ON public.bundler_access
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage bundler access" ON public.bundler_access
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Bundler sessions table
CREATE TABLE public.bundler_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  main_wallet_public_key TEXT,
  status TEXT DEFAULT 'created',
  total_wallets INTEGER DEFAULT 25,
  sol_per_wallet NUMERIC DEFAULT 0,
  token_address TEXT,
  credits_charged INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bundler_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bundler sessions" ON public.bundler_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Bundler wallets table
CREATE TABLE public.bundler_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.bundler_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  wallet_index INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  balance_sol NUMERIC DEFAULT 0,
  token_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bundler_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bundler wallets" ON public.bundler_wallets
  FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_bundler_access_updated_at
  BEFORE UPDATE ON public.bundler_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bundler_sessions_updated_at
  BEFORE UPDATE ON public.bundler_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
