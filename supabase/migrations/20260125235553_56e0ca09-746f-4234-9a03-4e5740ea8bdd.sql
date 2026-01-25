-- Create game messages table for world chat and private messages
CREATE TABLE public.game_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.game_characters(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  receiver_id UUID REFERENCES public.game_characters(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'world' CHECK (message_type IN ('world', 'private', 'proximity')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_messages ENABLE ROW LEVEL SECURITY;

-- World messages are visible to everyone
CREATE POLICY "Anyone can view world messages"
ON public.game_messages FOR SELECT
USING (message_type = 'world');

-- Private messages visible to sender and receiver
CREATE POLICY "Users can view own private messages"
ON public.game_messages FOR SELECT
USING (
  message_type = 'private' AND 
  EXISTS (
    SELECT 1 FROM game_characters gc 
    WHERE gc.user_id = auth.uid() 
    AND (gc.id = sender_id OR gc.id = receiver_id)
  )
);

-- Users can send messages from their character
CREATE POLICY "Users can send messages"
ON public.game_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM game_characters gc 
    WHERE gc.id = sender_id AND gc.user_id = auth.uid()
  )
);

-- Index for faster queries
CREATE INDEX idx_game_messages_type ON public.game_messages(message_type);
CREATE INDEX idx_game_messages_receiver ON public.game_messages(receiver_id) WHERE receiver_id IS NOT NULL;
CREATE INDEX idx_game_messages_created ON public.game_messages(created_at DESC);

-- Enable realtime for game messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_messages;