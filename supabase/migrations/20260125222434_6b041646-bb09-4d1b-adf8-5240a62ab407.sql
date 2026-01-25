-- Drop and recreate the get_forum_leaderboard function to include is_verified status
DROP FUNCTION IF EXISTS public.get_forum_leaderboard(integer);

CREATE FUNCTION public.get_forum_leaderboard(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  posts_count INTEGER,
  replies_count INTEGER,
  reactions_received INTEGER,
  reputation_score INTEGER,
  is_verified BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ROW_NUMBER() OVER (ORDER BY fus.reputation_score DESC, fus.posts_count DESC) as rank,
    fus.user_id,
    w.username,
    fus.posts_count,
    fus.replies_count,
    fus.reactions_received,
    fus.reputation_score,
    COALESCE(w.is_verified, false) as is_verified
  FROM forum_user_stats fus
  LEFT JOIN wallets w ON w.user_id = fus.user_id
  WHERE fus.reputation_score > 0 OR fus.posts_count > 0
  ORDER BY fus.reputation_score DESC, fus.posts_count DESC
  LIMIT limit_count;
$$;