-- Add daily SMS usage tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS daily_sms_limit integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS daily_sms_used integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_sms_reset_at timestamp with time zone DEFAULT now();