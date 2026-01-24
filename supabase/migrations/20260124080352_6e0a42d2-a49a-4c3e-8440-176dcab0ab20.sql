-- Add scheduling columns to ai_campaigns table
ALTER TABLE public.ai_campaigns 
ADD COLUMN scheduled_at timestamp with time zone,
ADD COLUMN is_scheduled boolean NOT NULL DEFAULT false;

-- Add index for efficient querying of due scheduled campaigns
CREATE INDEX idx_ai_campaigns_scheduled ON public.ai_campaigns (scheduled_at) 
WHERE is_scheduled = true AND status = 'approved';