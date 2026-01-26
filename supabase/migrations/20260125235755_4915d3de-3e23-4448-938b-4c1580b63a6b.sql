-- Create vehicle types enum
CREATE TYPE public.vehicle_type AS ENUM ('bicycle', 'motorcycle', 'sedan', 'sports_car', 'suv', 'truck', 'taxi', 'police_car', 'ambulance');

-- Create game_vehicles table
CREATE TABLE public.game_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.game_characters(id) ON DELETE SET NULL,
  vehicle_type vehicle_type NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#ffffff',
  position_x NUMERIC NOT NULL DEFAULT 500,
  position_y NUMERIC NOT NULL DEFAULT 500,
  rotation NUMERIC NOT NULL DEFAULT 0,
  speed NUMERIC NOT NULL DEFAULT 0,
  max_speed NUMERIC NOT NULL DEFAULT 100,
  price NUMERIC NOT NULL DEFAULT 1000,
  is_for_sale BOOLEAN NOT NULL DEFAULT false,
  fuel NUMERIC NOT NULL DEFAULT 100,
  health NUMERIC NOT NULL DEFAULT 100,
  is_locked BOOLEAN NOT NULL DEFAULT true,
  driver_id UUID REFERENCES public.game_characters(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_vehicles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view vehicles" ON public.game_vehicles
  FOR SELECT USING (true);

CREATE POLICY "Owners can update own vehicles" ON public.game_vehicles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM game_characters gc 
      WHERE gc.id = game_vehicles.owner_id AND gc.user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can update driven vehicles" ON public.game_vehicles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM game_characters gc 
      WHERE gc.id = game_vehicles.driver_id AND gc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert vehicles" ON public.game_vehicles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage all vehicles" ON public.game_vehicles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create taxi_fares table for tracking taxi jobs
CREATE TABLE public.game_taxi_fares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES public.game_characters(id) ON DELETE CASCADE NOT NULL,
  passenger_id UUID REFERENCES public.game_characters(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES public.game_vehicles(id) ON DELETE CASCADE NOT NULL,
  pickup_x NUMERIC NOT NULL,
  pickup_y NUMERIC NOT NULL,
  dropoff_x NUMERIC,
  dropoff_y NUMERIC,
  fare_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on taxi_fares
ALTER TABLE public.game_taxi_fares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view taxi fares" ON public.game_taxi_fares
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own fares" ON public.game_taxi_fares
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM game_characters gc 
      WHERE (gc.id = game_taxi_fares.driver_id OR gc.id = game_taxi_fares.passenger_id) 
      AND gc.user_id = auth.uid()
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_taxi_fares;

-- Insert some default vehicles for sale at dealership
INSERT INTO public.game_vehicles (vehicle_type, name, color, position_x, position_y, price, is_for_sale, max_speed) VALUES
  ('bicycle', 'Basic Bicycle', '#22c55e', 600, 200, 500, true, 30),
  ('motorcycle', 'Street Rider', '#ef4444', 650, 200, 5000, true, 120),
  ('sedan', 'Family Sedan', '#3b82f6', 700, 200, 15000, true, 100),
  ('sports_car', 'Speed Demon', '#f59e0b', 750, 200, 50000, true, 180),
  ('suv', 'Mountain Explorer', '#8b5cf6', 800, 200, 35000, true, 90),
  ('truck', 'Heavy Hauler', '#64748b', 850, 200, 25000, true, 70),
  ('taxi', 'City Taxi', '#fbbf24', 900, 200, 20000, true, 100);