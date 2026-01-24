-- Create AI campaigns table
CREATE TABLE public.ai_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_audience TEXT NOT NULL,
  message_template TEXT NOT NULL,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  admin_notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  whatsapp_number TEXT NOT NULL,
  days_requested INTEGER NOT NULL DEFAULT 1,
  daily_cost NUMERIC NOT NULL DEFAULT 25.00,
  total_cost NUMERIC NOT NULL DEFAULT 25.00,
  destination TEXT NOT NULL DEFAULT 'uk',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI campaign logs table
CREATE TABLE public.ai_campaign_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.ai_campaigns(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI campaign payments table (links to existing payment methods)
CREATE TABLE public.ai_campaign_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.ai_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_reference TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_campaign_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_campaign_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_campaigns
CREATE POLICY "Users can view own campaigns" ON public.ai_campaigns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own campaigns" ON public.ai_campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending campaigns" ON public.ai_campaigns
  FOR UPDATE USING (auth.uid() = user_id AND status IN ('pending_payment', 'pending_approval'));

CREATE POLICY "Admins can view all campaigns" ON public.ai_campaigns
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all campaigns" ON public.ai_campaigns
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete campaigns" ON public.ai_campaigns
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for ai_campaign_logs
CREATE POLICY "Users can view own campaign logs" ON public.ai_campaign_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ai_campaigns 
      WHERE id = campaign_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all campaign logs" ON public.ai_campaign_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert campaign logs" ON public.ai_campaign_logs
  FOR INSERT WITH CHECK (true);

-- RLS policies for ai_campaign_payments
CREATE POLICY "Users can view own campaign payments" ON public.ai_campaign_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own campaign payments" ON public.ai_campaign_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all campaign payments" ON public.ai_campaign_payments
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update campaign payments" ON public.ai_campaign_payments
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger for ai_campaigns
CREATE TRIGGER update_ai_campaigns_updated_at
  BEFORE UPDATE ON public.ai_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_ai_campaigns_user_id ON public.ai_campaigns(user_id);
CREATE INDEX idx_ai_campaigns_status ON public.ai_campaigns(status);
CREATE INDEX idx_ai_campaign_logs_campaign_id ON public.ai_campaign_logs(campaign_id);
CREATE INDEX idx_ai_campaign_payments_campaign_id ON public.ai_campaign_payments(campaign_id);