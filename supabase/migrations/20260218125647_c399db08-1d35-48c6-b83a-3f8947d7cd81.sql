
-- Airdrop vouchers that admins can place on the game map
CREATE TABLE public.game_airdrops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  amount_sol NUMERIC NOT NULL DEFAULT 0.01,
  description TEXT DEFAULT 'SOL Airdrop Voucher',
  position_x NUMERIC NOT NULL DEFAULT 0,
  position_z NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  claimed_by UUID REFERENCES public.game_characters(id),
  claimed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_airdrops ENABLE ROW LEVEL SECURITY;

-- Everyone can see active airdrops
CREATE POLICY "Anyone can view active airdrops"
  ON public.game_airdrops FOR SELECT
  USING (true);

-- Only admins can create airdrops
CREATE POLICY "Admins can create airdrops"
  ON public.game_airdrops FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Players can claim (update) unclaimed airdrops
CREATE POLICY "Players can claim airdrops"
  ON public.game_airdrops FOR UPDATE
  USING (claimed_by IS NULL AND is_active = true)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can delete airdrops
CREATE POLICY "Admins can delete airdrops"
  ON public.game_airdrops FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_airdrops;
