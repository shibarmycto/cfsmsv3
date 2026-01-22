-- Create purchase_requests table
CREATE TABLE public.purchase_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  package_name TEXT NOT NULL,
  credits_amount INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

-- Users can create their own purchase requests
CREATE POLICY "Users can create own purchase requests"
ON public.purchase_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own purchase requests
CREATE POLICY "Users can view own purchase requests"
ON public.purchase_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all purchase requests
CREATE POLICY "Admins can view all purchase requests"
ON public.purchase_requests
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Admins can update purchase requests
CREATE POLICY "Admins can update purchase requests"
ON public.purchase_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete purchase requests
CREATE POLICY "Admins can delete purchase requests"
ON public.purchase_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));