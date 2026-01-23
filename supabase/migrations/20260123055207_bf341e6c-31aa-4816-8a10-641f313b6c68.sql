-- Create URL whitelist requests table
CREATE TABLE public.url_whitelist_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.url_whitelist_requests ENABLE ROW LEVEL SECURITY;

-- Users can create their own URL requests
CREATE POLICY "Users can create own URL requests"
ON public.url_whitelist_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own URL requests
CREATE POLICY "Users can view own URL requests"
ON public.url_whitelist_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all URL requests
CREATE POLICY "Admins can view all URL requests"
ON public.url_whitelist_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update URL requests
CREATE POLICY "Admins can update URL requests"
ON public.url_whitelist_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete URL requests
CREATE POLICY "Admins can delete URL requests"
ON public.url_whitelist_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));