-- Create table for mining task completions
CREATE TABLE public.mining_task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL, -- 'signup', 'freebitcoin', 'youtube'
  task_details JSONB DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tokens_awarded NUMERIC NOT NULL DEFAULT 0,
  session_id UUID REFERENCES public.mining_sessions(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.mining_task_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own task logs"
  ON public.mining_task_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all task logs"
  ON public.mining_task_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert task logs"
  ON public.mining_task_logs FOR INSERT
  WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX idx_mining_task_logs_user_id ON public.mining_task_logs(user_id);
CREATE INDEX idx_mining_task_logs_completed_at ON public.mining_task_logs(completed_at);
CREATE INDEX idx_mining_task_logs_task_type ON public.mining_task_logs(task_type);