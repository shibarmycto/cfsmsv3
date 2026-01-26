-- Add wanted level and crime-related fields to game_characters
ALTER TABLE public.game_characters 
ADD COLUMN IF NOT EXISTS wanted_level integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_knocked_out boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS knocked_out_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS knocked_out_by uuid REFERENCES public.game_characters(id),
ADD COLUMN IF NOT EXISTS last_robbery_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS total_crimes integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS arrests integer NOT NULL DEFAULT 0;

-- Create police applications table
CREATE TABLE public.game_police_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  character_name text NOT NULL,
  reason text NOT NULL,
  experience text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create crime logs table
CREATE TABLE public.game_crime_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  criminal_id uuid NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  victim_id uuid REFERENCES public.game_characters(id) ON DELETE SET NULL,
  crime_type text NOT NULL,
  amount_stolen numeric DEFAULT 0,
  wanted_level_added integer DEFAULT 1,
  location_x numeric,
  location_y numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create game bans table
CREATE TABLE public.game_bans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  character_id uuid REFERENCES public.game_characters(id) ON DELETE SET NULL,
  reason text NOT NULL,
  rule_violated text,
  banned_by uuid NOT NULL,
  banned_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  is_permanent boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.game_police_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_crime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_bans ENABLE ROW LEVEL SECURITY;

-- Police applications policies
CREATE POLICY "Users can create own applications"
ON public.game_police_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own applications"
ON public.game_police_applications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all applications"
ON public.game_police_applications FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update applications"
ON public.game_police_applications FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Crime logs policies
CREATE POLICY "Anyone can view crime logs"
ON public.game_crime_logs FOR SELECT
USING (true);

CREATE POLICY "System can insert crime logs"
ON public.game_crime_logs FOR INSERT
WITH CHECK (true);

-- Game bans policies
CREATE POLICY "Admins can manage bans"
ON public.game_bans FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own bans"
ON public.game_bans FOR SELECT
USING (auth.uid() = user_id);

-- Enable realtime for crime logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_crime_logs;