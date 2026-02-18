
-- Add auth_user_id column for web dashboard users
ALTER TABLE public.volume_bot_sessions 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- Create index for lookups by auth_user_id
CREATE INDEX IF NOT EXISTS idx_volume_bot_sessions_auth_user_id 
ON public.volume_bot_sessions(auth_user_id);

-- Allow authenticated users to read their own sessions
CREATE POLICY "Users can view own volume sessions"
ON public.volume_bot_sessions
FOR SELECT
USING (auth_user_id = auth.uid());
