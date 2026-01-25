-- Drop and recreate the get_mining_leaderboard function to include is_verified
DROP FUNCTION IF EXISTS public.get_mining_leaderboard(integer);

CREATE FUNCTION public.get_mining_leaderboard(limit_count integer DEFAULT 50)
 RETURNS TABLE(rank bigint, username text, tokens_earned numeric, captchas_completed bigint, is_current_user boolean, is_verified boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    ROW_NUMBER() OVER (ORDER BY w.total_mined DESC, ms.total_captchas DESC) as rank,
    w.username,
    w.total_mined as tokens_earned,
    COALESCE(ms.total_captchas, 0) as captchas_completed,
    (w.user_id = auth.uid()) as is_current_user,
    COALESCE(w.is_verified, false) as is_verified
  FROM wallets w
  LEFT JOIN (
    SELECT user_id, SUM(captchas_completed) as total_captchas
    FROM mining_sessions
    GROUP BY user_id
  ) ms ON ms.user_id = w.user_id
  WHERE w.is_miner_approved = true
    AND w.total_mined > 0
  ORDER BY w.total_mined DESC, ms.total_captchas DESC
  LIMIT limit_count;
$$;