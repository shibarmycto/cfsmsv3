
-- Faucet access approvals
CREATE TABLE public.faucet_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  last_charged_at DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.faucet_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own faucet access" ON public.faucet_access FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can request faucet access" ON public.faucet_access FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage faucet access" ON public.faucet_access FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_faucet_access_updated_at BEFORE UPDATE ON public.faucet_access FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
