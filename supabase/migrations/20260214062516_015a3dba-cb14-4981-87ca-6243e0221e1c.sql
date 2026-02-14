
-- Table to track Telegram groups the bot has been added to
CREATE TABLE public.telegram_bot_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT NOT NULL UNIQUE,
  chat_title TEXT,
  chat_type TEXT DEFAULT 'group',
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_alert_at TIMESTAMP WITH TIME ZONE
);

-- Table to log alerts sent
CREATE TABLE public.telegram_bot_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  groups_sent_to INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_bot_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_bot_alerts ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can manage bot groups" ON public.telegram_bot_groups
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view alerts" ON public.telegram_bot_alerts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
