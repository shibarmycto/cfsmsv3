
-- YES Bank virtual card system tables

-- Bank access control (admin approval)
CREATE TABLE public.yes_bank_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.yes_bank_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access" ON public.yes_bank_access
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can request access" ON public.yes_bank_access
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all access" ON public.yes_bank_access
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update access" ON public.yes_bank_access
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Virtual cards table
CREATE TABLE public.yes_bank_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  holder_name TEXT NOT NULL,
  card_number TEXT NOT NULL,
  cvv TEXT NOT NULL,
  expiry TEXT NOT NULL,
  balance NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'frozen')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.yes_bank_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cards" ON public.yes_bank_cards
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can view all cards" ON public.yes_bank_cards
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert cards" ON public.yes_bank_cards
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update cards" ON public.yes_bank_cards
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete cards" ON public.yes_bank_cards
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Card applications
CREATE TABLE public.yes_bank_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  applicant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  requested_amount NUMERIC NOT NULL,
  purpose TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.yes_bank_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own applications" ON public.yes_bank_applications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own applications" ON public.yes_bank_applications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all applications" ON public.yes_bank_applications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update applications" ON public.yes_bank_applications
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fund transactions
CREATE TABLE public.yes_bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES public.yes_bank_cards(id) ON DELETE CASCADE,
  holder_name TEXT,
  amount NUMERIC NOT NULL,
  transaction_type TEXT DEFAULT 'fund' CHECK (transaction_type IN ('fund', 'debit', 'refund')),
  admin_note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.yes_bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own card transactions" ON public.yes_bank_transactions
  FOR SELECT TO authenticated USING (
    card_id IN (SELECT id FROM public.yes_bank_cards WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all transactions" ON public.yes_bank_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert transactions" ON public.yes_bank_transactions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.yes_bank_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.yes_bank_transactions;
