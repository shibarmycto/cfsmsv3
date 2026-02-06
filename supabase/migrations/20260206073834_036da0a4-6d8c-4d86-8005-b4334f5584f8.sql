-- Create SIP configurations table for multi-provider support
CREATE TABLE public.sip_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider_name TEXT NOT NULL DEFAULT 'Custom SIP',
  domain TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 5065,
  sip_username TEXT NOT NULL,
  auth_username TEXT,
  password_encrypted TEXT NOT NULL,
  transport TEXT NOT NULL DEFAULT 'TCP' CHECK (transport IN ('TCP', 'UDP', 'TLS')),
  inbound_number TEXT,
  allowed_numbers JSONB DEFAULT '["*"]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  connection_status TEXT DEFAULT 'disconnected',
  last_tested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create voice profiles table for multi-provider voice cloning
CREATE TABLE public.voice_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('elevenlabs', 'resemble_ai', 'cfgpt')),
  voice_name TEXT NOT NULL,
  voice_id TEXT,
  audio_file_url TEXT,
  training_status TEXT DEFAULT 'pending' CHECK (training_status IN ('pending', 'training', 'completed', 'failed')),
  quality_score NUMERIC(3,2),
  sample_duration_seconds INTEGER,
  is_default BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create AI receptionist configurations table
CREATE TABLE public.ai_receptionist_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  receptionist_name TEXT NOT NULL DEFAULT 'AI Receptionist',
  company_name TEXT,
  ai_provider TEXT NOT NULL DEFAULT 'openai' CHECK (ai_provider IN ('openai', 'anthropic', 'google', 'cohere', 'lovable_ai')),
  ai_model TEXT DEFAULT 'gpt-4',
  temperature NUMERIC(2,1) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 1),
  max_tokens INTEGER DEFAULT 500,
  system_prompt TEXT,
  greeting_message TEXT DEFAULT 'Thank you for calling. How may I help you today?',
  closing_message TEXT DEFAULT 'Thank you for calling. Have a great day!',
  business_hours JSONB DEFAULT '{"monday": {"start": "09:00", "end": "17:00"}, "tuesday": {"start": "09:00", "end": "17:00"}, "wednesday": {"start": "09:00", "end": "17:00"}, "thursday": {"start": "09:00", "end": "17:00"}, "friday": {"start": "09:00", "end": "17:00"}}'::jsonb,
  faq_data JSONB DEFAULT '[]'::jsonb,
  linked_voice_profile_id UUID REFERENCES public.voice_profiles(id),
  linked_sip_config_id UUID REFERENCES public.sip_configurations(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create API keys vault for secure credential storage
CREATE TABLE public.api_keys_vault (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  key_encrypted TEXT NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  is_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, service_name)
);

-- Create call sessions table for logging
CREATE TABLE public.sip_call_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sip_config_id UUID REFERENCES public.sip_configurations(id),
  receptionist_config_id UUID REFERENCES public.ai_receptionist_configs(id),
  caller_id TEXT,
  call_status TEXT DEFAULT 'initiated',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  transcript JSONB DEFAULT '[]'::jsonb,
  ai_confidence_score NUMERIC(3,2),
  sentiment TEXT,
  recording_url TEXT,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.sip_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_receptionist_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sip_call_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sip_configurations
CREATE POLICY "Users can view own SIP configs" ON public.sip_configurations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own SIP configs" ON public.sip_configurations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own SIP configs" ON public.sip_configurations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own SIP configs" ON public.sip_configurations FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all SIP configs" ON public.sip_configurations FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for voice_profiles
CREATE POLICY "Users can view own voice profiles" ON public.voice_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own voice profiles" ON public.voice_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own voice profiles" ON public.voice_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own voice profiles" ON public.voice_profiles FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_receptionist_configs
CREATE POLICY "Users can view own receptionist configs" ON public.ai_receptionist_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own receptionist configs" ON public.ai_receptionist_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own receptionist configs" ON public.ai_receptionist_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own receptionist configs" ON public.ai_receptionist_configs FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for api_keys_vault
CREATE POLICY "Users can view own API keys" ON public.api_keys_vault FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own API keys" ON public.api_keys_vault FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own API keys" ON public.api_keys_vault FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own API keys" ON public.api_keys_vault FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for sip_call_sessions
CREATE POLICY "Users can view own call sessions" ON public.sip_call_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert call sessions" ON public.sip_call_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update call sessions" ON public.sip_call_sessions FOR UPDATE USING (true);
CREATE POLICY "Admins can view all call sessions" ON public.sip_call_sessions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_sip_configurations_updated_at BEFORE UPDATE ON public.sip_configurations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_voice_profiles_updated_at BEFORE UPDATE ON public.voice_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_ai_receptionist_configs_updated_at BEFORE UPDATE ON public.ai_receptionist_configs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();