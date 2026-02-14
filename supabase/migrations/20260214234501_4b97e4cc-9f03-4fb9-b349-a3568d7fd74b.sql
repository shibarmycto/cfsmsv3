
-- =============================================
-- FIX: Drop overly permissive "System can..." RLS policies
-- Service role key bypasses RLS, so these are unnecessary AND dangerous
-- They allow any authenticated user to perform these operations
-- =============================================

-- ai_twin_calls
DROP POLICY IF EXISTS "System can insert calls" ON public.ai_twin_calls;
DROP POLICY IF EXISTS "System can update calls" ON public.ai_twin_calls;

-- ai_twin_memories
DROP POLICY IF EXISTS "System can manage memories" ON public.ai_twin_memories;

-- forum_user_stats
DROP POLICY IF EXISTS "System can manage stats" ON public.forum_user_stats;

-- friends
DROP POLICY IF EXISTS "System can manage friends" ON public.friends;

-- game_combat_logs
DROP POLICY IF EXISTS "System can insert combat logs" ON public.game_combat_logs;

-- game_crime_logs
DROP POLICY IF EXISTS "System can insert crime logs" ON public.game_crime_logs;

-- game_jail_logs
DROP POLICY IF EXISTS "System can manage jail logs" ON public.game_jail_logs;

-- game_job_logs
DROP POLICY IF EXISTS "System can insert job logs" ON public.game_job_logs;

-- game_transactions
DROP POLICY IF EXISTS "System can insert transactions" ON public.game_transactions;

-- mining_task_logs
DROP POLICY IF EXISTS "System can insert task logs" ON public.mining_task_logs;

-- profiles
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

-- sip_call_sessions
DROP POLICY IF EXISTS "System can insert call sessions" ON public.sip_call_sessions;
DROP POLICY IF EXISTS "System can update call sessions" ON public.sip_call_sessions;

-- token_holdings
DROP POLICY IF EXISTS "System can manage holdings" ON public.token_holdings;

-- token_news
DROP POLICY IF EXISTS "System can manage news" ON public.token_news;

-- token_transactions
DROP POLICY IF EXISTS "System can insert transactions" ON public.token_transactions;

-- user_tokens
DROP POLICY IF EXISTS "System can update tokens" ON public.user_tokens;

-- wallet_transactions
DROP POLICY IF EXISTS "System can insert transactions" ON public.wallet_transactions;

-- wallets
DROP POLICY IF EXISTS "System can insert wallets" ON public.wallets;

-- =============================================
-- FIX: Replace "Users can..." permissive INSERT policies with proper checks
-- =============================================

-- game_gang_applications: character_id must belong to the authenticated user
DROP POLICY IF EXISTS "Users can create applications" ON public.game_gang_applications;
CREATE POLICY "Users can create applications" ON public.game_gang_applications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.game_characters gc
      WHERE gc.id = character_id AND gc.user_id = auth.uid()
    )
  );

-- game_gangs: any authenticated user can create (leader_id checked via character ownership)
DROP POLICY IF EXISTS "Users can create gangs" ON public.game_gangs;
CREATE POLICY "Users can create gangs" ON public.game_gangs
  FOR INSERT WITH CHECK (
    leader_id IS NULL OR EXISTS (
      SELECT 1 FROM public.game_characters gc
      WHERE gc.id = leader_id AND gc.user_id = auth.uid()
    )
  );

-- game_organizations: leader must be owned by the user
DROP POLICY IF EXISTS "Users can create organizations" ON public.game_organizations;
CREATE POLICY "Users can create organizations" ON public.game_organizations
  FOR INSERT WITH CHECK (
    leader_id IS NULL OR EXISTS (
      SELECT 1 FROM public.game_characters gc
      WHERE gc.id = leader_id AND gc.user_id = auth.uid()
    )
  );

-- game_vehicles: owner_id must be a character owned by the user
DROP POLICY IF EXISTS "Users can insert vehicles" ON public.game_vehicles;
CREATE POLICY "Users can insert vehicles" ON public.game_vehicles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.game_characters gc
      WHERE gc.id = owner_id AND gc.user_id = auth.uid()
    )
  );
