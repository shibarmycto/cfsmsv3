-- Add verified status to wallets table for user verification
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.wallets.is_verified IS 'Indicates if user has been verified by platform admins (blue tick badge)';