-- Add approval status and phone number to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_number text;

-- Update the handle_new_user function to include phone_number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, phone_number, is_approved)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone_number',
    false
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Drop existing policies on profiles that allow public read
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Create secure RLS policies for profiles (require authentication)
CREATE POLICY "Authenticated users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Add delete policy for admins
CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Add insert policy for profiles (for the trigger)
CREATE POLICY "System can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (true);

-- Fix sms_logs policies to require authentication
DROP POLICY IF EXISTS "Users can view own SMS logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Admins can view all SMS logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Users can insert own SMS logs" ON public.sms_logs;

CREATE POLICY "Authenticated users can view own SMS logs"
ON public.sms_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all SMS logs"
ON public.sms_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can insert own SMS logs"
ON public.sms_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);