
-- Table to store completed profitable trades for live notifications
CREATE TABLE public.trade_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL DEFAULT 'Trader',
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  profit_percent NUMERIC NOT NULL,
  amount_sol NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_notifications ENABLE ROW LEVEL SECURITY;

-- Anyone can read notifications (they're public feed items)
CREATE POLICY "Trade notifications are publicly readable"
  ON public.trade_notifications FOR SELECT USING (true);

-- Only authenticated users can insert their own
CREATE POLICY "Users can insert own trade notifications"
  ON public.trade_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role inserts from edge functions bypass RLS anyway

-- Enable realtime so notifications push live
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_notifications;
