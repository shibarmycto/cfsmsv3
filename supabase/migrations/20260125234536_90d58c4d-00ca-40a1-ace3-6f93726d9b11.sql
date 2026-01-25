-- Create game-related enums
CREATE TYPE public.character_gender AS ENUM ('male', 'female', 'other');
CREATE TYPE public.job_type AS ENUM ('unemployed', 'police', 'medic', 'taxi_driver', 'mechanic', 'criminal', 'business_owner', 'gang_member');
CREATE TYPE public.property_type AS ENUM ('small_apartment', 'medium_house', 'large_mansion', 'business', 'gang_hideout');
CREATE TYPE public.organization_type AS ENUM ('gang', 'business', 'police_department', 'hospital');

-- Game Characters table
CREATE TABLE public.game_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  gender character_gender NOT NULL DEFAULT 'male',
  skin_color TEXT NOT NULL DEFAULT '#f5d0c5',
  hair_color TEXT NOT NULL DEFAULT '#3d2314',
  shirt_color TEXT NOT NULL DEFAULT '#3b82f6',
  pants_color TEXT NOT NULL DEFAULT '#1e3a5f',
  position_x NUMERIC NOT NULL DEFAULT 500,
  position_y NUMERIC NOT NULL DEFAULT 500,
  cash NUMERIC NOT NULL DEFAULT 500,
  bank_balance NUMERIC NOT NULL DEFAULT 0,
  health INTEGER NOT NULL DEFAULT 100,
  hunger INTEGER NOT NULL DEFAULT 100,
  energy INTEGER NOT NULL DEFAULT 100,
  current_job job_type NOT NULL DEFAULT 'unemployed',
  job_experience INTEGER NOT NULL DEFAULT 0,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Properties table (houses, businesses)
CREATE TABLE public.game_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  property_type property_type NOT NULL,
  position_x NUMERIC NOT NULL,
  position_y NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  owner_id UUID REFERENCES public.game_characters(id) ON DELETE SET NULL,
  rent_income NUMERIC DEFAULT 0,
  is_for_sale BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organizations (gangs, businesses, police)
CREATE TABLE public.game_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  org_type organization_type NOT NULL,
  leader_id UUID REFERENCES public.game_characters(id) ON DELETE SET NULL,
  treasury NUMERIC NOT NULL DEFAULT 0,
  reputation INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#ff0000',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organization members
CREATE TABLE public.game_org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.game_organizations(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, character_id)
);

-- Game transactions/activity log
CREATE TABLE public.game_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Friend requests in game
CREATE TABLE public.game_friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  friend_character_id UUID NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(character_id, friend_character_id)
);

-- Enable realtime for character positions
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_characters;

-- Enable RLS
ALTER TABLE public.game_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_friends ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_characters
CREATE POLICY "Anyone can view online characters" ON public.game_characters
  FOR SELECT USING (true);

CREATE POLICY "Users can create own character" ON public.game_characters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own character" ON public.game_characters
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all characters" ON public.game_characters
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for game_properties
CREATE POLICY "Anyone can view properties" ON public.game_properties
  FOR SELECT USING (true);

CREATE POLICY "Owners can update own properties" ON public.game_properties
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM game_characters gc WHERE gc.id = owner_id AND gc.user_id = auth.uid())
  );

CREATE POLICY "Admins can manage properties" ON public.game_properties
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for game_organizations
CREATE POLICY "Anyone can view organizations" ON public.game_organizations
  FOR SELECT USING (true);

CREATE POLICY "Leaders can update own org" ON public.game_organizations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM game_characters gc WHERE gc.id = leader_id AND gc.user_id = auth.uid())
  );

CREATE POLICY "Users can create organizations" ON public.game_organizations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage organizations" ON public.game_organizations
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for game_org_members
CREATE POLICY "Anyone can view members" ON public.game_org_members
  FOR SELECT USING (true);

CREATE POLICY "Users can join/leave orgs" ON public.game_org_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM game_characters gc WHERE gc.id = character_id AND gc.user_id = auth.uid())
  );

-- RLS Policies for game_transactions
CREATE POLICY "Users can view own transactions" ON public.game_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM game_characters gc WHERE gc.id = character_id AND gc.user_id = auth.uid())
  );

CREATE POLICY "System can insert transactions" ON public.game_transactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all transactions" ON public.game_transactions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for game_friends
CREATE POLICY "Users can view own friends" ON public.game_friends
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM game_characters gc WHERE (gc.id = character_id OR gc.id = friend_character_id) AND gc.user_id = auth.uid())
  );

CREATE POLICY "Users can manage friend requests" ON public.game_friends
  FOR ALL USING (
    EXISTS (SELECT 1 FROM game_characters gc WHERE gc.id = character_id AND gc.user_id = auth.uid())
  );

-- Insert some default properties
INSERT INTO public.game_properties (name, property_type, position_x, position_y, price, is_for_sale) VALUES
  ('Starter Apartment #1', 'small_apartment', 200, 150, 5000, true),
  ('Starter Apartment #2', 'small_apartment', 250, 150, 5000, true),
  ('Downtown House', 'medium_house', 400, 300, 25000, true),
  ('Beachside Villa', 'large_mansion', 700, 100, 100000, true),
  ('Corner Shop', 'business', 350, 400, 50000, true),
  ('Warehouse', 'gang_hideout', 100, 600, 75000, true);

-- Create update trigger for characters
CREATE TRIGGER update_game_characters_updated_at
  BEFORE UPDATE ON public.game_characters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();