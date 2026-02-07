-- Add holder count column to track unique holders for each token
ALTER TABLE public.user_tokens ADD COLUMN IF NOT EXISTS holder_count integer DEFAULT 0;

-- Update existing tokens to calculate current holder count
UPDATE public.user_tokens SET holder_count = (
  SELECT COUNT(DISTINCT user_id) 
  FROM token_holdings 
  WHERE token_holdings.token_id = user_tokens.id AND amount > 0
);