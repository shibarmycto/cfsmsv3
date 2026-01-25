-- Create AI Twin configuration table
CREATE TABLE public.ai_twins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'My AI Twin',
  personality_traits text[] DEFAULT '{"warm", "friendly", "supportive"}',
  speaking_style text DEFAULT 'conversational',
  tone_calm numeric DEFAULT 0.7 CHECK (tone_calm >= 0 AND tone_calm <= 1),
  tone_playful numeric DEFAULT 0.3 CHECK (tone_playful >= 0 AND tone_playful <= 1),
  tone_intuitive numeric DEFAULT 0.5 CHECK (tone_intuitive >= 0 AND tone_intuitive <= 1),
  greeting_message text DEFAULT 'Hey there! How are you feeling today?',
  custom_instructions text,
  voice_id text DEFAULT 'alice', -- Twilio voice
  language text DEFAULT 'en-US',
  is_active boolean DEFAULT true,
  forwarding_number text, -- User's number that forwards to AI
  cost_per_minute integer DEFAULT 1, -- tokens per minute
  total_minutes_used numeric DEFAULT 0,
  total_calls integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create AI Twin call logs table
CREATE TABLE public.ai_twin_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id uuid NOT NULL REFERENCES public.ai_twins(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  caller_phone text NOT NULL,
  call_sid text, -- Twilio call SID
  call_status text DEFAULT 'initiated',
  duration_seconds integer DEFAULT 0,
  tokens_charged integer DEFAULT 0,
  transcript jsonb DEFAULT '[]',
  caller_sentiment text,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create AI Twin memories table
CREATE TABLE public.ai_twin_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id uuid NOT NULL REFERENCES public.ai_twins(id) ON DELETE CASCADE,
  caller_phone text NOT NULL,
  caller_name text,
  memory_type text DEFAULT 'general', -- general, emotional, topic, preference
  memory_content text NOT NULL,
  importance numeric DEFAULT 0.5,
  last_referenced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_twins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_twin_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_twin_memories ENABLE ROW LEVEL SECURITY;

-- AI Twins policies
CREATE POLICY "Users can view own twins" ON public.ai_twins
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own twins" ON public.ai_twins
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own twins" ON public.ai_twins
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own twins" ON public.ai_twins
FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all twins" ON public.ai_twins
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- AI Twin Calls policies
CREATE POLICY "Users can view own calls" ON public.ai_twin_calls
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert calls" ON public.ai_twin_calls
FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update calls" ON public.ai_twin_calls
FOR UPDATE USING (true);

CREATE POLICY "Admins can view all calls" ON public.ai_twin_calls
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- AI Twin Memories policies
CREATE POLICY "Users can view own memories" ON public.ai_twin_memories
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.ai_twins WHERE id = ai_twin_memories.twin_id AND user_id = auth.uid()
));

CREATE POLICY "Users can delete own memories" ON public.ai_twin_memories
FOR DELETE USING (EXISTS (
  SELECT 1 FROM public.ai_twins WHERE id = ai_twin_memories.twin_id AND user_id = auth.uid()
));

CREATE POLICY "System can manage memories" ON public.ai_twin_memories
FOR ALL WITH CHECK (true);

CREATE POLICY "Admins can view all memories" ON public.ai_twin_memories
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_ai_twin_calls_twin_id ON public.ai_twin_calls(twin_id);
CREATE INDEX idx_ai_twin_calls_caller ON public.ai_twin_calls(caller_phone);
CREATE INDEX idx_ai_twin_memories_twin_caller ON public.ai_twin_memories(twin_id, caller_phone);
CREATE INDEX idx_ai_twins_user_id ON public.ai_twins(user_id);

-- Update trigger for ai_twins
CREATE TRIGGER update_ai_twins_updated_at
BEFORE UPDATE ON public.ai_twins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for ai_twin_memories
CREATE TRIGGER update_ai_twin_memories_updated_at
BEFORE UPDATE ON public.ai_twin_memories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();