
-- Yes Marketplace Sellers
CREATE TABLE public.yes_marketplace_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_name TEXT NOT NULL,
  store_slug TEXT NOT NULL UNIQUE,
  store_description TEXT,
  store_logo_url TEXT,
  store_banner_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  is_active BOOLEAN DEFAULT true,
  total_sales NUMERIC DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.yes_marketplace_sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approved sellers" ON public.yes_marketplace_sellers FOR SELECT USING (is_approved = true OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create their own seller profile" ON public.yes_marketplace_sellers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own seller profile" ON public.yes_marketplace_sellers FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete sellers" ON public.yes_marketplace_sellers FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Yes Marketplace Listings
CREATE TABLE public.yes_marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.yes_marketplace_sellers(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  item_type TEXT NOT NULL DEFAULT 'physical', -- 'physical' | 'digital'
  condition TEXT DEFAULT 'new', -- 'new' | 'used' | 'refurbished'
  quantity INTEGER DEFAULT 1,
  images TEXT[] DEFAULT '{}',
  digital_download_url TEXT,
  is_approved BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  total_sold INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.yes_marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved listings" ON public.yes_marketplace_listings FOR SELECT USING (
  (is_approved = true AND is_active = true) 
  OR seller_id IN (SELECT id FROM public.yes_marketplace_sellers WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Sellers can create listings" ON public.yes_marketplace_listings FOR INSERT WITH CHECK (
  seller_id IN (SELECT id FROM public.yes_marketplace_sellers WHERE user_id = auth.uid() AND is_approved = true)
);
CREATE POLICY "Sellers can update their listings" ON public.yes_marketplace_listings FOR UPDATE USING (
  seller_id IN (SELECT id FROM public.yes_marketplace_sellers WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Sellers can delete their listings" ON public.yes_marketplace_listings FOR DELETE USING (
  seller_id IN (SELECT id FROM public.yes_marketplace_sellers WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
);

-- Yes Marketplace Wallets (linked to Yes Cards)
CREATE TABLE public.yes_marketplace_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_id UUID REFERENCES public.yes_bank_cards(id),
  balance NUMERIC DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  total_received NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.yes_marketplace_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON public.yes_marketplace_wallets FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create own wallet" ON public.yes_marketplace_wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.yes_marketplace_wallets FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Yes Marketplace Orders
CREATE TABLE public.yes_marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  buyer_id UUID NOT NULL,
  seller_id UUID REFERENCES public.yes_marketplace_sellers(id) NOT NULL,
  listing_id UUID REFERENCES public.yes_marketplace_listings(id) NOT NULL,
  quantity INTEGER DEFAULT 1,
  total_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'placed', -- 'placed' | 'accepted' | 'dispatched' | 'delivered' | 'cancelled' | 'refunded'
  shipping_address TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  delivery_notes TEXT,
  is_digital BOOLEAN DEFAULT false,
  digital_download_url TEXT,
  placed_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.yes_marketplace_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view own orders" ON public.yes_marketplace_orders FOR SELECT USING (
  auth.uid() = buyer_id 
  OR seller_id IN (SELECT id FROM public.yes_marketplace_sellers WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Users can create orders" ON public.yes_marketplace_orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Sellers and admins can update orders" ON public.yes_marketplace_orders FOR UPDATE USING (
  seller_id IN (SELECT id FROM public.yes_marketplace_sellers WHERE user_id = auth.uid()) 
  OR auth.uid() = buyer_id
  OR public.has_role(auth.uid(), 'admin')
);

-- Yes Marketplace Messages (buyer-seller)
CREATE TABLE public.yes_marketplace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.yes_marketplace_orders(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.yes_marketplace_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order parties can view messages" ON public.yes_marketplace_messages FOR SELECT USING (
  order_id IN (
    SELECT id FROM public.yes_marketplace_orders 
    WHERE buyer_id = auth.uid() 
    OR seller_id IN (SELECT id FROM public.yes_marketplace_sellers WHERE user_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Order parties can send messages" ON public.yes_marketplace_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND order_id IN (
    SELECT id FROM public.yes_marketplace_orders 
    WHERE buyer_id = auth.uid() 
    OR seller_id IN (SELECT id FROM public.yes_marketplace_sellers WHERE user_id = auth.uid())
  )
);
CREATE POLICY "Users can update own messages" ON public.yes_marketplace_messages FOR UPDATE USING (auth.uid() = sender_id);

-- Credit-to-card conversion log
CREATE TABLE public.yes_card_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_id UUID REFERENCES public.yes_bank_cards(id),
  credits_converted NUMERIC NOT NULL,
  usd_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.yes_card_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topups" ON public.yes_card_topups FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create topups" ON public.yes_card_topups FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.yes_marketplace_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.yes_marketplace_messages;

-- Triggers for updated_at
CREATE TRIGGER update_yes_marketplace_sellers_updated_at BEFORE UPDATE ON public.yes_marketplace_sellers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_yes_marketplace_listings_updated_at BEFORE UPDATE ON public.yes_marketplace_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_yes_marketplace_wallets_updated_at BEFORE UPDATE ON public.yes_marketplace_wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_yes_marketplace_orders_updated_at BEFORE UPDATE ON public.yes_marketplace_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
