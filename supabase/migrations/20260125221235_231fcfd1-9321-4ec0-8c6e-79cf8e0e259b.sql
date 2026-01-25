-- Forum Channels (admin-approved categories)
CREATE TABLE public.forum_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '💬',
  created_by UUID NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  member_count INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Forum Posts (require admin approval)
CREATE TABLE public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.forum_channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  is_pinned BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  reaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Forum Replies (allowed without approval)
CREATE TABLE public.forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  parent_reply_id UUID REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  reaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Forum Reactions (on posts and replies)
CREATE TABLE public.forum_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reply_id UUID REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT '👍',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT reaction_target CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL) OR
    (post_id IS NULL AND reply_id IS NOT NULL)
  ),
  UNIQUE(user_id, post_id, reaction_type),
  UNIQUE(user_id, reply_id, reaction_type)
);

-- Forum Channel Members
CREATE TABLE public.forum_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.forum_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Forum Channel Group Chat Messages
CREATE TABLE public.forum_channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.forum_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Forum User Stats (for leaderboard)
CREATE TABLE public.forum_user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  posts_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  reactions_received INTEGER DEFAULT 0,
  reputation_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Forum Follows (users following each other)
CREATE TABLE public.forum_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- Enable RLS on all tables
ALTER TABLE public.forum_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forum_channels
CREATE POLICY "Anyone can view approved channels" ON public.forum_channels
  FOR SELECT USING (is_approved = true);

CREATE POLICY "Admins can view all channels" ON public.forum_channels
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create channels" ON public.forum_channels
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update channels" ON public.forum_channels
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete channels" ON public.forum_channels
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for forum_posts
CREATE POLICY "Anyone can view approved posts" ON public.forum_posts
  FOR SELECT USING (is_approved = true);

CREATE POLICY "Users can view own pending posts" ON public.forum_posts
  FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Admins can view all posts" ON public.forum_posts
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create posts" ON public.forum_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own posts" ON public.forum_posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Admins can update all posts" ON public.forum_posts
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete posts" ON public.forum_posts
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for forum_replies
CREATE POLICY "Anyone can view replies on approved posts" ON public.forum_replies
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM forum_posts WHERE id = post_id AND is_approved = true
  ));

CREATE POLICY "Admins can view all replies" ON public.forum_replies
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create replies" ON public.forum_replies
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own replies" ON public.forum_replies
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own replies" ON public.forum_replies
  FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Admins can delete replies" ON public.forum_replies
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for forum_reactions
CREATE POLICY "Anyone can view reactions" ON public.forum_reactions
  FOR SELECT USING (true);

CREATE POLICY "Users can add reactions" ON public.forum_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions" ON public.forum_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for forum_channel_members
CREATE POLICY "Anyone can view channel members" ON public.forum_channel_members
  FOR SELECT USING (true);

CREATE POLICY "Users can join channels" ON public.forum_channel_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave channels" ON public.forum_channel_members
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for forum_channel_messages
CREATE POLICY "Members can view channel messages" ON public.forum_channel_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM forum_channel_members 
    WHERE channel_id = forum_channel_messages.channel_id AND user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all messages" ON public.forum_channel_messages
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can send messages" ON public.forum_channel_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM forum_channel_members 
      WHERE channel_id = forum_channel_messages.channel_id AND user_id = auth.uid()
    )
  );

-- RLS Policies for forum_user_stats
CREATE POLICY "Anyone can view user stats" ON public.forum_user_stats
  FOR SELECT USING (true);

CREATE POLICY "System can manage stats" ON public.forum_user_stats
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for forum_follows
CREATE POLICY "Anyone can view follows" ON public.forum_follows
  FOR SELECT USING (true);

CREATE POLICY "Users can follow others" ON public.forum_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON public.forum_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Enable realtime for group chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_channel_messages;

-- Function to get forum leaderboard
CREATE OR REPLACE FUNCTION public.get_forum_leaderboard(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  posts_count INTEGER,
  replies_count INTEGER,
  reactions_received INTEGER,
  reputation_score INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ROW_NUMBER() OVER (ORDER BY fus.reputation_score DESC, fus.posts_count DESC) as rank,
    fus.user_id,
    w.username,
    fus.posts_count,
    fus.replies_count,
    fus.reactions_received,
    fus.reputation_score
  FROM forum_user_stats fus
  LEFT JOIN wallets w ON w.user_id = fus.user_id
  WHERE fus.reputation_score > 0 OR fus.posts_count > 0
  ORDER BY fus.reputation_score DESC, fus.posts_count DESC
  LIMIT limit_count;
$$;