-- Create wallets table for CFSMS Bank
CREATE TABLE public.wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    username text UNIQUE NOT NULL,
    balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
    is_miner_approved boolean NOT NULL DEFAULT false,
    total_mined numeric NOT NULL DEFAULT 0,
    total_sent numeric NOT NULL DEFAULT 0,
    total_received numeric NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    last_login_ip text,
    last_login_device text,
    last_login_at timestamp with time zone
);

-- Create wallet transactions table with encryption support
CREATE TABLE public.wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
    to_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
    amount numeric NOT NULL CHECK (amount > 0),
    transaction_type text NOT NULL CHECK (transaction_type IN ('transfer', 'mining', 'purchase', 'withdrawal', 'deposit', 'sms_credit_exchange')),
    status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    description text,
    metadata jsonb,
    ip_address text,
    device_info text,
    is_deleted_by_sender boolean NOT NULL DEFAULT false,
    is_deleted_by_receiver boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create friend requests table
CREATE TABLE public.friend_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    responded_at timestamp with time zone,
    UNIQUE(from_user_id, to_user_id)
);

-- Create friends table (accepted friendships)
CREATE TABLE public.friends (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    friend_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id, friend_id)
);

-- Create chat messages table
CREATE TABLE public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    message text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    is_deleted_by_sender boolean NOT NULL DEFAULT false,
    is_deleted_by_receiver boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create withdrawal requests table
CREATE TABLE public.withdrawal_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
    amount numeric NOT NULL CHECK (amount > 0),
    withdrawal_type text NOT NULL CHECK (withdrawal_type IN ('usdc', 'bitcoin', 'solana')),
    wallet_address text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    admin_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create miner requests table
CREATE TABLE public.miner_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create mining sessions table for tracking captcha work
CREATE TABLE public.mining_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
    captchas_completed integer NOT NULL DEFAULT 0,
    tokens_earned numeric NOT NULL DEFAULT 0,
    session_start timestamp with time zone NOT NULL DEFAULT now(),
    session_end timestamp with time zone,
    is_active boolean NOT NULL DEFAULT true
);

-- Create large transaction 2FA requests (for amounts > 100,000)
CREATE TABLE public.large_transaction_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid,
    from_wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
    to_wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
    amount numeric NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    otp_code text,
    otp_expires_at timestamp with time zone,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miner_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.large_transaction_approvals ENABLE ROW LEVEL SECURITY;

-- Wallet policies
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all wallets" ON public.wallets FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update all wallets" ON public.wallets FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System can insert wallets" ON public.wallets FOR INSERT WITH CHECK (true);

-- Wallet transactions policies (users see their own, admins see all)
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT 
USING (
    (EXISTS (SELECT 1 FROM public.wallets WHERE id = from_wallet_id AND user_id = auth.uid()) AND NOT is_deleted_by_sender) OR
    (EXISTS (SELECT 1 FROM public.wallets WHERE id = to_wallet_id AND user_id = auth.uid()) AND NOT is_deleted_by_receiver)
);
CREATE POLICY "Admins can view all transactions" ON public.wallet_transactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System can insert transactions" ON public.wallet_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can soft delete own transactions" ON public.wallet_transactions FOR UPDATE 
USING (
    EXISTS (SELECT 1 FROM public.wallets WHERE id = from_wallet_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.wallets WHERE id = to_wallet_id AND user_id = auth.uid())
);

-- Friend requests policies
CREATE POLICY "Users can view own friend requests" ON public.friend_requests FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Users can create friend requests" ON public.friend_requests FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can update received requests" ON public.friend_requests FOR UPDATE USING (auth.uid() = to_user_id);
CREATE POLICY "Admins can view all friend requests" ON public.friend_requests FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Friends policies
CREATE POLICY "Users can view own friends" ON public.friends FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "System can manage friends" ON public.friends FOR ALL WITH CHECK (true);
CREATE POLICY "Admins can view all friends" ON public.friends FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Chat messages policies
CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT 
USING (
    (auth.uid() = sender_id AND NOT is_deleted_by_sender) OR 
    (auth.uid() = receiver_id AND NOT is_deleted_by_receiver)
);
CREATE POLICY "Users can send messages to friends" ON public.chat_messages FOR INSERT 
WITH CHECK (
    auth.uid() = sender_id AND 
    EXISTS (SELECT 1 FROM public.friends WHERE (user_id = auth.uid() AND friend_id = receiver_id) OR (friend_id = auth.uid() AND user_id = receiver_id))
);
CREATE POLICY "Users can update own messages" ON public.chat_messages FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Admins can view all messages" ON public.chat_messages FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Withdrawal requests policies
CREATE POLICY "Users can view own withdrawal requests" ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create withdrawal requests" ON public.withdrawal_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all withdrawal requests" ON public.withdrawal_requests FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update withdrawal requests" ON public.withdrawal_requests FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Miner requests policies
CREATE POLICY "Users can view own miner request" ON public.miner_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create miner request" ON public.miner_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all miner requests" ON public.miner_requests FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update miner requests" ON public.miner_requests FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Mining sessions policies
CREATE POLICY "Users can view own mining sessions" ON public.mining_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own mining sessions" ON public.mining_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all mining sessions" ON public.mining_sessions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Large transaction approvals policies
CREATE POLICY "Users can view own pending approvals" ON public.large_transaction_approvals FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.wallets WHERE id = from_wallet_id AND user_id = auth.uid()));
CREATE POLICY "Admins can manage all approvals" ON public.large_transaction_approvals FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;

-- Create updated_at trigger for wallets
CREATE TRIGGER update_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_wallets_username ON public.wallets(username);
CREATE INDEX idx_wallet_transactions_from ON public.wallet_transactions(from_wallet_id);
CREATE INDEX idx_wallet_transactions_to ON public.wallet_transactions(to_wallet_id);
CREATE INDEX idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_receiver ON public.chat_messages(receiver_id);
CREATE INDEX idx_friends_user ON public.friends(user_id);
CREATE INDEX idx_friends_friend ON public.friends(friend_id);