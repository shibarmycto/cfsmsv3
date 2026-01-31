-- VM Rentals table for user virtual machine sessions
CREATE TABLE public.vm_rentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_type TEXT NOT NULL DEFAULT '24h', -- '24h' or '7d'
  credits_paid INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  time_remaining_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Admin VM permissions table
CREATE TABLE public.admin_vm_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL UNIQUE,
  can_use_vm BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Docker bots managed by users
CREATE TABLE public.docker_bots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  bot_name TEXT NOT NULL,
  bot_api_key TEXT NOT NULL,
  assigned_port INTEGER NOT NULL,
  container_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'stopped',
  is_admin_bot BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_started_at TIMESTAMP WITH TIME ZONE,
  last_stopped_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.vm_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_vm_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docker_bots ENABLE ROW LEVEL SECURITY;

-- VM Rentals policies
CREATE POLICY "Users can view own VM rentals" ON public.vm_rentals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create VM rentals" ON public.vm_rentals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all VM rentals" ON public.vm_rentals
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update VM rentals" ON public.vm_rentals
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin VM permissions policies
CREATE POLICY "Super admins can manage VM permissions" ON public.admin_vm_permissions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view own permission" ON public.admin_vm_permissions
  FOR SELECT USING (auth.uid() = admin_user_id);

-- Docker bots policies
CREATE POLICY "Users can view own docker bots" ON public.docker_bots
  FOR SELECT USING (auth.uid() = user_id OR is_admin_bot = true);

CREATE POLICY "Users can create own docker bots" ON public.docker_bots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all docker bots" ON public.docker_bots
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_vm_rentals_updated_at
BEFORE UPDATE ON public.vm_rentals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();