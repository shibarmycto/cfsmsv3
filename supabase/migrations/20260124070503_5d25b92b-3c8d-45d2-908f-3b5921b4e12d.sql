-- Fix the overly permissive RLS policy for campaign logs
-- Replace "true" with a check for service role or campaign owner
DROP POLICY IF EXISTS "System can insert campaign logs" ON public.ai_campaign_logs;

-- Allow inserts only from users who own the campaign or via service role
CREATE POLICY "Users can insert own campaign logs" ON public.ai_campaign_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_campaigns 
      WHERE id = campaign_id AND user_id = auth.uid()
    )
  );