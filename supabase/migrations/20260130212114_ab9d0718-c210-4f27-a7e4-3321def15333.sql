-- Add new columns to game_characters for combat and jail system
ALTER TABLE public.game_characters 
ADD COLUMN IF NOT EXISTS is_in_jail BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS jail_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS jail_reason TEXT,
ADD COLUMN IF NOT EXISTS equipped_weapon TEXT DEFAULT 'fists',
ADD COLUMN IF NOT EXISTS gang_id UUID,
ADD COLUMN IF NOT EXISTS kills INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS deaths INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cf_credits_spent_in_game INTEGER DEFAULT 0;

-- Create weapons table
CREATE TABLE IF NOT EXISTS public.game_weapons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  weapon_type TEXT NOT NULL DEFAULT 'melee',
  damage INTEGER NOT NULL DEFAULT 10,
  range INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL DEFAULT 100,
  ammo_capacity INTEGER DEFAULT 0,
  description TEXT,
  icon TEXT DEFAULT '🔫'
);

-- Create player inventory for weapons
CREATE TABLE IF NOT EXISTS public.game_player_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  weapon_id UUID NOT NULL REFERENCES public.game_weapons(id) ON DELETE CASCADE,
  ammo INTEGER DEFAULT 0,
  is_equipped BOOLEAN DEFAULT false,
  acquired_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(character_id, weapon_id)
);

-- Create gangs table
CREATE TABLE IF NOT EXISTS public.game_gangs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  tag TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#ff0000',
  leader_id UUID REFERENCES public.game_characters(id),
  treasury INTEGER DEFAULT 0,
  reputation INTEGER DEFAULT 0,
  member_count INTEGER DEFAULT 1,
  max_members INTEGER DEFAULT 20,
  is_approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT
);

-- Create gang applications
CREATE TABLE IF NOT EXISTS public.game_gang_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gang_id UUID NOT NULL REFERENCES public.game_gangs(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(gang_id, character_id)
);

-- Add foreign key for gang membership
ALTER TABLE public.game_characters
ADD CONSTRAINT fk_game_characters_gang
FOREIGN KEY (gang_id) REFERENCES public.game_gangs(id) ON DELETE SET NULL;

-- Create criminal jobs table
CREATE TABLE IF NOT EXISTS public.game_criminal_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  description TEXT,
  min_payout INTEGER NOT NULL DEFAULT 100,
  max_payout INTEGER NOT NULL DEFAULT 500,
  cooldown_minutes INTEGER DEFAULT 5,
  wanted_level_risk INTEGER DEFAULT 1,
  energy_cost INTEGER DEFAULT 10,
  required_item TEXT,
  icon TEXT DEFAULT '💰'
);

-- Create job history/logs
CREATE TABLE IF NOT EXISTS public.game_job_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  payout INTEGER NOT NULL,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create jail logs
CREATE TABLE IF NOT EXISTS public.game_jail_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  arrested_by UUID REFERENCES public.game_characters(id),
  reason TEXT,
  jail_duration_minutes INTEGER DEFAULT 20,
  released_at TIMESTAMP WITH TIME ZONE,
  released_by UUID,
  used_jail_card BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create combat logs
CREATE TABLE IF NOT EXISTS public.game_combat_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attacker_id UUID NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  victim_id UUID NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  weapon_used TEXT DEFAULT 'fists',
  damage_dealt INTEGER DEFAULT 0,
  is_kill BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.game_weapons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_player_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_gangs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_gang_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_criminal_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_jail_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_combat_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_weapons (everyone can view)
CREATE POLICY "Anyone can view weapons" ON public.game_weapons FOR SELECT USING (true);
CREATE POLICY "Admins can manage weapons" ON public.game_weapons FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for game_player_inventory
CREATE POLICY "Users can view own inventory" ON public.game_player_inventory 
FOR SELECT USING (EXISTS (SELECT 1 FROM game_characters gc WHERE gc.id = character_id AND gc.user_id = auth.uid()));
CREATE POLICY "Users can manage own inventory" ON public.game_player_inventory 
FOR ALL USING (EXISTS (SELECT 1 FROM game_characters gc WHERE gc.id = character_id AND gc.user_id = auth.uid()));

-- RLS Policies for game_gangs
CREATE POLICY "Anyone can view approved gangs" ON public.game_gangs FOR SELECT USING (is_approved = true);
CREATE POLICY "Admins can view all gangs" ON public.game_gangs FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage gangs" ON public.game_gangs FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create gangs" ON public.game_gangs FOR INSERT WITH CHECK (true);
CREATE POLICY "Leaders can update own gang" ON public.game_gangs FOR UPDATE 
USING (EXISTS (SELECT 1 FROM game_characters gc WHERE gc.id = leader_id AND gc.user_id = auth.uid()));

-- RLS Policies for gang applications
CREATE POLICY "Users can create applications" ON public.game_gang_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own applications" ON public.game_gang_applications 
FOR SELECT USING (EXISTS (SELECT 1 FROM game_characters gc WHERE gc.id = character_id AND gc.user_id = auth.uid()));
CREATE POLICY "Gang leaders can view applications" ON public.game_gang_applications 
FOR SELECT USING (EXISTS (
  SELECT 1 FROM game_gangs g 
  JOIN game_characters gc ON gc.id = g.leader_id 
  WHERE g.id = gang_id AND gc.user_id = auth.uid()
));
CREATE POLICY "Gang leaders can update applications" ON public.game_gang_applications 
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM game_gangs g 
  JOIN game_characters gc ON gc.id = g.leader_id 
  WHERE g.id = gang_id AND gc.user_id = auth.uid()
));
CREATE POLICY "Admins can manage applications" ON public.game_gang_applications FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for criminal jobs (everyone can view)
CREATE POLICY "Anyone can view criminal jobs" ON public.game_criminal_jobs FOR SELECT USING (true);
CREATE POLICY "Admins can manage criminal jobs" ON public.game_criminal_jobs FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for job logs
CREATE POLICY "Users can view own job logs" ON public.game_job_logs 
FOR SELECT USING (EXISTS (SELECT 1 FROM game_characters gc WHERE gc.id = character_id AND gc.user_id = auth.uid()));
CREATE POLICY "System can insert job logs" ON public.game_job_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view all job logs" ON public.game_job_logs FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for jail logs
CREATE POLICY "Anyone can view jail logs" ON public.game_jail_logs FOR SELECT USING (true);
CREATE POLICY "System can manage jail logs" ON public.game_jail_logs FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for combat logs
CREATE POLICY "Anyone can view combat logs" ON public.game_combat_logs FOR SELECT USING (true);
CREATE POLICY "System can insert combat logs" ON public.game_combat_logs FOR INSERT WITH CHECK (true);

-- Insert default weapons
INSERT INTO public.game_weapons (name, weapon_type, damage, range, price, ammo_capacity, description, icon) VALUES
('Fists', 'melee', 5, 1, 0, 0, 'Your bare hands', '👊'),
('Baseball Bat', 'melee', 15, 2, 150, 0, 'Classic street weapon', '🏏'),
('Knife', 'melee', 20, 1, 200, 0, 'Quick and deadly', '🔪'),
('Pistol', 'firearm', 25, 50, 1500, 12, '9mm handgun', '🔫'),
('Shotgun', 'firearm', 50, 20, 3500, 8, 'Devastating close range', '💥'),
('SMG', 'firearm', 20, 40, 5000, 30, 'Rapid fire', '🔫'),
('Rifle', 'firearm', 40, 100, 8000, 20, 'Long range precision', '🎯'),
('Machete', 'melee', 30, 2, 500, 0, 'Sharp blade', '⚔️');

-- Insert default criminal jobs
INSERT INTO public.game_criminal_jobs (name, job_type, description, min_payout, max_payout, cooldown_minutes, wanted_level_risk, energy_cost, icon) VALUES
('Pickpocket', 'theft', 'Steal from pedestrians', 20, 100, 2, 1, 5, '👛'),
('Car Theft', 'theft', 'Steal and sell vehicles', 500, 2000, 15, 2, 15, '🚗'),
('Drug Deal', 'drugs', 'Sell substances on the street', 200, 800, 10, 2, 10, '💊'),
('Cannabis Grow', 'drugs', 'Grow and harvest cannabis', 300, 1000, 30, 1, 20, '🌿'),
('Store Robbery', 'robbery', 'Rob a convenience store', 500, 1500, 20, 3, 20, '🏪'),
('Bank Heist', 'robbery', 'Major bank job (requires crew)', 5000, 20000, 60, 5, 50, '🏦'),
('Mugging', 'assault', 'Rob players on the street', 100, 500, 5, 2, 10, '😈'),
('Contract Hit', 'assassination', 'Eliminate a target', 2000, 10000, 45, 4, 30, '💀');

-- Enable realtime for multiplayer features
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_combat_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_gangs;